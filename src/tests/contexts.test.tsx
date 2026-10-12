import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { ProfileProvider, useProfiles } from '../context/ProfileContext';
import { DeviceProvider, useDevice, DeviceContext, type DeviceContextType } from '../context/DeviceContext';
import { XD5Protocol, PID_WIRELESS, PID_WIRED, VID } from '../core/protocol';
import type { HIDDevice, DeviceEvent } from '../types/protocol';

describe('ProfileContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with default profiles and tracks dirty state on edits', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ProfileProvider>{children}</ProfileProvider>
    );
    const { result } = renderHook(() => useProfiles(), { wrapper });

    expect(result.current.profiles.length).toBeGreaterThan(0);
    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.updateActiveProfile({
        debounceTime: 8,
      });
    });

    expect(result.current.activeProfile.debounceTime).toBe(8);
    expect(result.current.isDirty).toBe(true);
  });

  it('selects profiles and tracks active index', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ProfileProvider>{children}</ProfileProvider>
    );
    const { result } = renderHook(() => useProfiles(), { wrapper });

    expect(result.current.profiles.length).toBeGreaterThanOrEqual(4);

    act(() => {
      result.current.selectProfile(1);
    });

    expect(result.current.activeProfile.id).toBe(1);
    expect(result.current.activeProfile.name).toContain('Competitive FPS');
  });

  it('adds a new profile and selects it', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ProfileProvider>{children}</ProfileProvider>
    );
    const { result } = renderHook(() => useProfiles(), { wrapper });

    const initialCount = result.current.profiles.length;

    act(() => {
      result.current.addNewProfile('Custom Gaming', '#ff0055');
    });

    expect(result.current.profiles.length).toBe(initialCount + 1);
    expect(result.current.activeProfile.name).toBe('Custom Gaming');
    expect(result.current.activeProfile.profileColor).toBe('#ff0055');
    expect(result.current.isDirty).toBe(true);
  });

  it('renames active profile', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ProfileProvider>{children}</ProfileProvider>
    );
    const { result } = renderHook(() => useProfiles(), { wrapper });

    act(() => {
      result.current.renameActiveProfile('Renamed Profile');
    });

    expect(result.current.activeProfile.name).toBe('Renamed Profile');
    expect(result.current.isDirty).toBe(true);
  });

  it('deletes profile and throws when attempting to delete last remaining profile', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ProfileProvider>{children}</ProfileProvider>
    );
    const { result } = renderHook(() => useProfiles(), { wrapper });

    const initialCount = result.current.profiles.length;

    act(() => {
      result.current.deleteActiveProfile(initialCount - 1);
    });

    expect(result.current.profiles.length).toBe(initialCount - 1);

    // Delete remaining until only 1 left
    while (result.current.profiles.length > 1) {
      act(() => {
        result.current.deleteActiveProfile(0);
      });
    }

    expect(result.current.profiles.length).toBe(1);
    expect(() => {
      act(() => {
        result.current.deleteActiveProfile(0);
      });
    }).toThrow(/Cannot delete the last remaining profile/i);
  });

  it('resets profile to factory defaults', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ProfileProvider>{children}</ProfileProvider>
    );
    const { result } = renderHook(() => useProfiles(), { wrapper });

    act(() => {
      result.current.updateActiveProfile({ debounceTime: 4, pollingRate: 500 });
    });
    expect(result.current.activeProfile.debounceTime).toBe(4);

    act(() => {
      result.current.resetToFactory();
    });

    expect(result.current.activeProfile.debounce).toBe(12);
    expect(result.current.isDirty).toBe(true);
  });

  it('exports and imports profile json correctly', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ProfileProvider>{children}</ProfileProvider>
    );
    const { result } = renderHook(() => useProfiles(), { wrapper });

    const exportedJson = result.current.exportJson();
    expect(exportedJson).toContain('Fantech Helios Go XD5');

    const countBefore = result.current.profiles.length;
    act(() => {
      result.current.importJson(exportedJson);
    });

    expect(result.current.profiles.length).toBe(countBefore + 1);
    expect(result.current.activeProfile.name).toContain('(Imported)');
    expect(result.current.isDirty).toBe(true);
  });

  it('throws error when useProfiles is used outside of ProfileProvider', () => {
    expect(() => {
      renderHook(() => useProfiles());
    }).toThrow(/useProfiles must be used within a ProfileProvider/i);
  });

  it('memoizes context value to avoid re-renders when state has not changed', () => {
    const { result, rerender } = renderHook(() => useProfiles(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <ProfileProvider>{children}</ProfileProvider>
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

  it('disconnects and resets device state', async () => {
    const mockDevice = createMockHidDevice(false);
    const protocol = new XD5Protocol();
    vi.spyOn(protocol, 'requestAndOpen').mockResolvedValue(mockDevice);
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

  it('delegates sendHandshake and pollBattery to protocol', async () => {
    const protocol = new XD5Protocol();
    const handshakeSpy = vi.spyOn(protocol, 'sendHandshake').mockResolvedValue(undefined);
    const batterySpy = vi.spyOn(protocol, 'queryBattery').mockResolvedValue(undefined);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider protocol={protocol}>{children}</DeviceProvider>
    );
    const { result } = renderHook(() => useDevice(), { wrapper });

    await act(async () => {
      await result.current.sendHandshake(true);
    });
    expect(handshakeSpy).toHaveBeenCalledWith(true);

    await act(async () => {
      await result.current.pollBattery();
    });
    expect(batterySpy).toHaveBeenCalled();
  });

  it('applies profile to hardware EEPROM and commits flash', async () => {
    const protocol = new XD5Protocol();
    const mockDevice = createMockHidDevice(false);
    protocol.device = mockDevice;

    const writeSpy = vi.spyOn(protocol, 'writeEEPROM').mockResolvedValue(undefined);
    const commitSpy = vi.spyOn(protocol, 'commitFlash').mockResolvedValue(undefined);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider protocol={protocol}>{children}</DeviceProvider>
    );
    const { result } = renderHook(() => useDevice(), { wrapper });

    const dummyProfile = {
      id: 0,
      name: 'Test Profile',
      profileColor: '#00e5ff',
      pollingRate: 1000,
      lod: 1,
      debounce: 8,
      sleepMin: 10,
      ripple: false,
      angleSnap: false,
      turnOffOnMove: true,
      activeDpiStage: 1,
      separateXY: false,
      dpiStages: [
        { enabled: true, x: 800, y: 800, color: '#ff0000' },
        { enabled: true, x: 1600, y: 1600, color: '#0000ff' },
        { enabled: true, x: 2000, y: 2000, color: '#00ff00' },
        { enabled: true, x: 2400, y: 2400, color: '#ff00ff' },
        { enabled: true, x: 3200, y: 3200, color: '#00ffff' },
        { enabled: true, x: 5000, y: 5000, color: '#ff8000' },
        { enabled: true, x: 19000, y: 19000, color: '#ffffff' },
      ],
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
      await result.current.applyProfileToHardware(dummyProfile);
    });

    expect(writeSpy).toHaveBeenCalled();
    expect(commitSpy).toHaveBeenCalled();
  });

  it('reads profile from hardware EEPROM', async () => {
    const protocol = new XD5Protocol();
    const mockDevice = createMockHidDevice(false);
    protocol.device = mockDevice;

    const fakeEeprom = new Uint8Array(181);
    fakeEeprom[0] = 0x01; // 1000Hz
    vi.spyOn(protocol, 'readEEPROM').mockResolvedValue(fakeEeprom);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider protocol={protocol}>{children}</DeviceProvider>
    );
    const { result } = renderHook(() => useDevice(), { wrapper });

    let readResult: Uint8Array | null = null;
    await act(async () => {
      readResult = await result.current.readProfileFromHardware();
    });

    expect(readResult).toBeDefined();
    expect(readResult!.length).toBe(181);
    expect(readResult![0]).toBe(0x01);
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
  it('allows ProfileProvider to applyToDevice and readFromDevice via DeviceContext', async () => {
    const protocol = new XD5Protocol();
    const mockDevice = {
      opened: true,
      productId: PID_WIRELESS,
    } as unknown as HIDDevice;
    protocol.device = mockDevice;

    const fakeEeprom = new Uint8Array(181);
    fakeEeprom[0] = 0x02; // 500Hz
    vi.spyOn(protocol, 'readEEPROM').mockResolvedValue(fakeEeprom);
    const writeSpy = vi.spyOn(protocol, 'writeEEPROM').mockResolvedValue(undefined);
    const commitSpy = vi.spyOn(protocol, 'commitFlash').mockResolvedValue(undefined);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider protocol={protocol}>
        <ProfileProvider>{children}</ProfileProvider>
      </DeviceProvider>
    );
    const { result } = renderHook(() => useProfiles(), { wrapper });

    // Mark dirty
    act(() => {
      result.current.updateActiveProfile({ debounceTime: 8 });
    });
    expect(result.current.isDirty).toBe(true);

    // Apply to device
    await act(async () => {
      await result.current.applyToDevice();
    });

    expect(writeSpy).toHaveBeenCalled();
    expect(commitSpy).toHaveBeenCalled();
    expect(result.current.isDirty).toBe(false);

    // Read from device
    await act(async () => {
      await result.current.readFromDevice();
    });

    expect(result.current.activeProfile.pollingRate).toBe(500);
    expect(result.current.isDirty).toBe(false);
  });

  it('updates active DPI stage when physical DPI button event is pushed', () => {
    const protocol = new XD5Protocol();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DeviceProvider protocol={protocol}>
        <ProfileProvider>{children}</ProfileProvider>
      </DeviceProvider>
    );
    const { result } = renderHook(() => useProfiles(), { wrapper });

    act(() => {
      protocol.onDeviceEvent?.({ type: 'dpi_change', stage: 4 });
    });

    expect(result.current.activeProfile.activeDpiStage).toBe(4);
  });
  it('does not re-register device event listener on packet logs', () => {
    let subscribeCount = 0;
    let unsubscribeCount = 0;
    const stableSubscribe = vi.fn((_listener: (event: DeviceEvent) => void) => {
      subscribeCount++;
      return () => {
        unsubscribeCount++;
      };
    });

    const mockDeviceContext: DeviceContextType = {
      isConnected: true,
      device: null,
      transport: 'wireless',
      battery: null,
      logs: [],
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendHandshake: vi.fn(),
      pollBattery: vi.fn(),
      applyProfileToHardware: vi.fn(),
      readProfileFromHardware: vi.fn(),
      isConnecting: false,
      isSyncing: false,
      clearLogs: vi.fn(),
      protocol: new XD5Protocol(),
      lastEvent: null,
      subscribeDeviceEvent: stableSubscribe,
    };

    let contextValue = { ...mockDeviceContext };
    const { rerender } = renderHook(() => useProfiles(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <DeviceContext.Provider value={contextValue}>
          <ProfileProvider>{children}</ProfileProvider>
        </DeviceContext.Provider>
      ),
    });

    expect(subscribeCount).toBe(1);
    expect(unsubscribeCount).toBe(0);

    // Simulate DeviceProvider re-render due to new logs (value object changes, but subscribeDeviceEvent is stable)
    contextValue = {
      ...mockDeviceContext,
      logs: [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          message: 'test log',
          text: 'test log',
          type: 'in',
          direction: 'in',
        },
      ],
    };

    rerender();

    // With dependency narrowed to device?.subscribeDeviceEvent, listener should NOT re-register
    expect(subscribeCount).toBe(1);
    expect(unsubscribeCount).toBe(0);
  });
});
