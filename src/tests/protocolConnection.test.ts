import { afterEach, describe, expect, it, vi } from 'vitest';
import { XD5Protocol } from '../core/protocol';
import { createDefaultSettings, serializeSettingsToEEPROM } from '../core/settings';
import { SimulatedHid } from './simulatedHid';

function candidate() {
  const device = new SimulatedHid(serializeSettingsToEEPROM(createDefaultSettings()));
  device.opened = false;
  return device;
}

afterEach(() => { vi.restoreAllMocks(); });

describe('protocol connection acquisition', () => {
  it('aborts the candidate loop and releases earlier interfaces when disconnect interrupts opening', async () => {
    const protocol = new XD5Protocol();
    const first = candidate();
    const pending = candidate();
    const untouched = candidate();
    let finish!: () => void;
    vi.spyOn(pending, 'open').mockImplementation(() => new Promise<void>((resolve) => {
      finish = () => { pending.opened = true; resolve(); };
    }));
    const untouchedOpen = vi.spyOn(untouched, 'open');
    const opening = protocol.open(first, [first, pending, untouched]);
    const rejected = expect(opening).rejects.toThrow(/connection changed/i);
    await Promise.resolve();
    await Promise.resolve();
    protocol.close();
    finish();
    await rejected;
    expect(first.opened).toBe(false);
    expect(pending.opened).toBe(false);
    expect(untouchedOpen).not.toHaveBeenCalled();
    expect(protocol.isConnected).toBe(false);
  });

  it('does not close an interface now owned by a replacement connection during stale cleanup', async () => {
    const protocol = new XD5Protocol();
    const shared = candidate();
    const pending = candidate();
    const untouched = candidate();
    let finish!: () => void;
    vi.spyOn(pending, 'open').mockImplementation(() => new Promise<void>((resolve) => {
      finish = () => { pending.opened = true; resolve(); };
    }));
    const untouchedOpen = vi.spyOn(untouched, 'open');
    const opening = protocol.open(shared, [shared, pending, untouched]);
    const rejected = expect(opening).rejects.toThrow(/connection changed/i);
    await Promise.resolve();
    await Promise.resolve();
    await protocol.open(shared, [shared]);
    finish();
    await rejected;
    expect(shared.opened).toBe(true);
    expect(protocol.device).toBe(shared);
    expect(pending.opened).toBe(false);
    expect(untouchedOpen).not.toHaveBeenCalled();
    protocol.close();
  });
});
