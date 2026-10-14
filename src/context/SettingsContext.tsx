import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { HardwareSync } from '../core/hardwareSync';
import { SettingsSession } from '../core/settingsSession';
import { DeviceContext } from './DeviceContext';
import type { MouseSettings } from '../types/settings';

export interface SettingsContextType {
  settings: MouseSettings;
  isDirty: boolean;
  isLoadedFromDevice: boolean;
  isReading: boolean;
  isSyncing: boolean;
  error: string | null;
  updateSettings: (updates: Partial<MouseSettings>) => void;
  resetToDefaults: () => void;
  applyToDevice: () => Promise<void>;
  readFromDevice: () => Promise<void>;
  exportProfileJson: () => string;
  importProfileJson: (jsonStr: string) => boolean;
  markClean: () => void;
}

export const SettingsContext = createContext<SettingsContextType | null>(null);

export interface SettingsProviderProps {
  children: React.ReactNode;
  session?: SettingsSession;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children, session: customSession }) => {
  const device = useContext(DeviceContext);
  const session = useMemo(() => customSession || new SettingsSession(), [customSession]);
  const hardware = useMemo(() => device ? device.hardwareSync || new HardwareSync(device.protocol) : null, [device?.hardwareSync, device?.protocol]);
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);

  useEffect(() => {
    // A real DeviceContext always controls readiness, even with an injected session.
    if (!hardware) return;
    if (device?.isConnected) void session.connect(hardware).catch(() => {});
    else session.disconnect();
    return () => { session.disconnect(); };
  }, [device?.isConnected, device?.device, device?.connectionId, hardware, session]);
  useEffect(() => {
    if (!device?.subscribeDeviceEvent) return;
    return device.subscribeDeviceEvent((event) => {
      if (event.type === 'dpi_change' && typeof event.stage === 'number') {
        session.receiveDpiStage(event.stage);
      } else if (event.type === 'polling_rate_change' && typeof event.pollingRate === 'number') {
        session.receivePollingRate(event.pollingRate);
      } else if (event.type === 'profile_change' && typeof event.profileIndex === 'number') {
        session.receiveProfile(event.profileIndex);
      }
    });
  }, [device?.subscribeDeviceEvent, session]);

  const value = useMemo<SettingsContextType>(() => ({
    ...snapshot,
    updateSettings: session.updateSettings,
    resetToDefaults: session.resetToDefaults,
    applyToDevice: session.applyToDevice,
    readFromDevice: session.readFromDevice,
    exportProfileJson: session.exportProfileJson,
    importProfileJson: session.importProfileJson,
    markClean: session.markClean,
  }), [snapshot, session]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
}
