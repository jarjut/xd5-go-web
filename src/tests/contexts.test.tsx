import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { SettingsProvider, useSettings } from '../context/SettingsContext';
import { DeviceProvider, useDevice } from '../context/DeviceContext';
import { XD5Protocol, PID_WIRELESS, PID_WIRED, VID } from '../core/protocol';
import type { HIDDevice } from '../types/protocol';
import { ReadySettingsProvider } from './ReadySettingsProvider';
import { createDefaultSettings, serializeSettingsToEEPROM } from '../core/settings';
import { SettingsSession } from '../core/settingsSession';

describe('SettingsContext', () => {
  it('blocks every draft mutation without a connected and read mouse', async () => {
    const ready = new SettingsSession({ settings: { ...createDefaultSettings(), debounce: 8 } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider><SettingsProvider session={ready}>{children}</SettingsProvider></DeviceProvider>
    );
    const { result } = renderHook(() => useSettings(), { wrapper });
    act(() => {
      result.current.updateSettings({ debounce: 4 });
      result.current.resetToDefaults();
    });
    expect(result.current.importProfileJson('{"debounce":4}')).toBe(false);
    expect(() => result.current.exportProfileJson()).toThrow(/read/i);
    await expect(result.current.applyToDevice()).rejects.toThrow(/read/i);
    expect(result.current.isLoadedFromDevice).toBe(false);
    expect(result.current.settings.debounce).toBe(12);
    expect(result.current.isDirty).toBe(false);
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with default settings and tracks dirty state on edits', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ReadySettingsProvider>{children}</ReadySettingsProvider>
    );
    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.settings.pollingRate).toBe(1000);
    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.updateSettings({
        debounce: 8,
      });
    });

    expect(result.current.settings.debounce).toBe(8);
    expect(result.current.isDirty).toBe(true);
  });

  it('resets settings to factory defaults', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ReadySettingsProvider>{children}</ReadySettingsProvider>
    );
    const { result } = renderHook(() => useSettings(), { wrapper });

    act(() => {
      result.current.updateSettings({ pollingRate: 500, debounce: 4 });
    });
    expect(result.current.settings.pollingRate).toBe(500);

    act(() => {
      result.current.resetToDefaults();
    });

    expect(result.current.settings.pollingRate).toBe(1000);
    expect(result.current.settings.debounce).toBe(12);
    expect(result.current.isDirty).toBe(true);
  });

  it('exports and imports profile JSON via SettingsContext', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ReadySettingsProvider>{children}</ReadySettingsProvider>
    );
    const { result } = renderHook(() => useSettings(), { wrapper });

    act(() => {
      result.current.updateSettings({ debounce: 4 });
    });

    const exported = result.current.exportProfileJson();
    expect(exported).toContain('"debounce": 4');

    act(() => {
      const success = result.current.importProfileJson(JSON.stringify({ debounce: 16 }));
      expect(success).toBe(true);
    });

    expect(result.current.settings.debounce).toBe(16);
  });
  it('throws error when useSettings is used outside SettingsProvider', () => {
    expect(() => {
      renderHook(() => useSettings());
    }).toThrow(/useSettings must be used within a SettingsProvider/i);
  });

  it('memoizes context value to avoid re-renders when state has not changed', () => {
    const { result, rerender } = renderHook(() => useSettings(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <ReadySettingsProvider>{children}</ReadySettingsProvider>
      ),
    });
    const firstValue = result.current;
    rerender();
    expect(result.current).toBe(firstValue);
  });
});

describe('DeviceContext', () => {
  function createMockHidDevice(wireless = false): HIDDevice {
    const listeners: Record<string, EventListenerOrEventListenerObject[]> = {};
    return {
      vendorId: VID,
      productId: wireless ? PID_WIRELESS : PID_WIRED,
      productName: wireless ? 'XD5 Wireless' : 'XD5 Wired',
      opened: true,
      open: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      sendReport: vi.fn().mockResolvedValue(undefined),
      sendFeatureReport: vi.fn().mockResolvedValue(undefined),
      receiveFeatureReport: vi.fn().mockResolvedValue(new DataView(new ArrayBuffer(17))),
      addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(listener);
      }),
      removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
        if (listeners[type]) {
          listeners[type] = listeners[type].filter(l => l !== listener);
        }
      }),
      dispatchEvent: vi.fn(() => true),
    } as unknown as HIDDevice;
  }

  it('initializes with disconnected defaults', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider>{children}</DeviceProvider>
    );
    const { result } = renderHook(() => useDevice(), { wrapper });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.device).toBeNull();
    expect(result.current.transport).toBe('disconnected');
    expect(result.current.battery).toBeNull();
    expect(result.current.logs).toEqual([]);
  });

  it('connects to device and updates status', async () => {
    const mockDevice = createMockHidDevice(true);
    const protocol = new XD5Protocol();
    vi.spyOn(protocol, 'requestAndOpen').mockImplementation(async () => {
      protocol.device = mockDevice;
      return mockDevice;
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider protocol={protocol}>{children}</DeviceProvider>
    );
    const { result } = renderHook(() => useDevice(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.device).toBe(mockDevice);
    expect(result.current.transport).toBe('wireless');
  });

  it('ignores a pending selection that completes after disconnect', async () => {
    const protocol = new XD5Protocol();
    let complete!: (device: HIDDevice) => void;
    vi.spyOn(protocol, 'requestAndOpen').mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const wrapper = ({ children }: { children: React.ReactNode }) => <DeviceProvider protocol={protocol}>{children}</DeviceProvider>;
    const { result } = renderHook(() => useDevice(), { wrapper });
    let connecting!: Promise<void>;
    act(() => { connecting = result.current.connect(); });
    expect(result.current.isConnecting).toBe(true);
    act(() => result.current.disconnect());
    await act(async () => {
      complete(createMockHidDevice());
      await connecting;
    });
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.device).toBe(null);
  });

  it('disconnects and resets device state', async () => {
    const mockDevice = createMockHidDevice(false);
    const protocol = new XD5Protocol();
    vi.spyOn(protocol, 'requestAndOpen').mockImplementation(async () => {
      protocol.device = mockDevice;
      return mockDevice;
    });
    protocol.device = mockDevice;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider protocol={protocol}>{children}</DeviceProvider>
    );
    const { result } = renderHook(() => useDevice(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.isConnected).toBe(true);

    await act(async () => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.device).toBeNull();
    expect(result.current.transport).toBe('disconnected');
  });

  it('applies settings to hardware EEPROM', async () => {
    const protocol = new XD5Protocol();
    const mockDevice = createMockHidDevice(false);
    protocol.device = mockDevice;

    const writeSpy = vi.spyOn(protocol, 'writeEEPROM').mockResolvedValue(undefined);
    vi.spyOn(protocol, 'commitFlash').mockResolvedValue(undefined);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider protocol={protocol}>{children}</DeviceProvider>
    );
    const { result } = renderHook(() => useDevice(), { wrapper });

    const testSettings = {
      profile: 0,
      pollingRate: 500,
      lod: 1,
      debounce: 10,
      sleepMin: 10,
      ripple: false,
      angleSnap: false,
      turnOffOnMove: true,
      activeDpiStage: 1,
      separateXY: false,
      dpiStages: [],
      lighting: { mode: 0, color: '#00e5ff', brightness: 8, speed: 5 },
      keys: {
        key1: '0x00000101',
        key2: '0x00000201',
        key3: '0x00000401',
        key4: '0x00000801',
        key5: '0x00001001',
        key6: '0x00000302',
      },
    };

    await act(async () => {
      await result.current.applySettingsToHardware(testSettings);
    });

    expect(writeSpy).toHaveBeenCalledWith(0x00, expect.any(Uint8Array), expect.any(Function));
  });

  it('reads settings from hardware EEPROM', async () => {
    const protocol = new XD5Protocol();
    const mockDevice = createMockHidDevice(false);
    protocol.device = mockDevice;

    const fakeEeprom = serializeSettingsToEEPROM(createDefaultSettings());
    const readSpy = vi.spyOn(protocol, 'readEEPROM').mockResolvedValue(fakeEeprom);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider protocol={protocol}>{children}</DeviceProvider>
    );
    const { result } = renderHook(() => useDevice(), { wrapper });

    let readBytes: Uint8Array | null = null;
    await act(async () => {
      readBytes = await result.current.readSettingsFromHardware();
    });

    expect(readSpy).toHaveBeenCalledWith(0x00, 181, expect.any(Function));
    expect(readBytes).toBe(fakeEeprom);
  });

  it('maintains a circular log buffer capped at 200 items', () => {
    const protocol = new XD5Protocol();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider protocol={protocol}>{children}</DeviceProvider>
    );
    const { result } = renderHook(() => useDevice(), { wrapper });

    act(() => {
      for (let i = 0; i < 250; i++) {
        protocol.log(`Log message #${i}`, 'out');
      }
    });

    expect(result.current.logs.length).toBe(200);
    expect(result.current.logs[result.current.logs.length - 1].message).toBe('Log message #249');
    expect(result.current.logs[0].message).toBe('Log message #50');
  });

  it('updates battery telemetry when protocol emits battery status', () => {
    const protocol = new XD5Protocol();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider protocol={protocol}>{children}</DeviceProvider>
    );
    const { result } = renderHook(() => useDevice(), { wrapper });

    act(() => {
      protocol.onBatteryUpdate?.({ power: 85, charging: true });
    });

    expect(result.current.battery).toEqual({ power: 85, charging: true });
  });

  it('throws error when useDevice is used outside DeviceProvider', () => {
    expect(() => {
      renderHook(() => useDevice());
    }).toThrow(/useDevice must be used within a DeviceProvider/i);
  });

  it('memoizes context value to avoid re-renders when state has not changed', () => {
    const { result, rerender } = renderHook(() => useDevice(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <DeviceProvider>{children}</DeviceProvider>
      ),
    });
    const firstValue = result.current;
    rerender();
    expect(result.current).toBe(firstValue);
  });
});

describe('Integrated Context Providers', () => {
  it('uses the injected session with a real device and resets its readiness across disconnect', async () => {
    const protocol = new XD5Protocol();
    protocol.device = { opened: true, close: vi.fn().mockResolvedValue(undefined), sendFeatureReport: vi.fn().mockResolvedValue(undefined) } as unknown as HIDDevice;
    vi.spyOn(protocol, 'readEEPROM').mockResolvedValue(serializeSettingsToEEPROM({ ...createDefaultSettings(), debounce: 16 }));
    const session = new SettingsSession({ settings: { ...createDefaultSettings(), debounce: 4 } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider protocol={protocol}><SettingsProvider session={session}>{children}</SettingsProvider></DeviceProvider>
    );
    const { result } = renderHook(() => ({ settings: useSettings(), device: useDevice() }), { wrapper });
    expect(session.getSnapshot().isLoadedFromDevice).toBe(false);
    await waitFor(() => expect(result.current.settings.isLoadedFromDevice).toBe(true));
    expect(session.getSnapshot().settings.debounce).toBe(16);
    expect(result.current.settings.settings).toBe(session.getSnapshot().settings);
    act(() => session.updateSettings({ debounce: 8 }));
    expect(result.current.settings.settings.debounce).toBe(8);
    await act(async () => { result.current.device.disconnect(); await Promise.resolve(); });
    expect(session.getSnapshot().isLoadedFromDevice).toBe(false);
    expect(session.getSnapshot().isDirty).toBe(false);
  });

  it('allows SettingsProvider to applyToDevice and readFromDevice via DeviceContext', async () => {
    const protocol = new XD5Protocol();
    const mockDevice = {
      opened: true,
      productId: PID_WIRELESS,
    } as unknown as HIDDevice;
    protocol.device = mockDevice;

    const fakeEeprom = serializeSettingsToEEPROM({ ...createDefaultSettings(), pollingRate: 500 });
    vi.spyOn(protocol, 'readEEPROM').mockResolvedValue(fakeEeprom);
    const writeSpy = vi.spyOn(protocol, 'writeEEPROM').mockResolvedValue(undefined);
    vi.spyOn(protocol, 'commitFlash').mockResolvedValue(undefined);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider protocol={protocol}>
        <SettingsProvider>{children}</SettingsProvider>
      </DeviceProvider>
    );
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoadedFromDevice).toBe(true));

    // Mark dirty
    act(() => {
      result.current.updateSettings({ debounce: 8 });
    });
    expect(result.current.isDirty).toBe(true);

    // Apply to device
    await act(async () => {
      await result.current.applyToDevice();
    });
    expect(writeSpy).toHaveBeenCalled();
    expect(result.current.isDirty).toBe(false);

    // Read from device
    await act(async () => {
      await result.current.readFromDevice();
    });

    expect(result.current.settings.pollingRate).toBe(500);
    expect(result.current.isDirty).toBe(false);
  });

  it('updates active DPI stage from a physical button without dirtying the ready session', async () => {
    const protocol = new XD5Protocol();
    protocol.device = { opened: true } as HIDDevice;
    vi.spyOn(protocol, 'readEEPROM').mockResolvedValue(serializeSettingsToEEPROM(createDefaultSettings()));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider protocol={protocol}>
        <SettingsProvider>{children}</SettingsProvider>
      </DeviceProvider>
    );
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoadedFromDevice).toBe(true));

    expect(result.current.settings.activeDpiStage).toBe(1);

    act(() => {
      protocol.onDeviceEvent?.({ type: 'dpi_change', stage: 4 });
    });

    expect(result.current.settings.activeDpiStage).toBe(4);
  });
});
