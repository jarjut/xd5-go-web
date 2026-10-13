import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsSession } from '../core/settingsSession';
import { HardwareSync } from '../core/hardwareSync';
import { XD5Protocol } from '../core/protocol';
import { createDefaultSettings, serializeSettingsToEEPROM } from '../core/settings';
import type { MouseSettings } from '../types/settings';
import type { HIDDevice } from '../types/protocol';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function connectedHardware() {
  const protocol = new XD5Protocol();
  protocol.device = { opened: true } as HIDDevice;
  vi.spyOn(protocol, 'readEEPROM').mockResolvedValue(serializeSettingsToEEPROM(createDefaultSettings()));
  vi.spyOn(protocol, 'writeEEPROM').mockResolvedValue(undefined);
  vi.spyOn(protocol, 'commitFlash').mockResolvedValue(undefined);
  return { protocol, hardware: new HardwareSync(protocol) };
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('SettingsSession', () => {
  it('blocks edits, resets, imports and exports until a successful initial read', async () => {
    const { protocol, hardware } = connectedHardware();
    const read = deferred<Uint8Array>();
    vi.mocked(protocol.readEEPROM).mockReturnValue(read.promise);
    const session = new SettingsSession();
    const connecting = session.connect(hardware);
    session.updateSettings({ debounce: 4 });
    session.resetToDefaults();
    expect(session.importProfileJson('{"debounce":4}')).toBe(false);
    expect(() => session.exportProfileJson()).toThrow(/read/i);
    expect(session.getSnapshot().settings.debounce).toBe(12);
    expect(session.getSnapshot().isReading).toBe(true);
    read.resolve(serializeSettingsToEEPROM({ ...createDefaultSettings(), debounce: 16 }));
    await connecting;
    expect(session.getSnapshot().isLoadedFromDevice).toBe(true);
    expect(session.getSnapshot().settings.debounce).toBe(16);
  });

  it('keeps newer edits dirty after an older write and coalesces the next revision', async () => {
    vi.useFakeTimers();
    const { protocol, hardware } = connectedHardware();
    const firstWrite = deferred<void>();
    const secondWrite = deferred<void>();
    const writes: MouseSettings[] = [];
    const session = new SettingsSession();
    await session.connect(hardware);
    vi.mocked(protocol.writeEEPROM)
      .mockImplementationOnce(() => firstWrite.promise)
      .mockImplementationOnce(() => secondWrite.promise);
    session.updateSettings({ debounce: 4 });
    const applying = session.applyToDevice();
    await Promise.resolve();
    session.updateSettings({ debounce: 8 });
    session.updateSettings({ debounce: 16 });
    await vi.advanceTimersByTimeAsync(150);
    expect(protocol.writeEEPROM).toHaveBeenCalledTimes(1);
    firstWrite.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(session.getSnapshot().isDirty).toBe(true);
    expect(session.getSnapshot().settings.debounce).toBe(16);
    secondWrite.resolve();
    await applying;
    for (const [addr, bytes] of vi.mocked(protocol.writeEEPROM).mock.calls) {
      const val = addr === 0 ? bytes[0xa9] : bytes[0xa9 - addr];
      writes.push({ ...createDefaultSettings(), debounce: val });
    }
    expect(writes.map((settings) => settings.debounce)).toEqual([4, 16]);
    expect(session.getSnapshot().isDirty).toBe(false);
    expect(protocol.commitFlash).toHaveBeenCalledTimes(2);
  });

  it('invalidates pending reads and discards drafts and debounce work on disconnect/reconnect', async () => {
    vi.useFakeTimers();
    const { protocol, hardware } = connectedHardware();
    const read = deferred<Uint8Array>();
    vi.mocked(protocol.readEEPROM).mockReturnValueOnce(read.promise);
    const session = new SettingsSession();
    const connecting = session.connect(hardware);
    await Promise.resolve();
    session.disconnect();
    read.resolve(serializeSettingsToEEPROM({ ...createDefaultSettings(), debounce: 20 }));
    await connecting;
    expect(session.getSnapshot().isLoadedFromDevice).toBe(false);
    expect(session.getSnapshot().settings.debounce).toBe(12);
    await session.connect(hardware);
    session.updateSettings({ debounce: 4 });
    session.disconnect();
    await session.connect(hardware);
    await vi.advanceTimersByTimeAsync(300);
    expect(session.getSnapshot().settings.debounce).toBe(12);
    expect(session.getSnapshot().isDirty).toBe(false);
    expect(protocol.writeEEPROM).not.toHaveBeenCalled();
  });

  it('does not publish or commit a stale write after disconnect', async () => {
    const { protocol, hardware } = connectedHardware();
    const write = deferred<void>();
    const session = new SettingsSession();
    await session.connect(hardware);
    vi.mocked(protocol.writeEEPROM).mockReturnValueOnce(write.promise);
    session.updateSettings({ debounce: 4 });
    const applying = session.applyToDevice();
    await Promise.resolve();
    session.disconnect();
    write.resolve();
    await applying;
    expect(protocol.commitFlash).not.toHaveBeenCalled();
    expect(session.getSnapshot().isDirty).toBe(false);
    expect(session.getSnapshot().isLoadedFromDevice).toBe(false);
  });

  it('exposes read errors and retries only on request', async () => {
    const { protocol, hardware } = connectedHardware();
    vi.mocked(protocol.readEEPROM).mockResolvedValueOnce(new Uint8Array(181));
    const session = new SettingsSession();
    await expect(session.connect(hardware)).rejects.toThrow(/all-zero/i);
    expect(session.getSnapshot().isLoadedFromDevice).toBe(false);
    expect(session.getSnapshot().error).toMatch(/all-zero/i);
    expect(protocol.readEEPROM).toHaveBeenCalledTimes(1);
    await session.readFromDevice();
    expect(session.getSnapshot().error).toBe(null);
    expect(session.getSnapshot().isLoadedFromDevice).toBe(true);
  });

  it('keeps failed writes dirty and allows explicit retry without automatic retries', async () => {
    vi.useFakeTimers();
    const { protocol, hardware } = connectedHardware();
    const session = new SettingsSession();
    await session.connect(hardware);
    vi.mocked(protocol.commitFlash).mockRejectedValueOnce(new Error('Flash failed'));
    session.updateSettings({ debounce: 4 });
    await vi.advanceTimersByTimeAsync(150);
    expect(session.getSnapshot().isDirty).toBe(true);
    expect(session.getSnapshot().error).toBe('Flash failed');
    await vi.advanceTimersByTimeAsync(1000);
    expect(protocol.writeEEPROM).toHaveBeenCalledTimes(1);
    await session.applyToDevice();
    expect(session.getSnapshot().isDirty).toBe(false);
    expect(session.getSnapshot().error).toBe(null);
    session.disconnect();
  });

  it('leaves a pending draft and its automatic synchronization untouched when reload is cancelled', async () => {
    vi.useFakeTimers();
    const { protocol, hardware } = connectedHardware();
    const session = new SettingsSession();
    await session.connect(hardware);
    session.updateSettings({ debounce: 4 });
    // The UI cancels by not invoking readFromDevice; no preparatory mutation is required.
    expect(session.getSnapshot().isDirty).toBe(true);
    await vi.advanceTimersByTimeAsync(150);
    expect(protocol.readEEPROM).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().settings.debounce).toBe(4);
    expect(session.getSnapshot().isDirty).toBe(false);
  });

  it('automatically writes resets and imported profiles through the same revision queue', async () => {
    vi.useFakeTimers();
    const { protocol, hardware } = connectedHardware();
    const session = new SettingsSession();
    await session.connect(hardware);
    expect(session.importProfileJson('{"debounce":8}')).toBe(true);
    await vi.advanceTimersByTimeAsync(150);
    expect(session.getSnapshot().isDirty).toBe(false);
    session.resetToDefaults();
    await vi.advanceTimersByTimeAsync(150);
    expect(session.getSnapshot().isDirty).toBe(false);
    expect(vi.mocked(protocol.writeEEPROM).mock.calls.map(([addr, bytes]) => addr === 0 ? bytes[0xa9] : bytes[0xa9 - addr])).toEqual([8, 12]);
    session.disconnect();
  });

  it('a confirmed reload discards the draft and cancels its scheduled automatic write', async () => {
    vi.useFakeTimers();
    const { protocol, hardware } = connectedHardware();
    const session = new SettingsSession();
    await session.connect(hardware);
    session.updateSettings({ debounce: 4 });
    await session.readFromDevice();
    await vi.advanceTimersByTimeAsync(300);
    expect(session.getSnapshot().settings.debounce).toBe(12);
    expect(session.getSnapshot().isDirty).toBe(false);
    expect(protocol.writeEEPROM).not.toHaveBeenCalled();
    session.disconnect();
  });

  it('preserves edits arriving before their debounce when an older write completes', async () => {
    vi.useFakeTimers();
    const { protocol, hardware } = connectedHardware();
    const firstWrite = deferred<void>();
    const session = new SettingsSession();
    await session.connect(hardware);
    vi.mocked(protocol.writeEEPROM).mockReturnValueOnce(firstWrite.promise);
    session.updateSettings({ debounce: 4 });
    const writing = session.applyToDevice();
    await Promise.resolve();
    session.updateSettings({ debounce: 20 });
    firstWrite.resolve();
    await writing;
    expect(session.getSnapshot().isDirty).toBe(true);
    expect(protocol.writeEEPROM).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(150);
    expect(session.getSnapshot().isDirty).toBe(false);
    expect(protocol.writeEEPROM).toHaveBeenCalledTimes(2);
    session.disconnect();
  });

  it('ignores an old read that resolves after a replacement mouse has already loaded', async () => {
    const first = connectedHardware();
    const second = connectedHardware();
    const pending = deferred<Uint8Array>();
    vi.mocked(first.protocol.readEEPROM).mockReturnValue(pending.promise);
    vi.mocked(second.protocol.readEEPROM).mockResolvedValue(serializeSettingsToEEPROM({ ...createDefaultSettings(), debounce: 16 }));
    const session = new SettingsSession();
    const oldConnection = session.connect(first.hardware);
    await Promise.resolve();
    session.disconnect();
    await session.connect(second.hardware);
    pending.resolve(serializeSettingsToEEPROM({ ...createDefaultSettings(), debounce: 4 }));
    await oldConnection;
    expect(session.getSnapshot().settings.debounce).toBe(16);
    expect(session.getSnapshot().isLoadedFromDevice).toBe(true);
    expect(session.getSnapshot().error).toBe(null);
    session.disconnect();
  });

  it('keeps a ready draft visible and exportable after a failed manual reload while blocking mutations during it', async () => {
    const { protocol, hardware } = connectedHardware();
    const session = new SettingsSession();
    await session.connect(hardware);
    session.updateSettings({ debounce: 4 });
    const pending = deferred<Uint8Array>();
    vi.mocked(protocol.readEEPROM).mockReturnValueOnce(pending.promise);
    const reloading = session.readFromDevice();
    expect(session.getSnapshot().isLoadedFromDevice).toBe(true);
    expect(session.getSnapshot().isReading).toBe(true);
    session.updateSettings({ debounce: 8 });
    session.resetToDefaults();
    expect(session.importProfileJson('{"debounce":20}')).toBe(false);
    await expect(session.applyToDevice()).rejects.toThrow();
    expect(JSON.parse(session.exportProfileJson()).debounce).toBe(4);
    pending.reject(new Error('Reload failed'));
    await expect(reloading).rejects.toThrow('Reload failed');
    expect(session.getSnapshot().isLoadedFromDevice).toBe(true);
    expect(session.getSnapshot().isReading).toBe(false);
    expect(session.getSnapshot().isDirty).toBe(true);
    expect(session.getSnapshot().settings.debounce).toBe(4);
    expect(JSON.parse(session.exportProfileJson()).debounce).toBe(4);
    await session.readFromDevice();
    expect(session.getSnapshot().settings.debounce).toBe(12);
    expect(session.getSnapshot().error).toBe(null);
    session.disconnect();
  });

  it('never reads or writes mouse settings in browser storage', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const session = new SettingsSession({ settings: createDefaultSettings() });
    session.importProfileJson('{"debounce":4}');
    session.resetToDefaults();
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
});

describe('HardwareSync', () => {
  it('rejects incomplete reads rather than decoding defaults', async () => {
    const { protocol, hardware } = connectedHardware();
    vi.mocked(protocol.readEEPROM).mockResolvedValue(new Uint8Array(180));
    await expect(hardware.read()).rejects.toThrow(/180\/181/);
  });

  it('serializes the entire write and flash commit before a queued read', async () => {
    const { protocol, hardware } = connectedHardware();
    const commit = deferred<void>();
    vi.mocked(protocol.commitFlash).mockReturnValue(commit.promise);
    const writing = hardware.write(createDefaultSettings());
    const reading = hardware.read();
    await Promise.resolve();
    await Promise.resolve();
    expect(protocol.readEEPROM).not.toHaveBeenCalled();
    commit.resolve();
    await writing;
    expect((await reading).debounce).toBe(12);
  });
});
