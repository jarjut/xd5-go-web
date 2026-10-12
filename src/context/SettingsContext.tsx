import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { SettingsManager, deserializeSettingsFromEEPROM } from '../core/settings';
import { DeviceContext } from './DeviceContext';
import type { MouseSettings } from '../types/settings';

export interface SettingsContextType {
  settings: MouseSettings;
  isDirty: boolean;
  updateSettings: (updates: Partial<MouseSettings>) => void;
  resetToDefaults: () => void;
  applyToDevice: () => Promise<void>;
  readFromDevice: () => Promise<void>;
  markClean: () => void;
}

export const SettingsContext = createContext<SettingsContextType | null>(null);

export interface SettingsProviderProps {
  children: React.ReactNode;
  manager?: SettingsManager;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({
  children,
  manager: customManager,
}) => {
  const device = useContext(DeviceContext);
  const settingsManager = useMemo(() => customManager || new SettingsManager(), [customManager]);

  const [settings, setSettings] = useState<MouseSettings>(() => settingsManager.getSettings());
  const [isDirty, setIsDirty] = useState<boolean>(false);

  useEffect(() => {
    if (!device?.subscribeDeviceEvent) return;
    return device.subscribeDeviceEvent((event) => {
      if (event.type === 'dpi_change' && typeof event.stage === 'number') {
        const nextStage = event.stage;
        setSettings((prev) => {
          if (prev.activeDpiStage === nextStage) return prev;
          const next = { ...prev, activeDpiStage: nextStage };
          settingsManager.updateSettings({ activeDpiStage: nextStage });
          return next;
        });
      }
    });
  }, [device?.subscribeDeviceEvent, settingsManager]);

  const updateSettings = useCallback(
    (updates: Partial<MouseSettings>) => {
      setSettings((prev) => {
        const next: MouseSettings = {
          ...prev,
          ...updates,
          lighting: updates.lighting ? { ...prev.lighting, ...updates.lighting } : prev.lighting,
          keys: updates.keys ? { ...prev.keys, ...updates.keys } : prev.keys,
        };
        settingsManager.updateSettings(next);
        return next;
      });
      setIsDirty(true);
    },
    [settingsManager]
  );

  const resetToDefaults = useCallback(() => {
    const defaults = settingsManager.resetToDefaults();
    setSettings(defaults);
    setIsDirty(true);
  }, [settingsManager]);

  const markClean = useCallback(() => {
    setIsDirty(false);
  }, []);

  const applyToDevice = useCallback(async () => {
    if (!device?.applySettingsToHardware) {
      throw new Error('DeviceContext is not available.');
    }
    await device.applySettingsToHardware(settings);
    setIsDirty(false);
  }, [device, settings]);

  const readFromDevice = useCallback(async () => {
    if (!device?.readSettingsFromHardware) {
      throw new Error('DeviceContext is not available.');
    }
    const bytes = await device.readSettingsFromHardware();
    if (bytes && bytes.length >= 181) {
      const recovered = deserializeSettingsFromEEPROM(bytes, settings);
      settingsManager.updateSettings(recovered);
      setSettings(recovered);
      setIsDirty(false);
    }
  }, [device, settings, settingsManager]);

  const value: SettingsContextType = useMemo(
    () => ({
      settings,
      isDirty,
      updateSettings,
      resetToDefaults,
      applyToDevice,
      readFromDevice,
      markClean,
    }),
    [settings, isDirty, updateSettings, resetToDefaults, applyToDevice, readFromDevice, markClean]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
