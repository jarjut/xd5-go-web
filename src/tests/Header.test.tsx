import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../components/layout/Header';
import { XD5Protocol } from '../core/protocol';
import type { HIDDevice } from '../types/protocol';
import { SettingsProvider, SettingsContext, type SettingsContextType } from '../context/SettingsContext';
import { DeviceProvider, DeviceContext, type DeviceContextType } from '../context/DeviceContext';
import { createDefaultSettings } from '../core/settings';

describe('Header component', () => {
  it('renders brand and action controls', () => {
    render(
      <DeviceProvider>
        <SettingsProvider>
          <Header />
        </SettingsProvider>
      </DeviceProvider>
    );

    expect(screen.getByText('HELIOS GO XD5')).toBeDefined();
    expect(screen.getByRole('button', { name: /Connect Mouse/i })).toBeDefined();
  });

  it('renders disconnected transport badge and battery placeholder', () => {
    render(
      <DeviceProvider>
        <SettingsProvider>
          <Header />
        </SettingsProvider>
      </DeviceProvider>
    );

    expect(screen.getByText(/DISCONNECTED/i)).toBeDefined();
    expect(screen.getByText(/--%/i)).toBeDefined();
  });

  it('handles connect button click', () => {
    const connectMock = vi.fn();
    const mockDevice: DeviceContextType = {
      isConnected: false,
      device: null,
      transport: 'disconnected',
      battery: null,
      logs: [],
      connect: connectMock,
      disconnect: vi.fn(),
      sendHandshake: vi.fn().mockResolvedValue(undefined),
      pollBattery: vi.fn().mockResolvedValue(undefined),
      applySettingsToHardware: vi.fn().mockResolvedValue(undefined),
      readSettingsFromHardware: vi.fn().mockResolvedValue(new Uint8Array(181)),
      isConnecting: false,
      isSyncing: false,
      clearLogs: vi.fn(),
      protocol: {} as unknown as XD5Protocol,
      lastEvent: null,
      subscribeDeviceEvent: vi.fn(() => vi.fn()),
    };

    render(
      <DeviceContext.Provider value={mockDevice}>
        <SettingsProvider>
          <Header />
        </SettingsProvider>
      </DeviceContext.Provider>
    );

    const connectBtn = screen.getByRole('button', { name: /Connect Mouse/i });
    fireEvent.click(connectBtn);
    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it('renders connected state with battery HUD, Zap charging icon, and Disconnect button', () => {
    const disconnectMock = vi.fn();
    const mockDevice: DeviceContextType = {
      isConnected: true,
      device: { productId: 0x0027, vendorId: 0x258a, productName: 'XD5 Mouse' } as unknown as HIDDevice,
      transport: 'wireless',
      battery: { power: 85, charging: true },
      logs: [],
      connect: vi.fn(),
      disconnect: disconnectMock,
      sendHandshake: vi.fn().mockResolvedValue(undefined),
      pollBattery: vi.fn().mockResolvedValue(undefined),
      applySettingsToHardware: vi.fn().mockResolvedValue(undefined),
      readSettingsFromHardware: vi.fn().mockResolvedValue(new Uint8Array(181)),
      isConnecting: false,
      isSyncing: false,
      clearLogs: vi.fn(),
      protocol: {} as unknown as XD5Protocol,
      lastEvent: null,
      subscribeDeviceEvent: vi.fn(() => vi.fn()),
    };

    render(
      <DeviceContext.Provider value={mockDevice}>
        <SettingsProvider>
          <Header />
        </SettingsProvider>
      </DeviceContext.Provider>
    );

    expect(screen.getByText('85%')).toBeDefined();
    expect(screen.getByText(/2\.4G/i)).toBeDefined();
    expect(screen.getByTestId('battery-charging-icon')).toBeDefined();

    const disconnectBtn = screen.getByRole('button', { name: /Disconnect/i });
    expect(disconnectBtn).toBeDefined();
    fireEvent.click(disconnectBtn);
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it('renders glowing dirty indicator on Apply button and triggers applyToDevice and readFromDevice', () => {
    const applyMock = vi.fn();
    const readMock = vi.fn();

    const mockSettingsContext: SettingsContextType = {
      settings: createDefaultSettings(),
      isDirty: true,
      updateSettings: vi.fn(),
      resetToDefaults: vi.fn(),
      applyToDevice: applyMock,
      readFromDevice: readMock,
      switchProfile: vi.fn(),
      exportProfileJson: vi.fn(() => '{}'),
      importProfileJson: vi.fn(() => true),
      markClean: vi.fn(),
    };

    const mockDevice: DeviceContextType = {
      isConnected: true,
      device: { productId: 0x0027, vendorId: 0x258a, productName: 'XD5 Mouse' } as unknown as HIDDevice,
      transport: 'wired',
      battery: { power: 100, charging: false },
      logs: [],
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendHandshake: vi.fn().mockResolvedValue(undefined),
      pollBattery: vi.fn().mockResolvedValue(undefined),
      applySettingsToHardware: vi.fn().mockResolvedValue(undefined),
      readSettingsFromHardware: vi.fn().mockResolvedValue(new Uint8Array(181)),
      isConnecting: false,
      isSyncing: false,
      clearLogs: vi.fn(),
      protocol: {} as unknown as XD5Protocol,
      lastEvent: null,
      subscribeDeviceEvent: vi.fn(() => vi.fn()),
    };

    render(
      <DeviceContext.Provider value={mockDevice}>
        <SettingsContext.Provider value={mockSettingsContext}>
          <Header />
        </SettingsContext.Provider>
      </DeviceContext.Provider>
    );

    const applyBtn = screen.getByRole('button', { name: /Apply Settings/i });
    expect(applyBtn.getAttribute('data-dirty')).toBe('true');

    fireEvent.click(applyBtn);
    expect(applyMock).toHaveBeenCalledTimes(1);

    const readBtn = screen.getByRole('button', { name: /Read Device/i });
    fireEvent.click(readBtn);
    expect(readMock).toHaveBeenCalledTimes(1);
  });

  it('renders connecting state correctly', () => {
    const mockDevice: DeviceContextType = {
      isConnected: false,
      device: null,
      transport: 'disconnected',
      battery: null,
      logs: [],
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendHandshake: vi.fn().mockResolvedValue(undefined),
      pollBattery: vi.fn().mockResolvedValue(undefined),
      applySettingsToHardware: vi.fn().mockResolvedValue(undefined),
      readSettingsFromHardware: vi.fn().mockResolvedValue(new Uint8Array(181)),
      isConnecting: true,
      isSyncing: false,
      clearLogs: vi.fn(),
      protocol: {} as unknown as XD5Protocol,
      lastEvent: null,
      subscribeDeviceEvent: vi.fn(() => vi.fn()),
    };

    render(
      <DeviceContext.Provider value={mockDevice}>
        <SettingsProvider>
          <Header />
        </SettingsProvider>
      </DeviceContext.Provider>
    );

    expect(screen.getByText(/CONNECTING\.\.\./i)).toBeDefined();
    const connectBtn = screen.getByRole('button', { name: /Connect Mouse/i });
    expect(connectBtn.hasAttribute('disabled')).toBe(true);
  });

  it('renders hardware profile mode buttons and allows switching profile', () => {
    render(
      <DeviceProvider>
        <SettingsProvider>
          <Header />
        </SettingsProvider>
      </DeviceProvider>
    );

    const mode1Btn = screen.getByRole('button', { name: /Profile Mode 1/i });
    const mode2Btn = screen.getByRole('button', { name: /Profile Mode 2/i });
    const mode3Btn = screen.getByRole('button', { name: /Profile Mode 3/i });

    expect(mode1Btn).toBeDefined();
    expect(mode2Btn).toBeDefined();
    expect(mode3Btn).toBeDefined();
    expect(mode1Btn.getAttribute('data-active')).toBe('true');

    fireEvent.click(mode2Btn);
    expect(mode2Btn.getAttribute('data-active')).toBe('true');
    expect(mode1Btn.getAttribute('data-active')).toBe('false');

    expect(screen.getByRole('button', { name: /Export Profile/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Import Profile/i })).toBeDefined();
  });
});
