import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SettingsManager, deserializeSettingsFromEEPROM } from '../core/settings';
import { DeviceContext } from './DeviceContext';
import type { MouseSettings } from '../types/settings';
import type { TimerHandle } from '../types/protocol';
export interface SettingsContextType {
  settings: MouseSettings;
  isDirty: boolean;
  isLoadedFromDevice: boolean;
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
  const [isLoadedFromDevice, setIsLoadedFromDevice] = useState<boolean>(false);
  const prevConnectedRef = useRef<boolean>(false);
  const autoSyncTimerRef = useRef<TimerHandle | null>(null);
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

  const readFromDevice = useCallback(async () => {
    if (!device?.readSettingsFromHardware) {
      throw new Error('DeviceContext is not available.');
    }
    const bytes = await device.readSettingsFromHardware();
    if (!bytes || bytes.length < 181) {
      throw new Error(`Incomplete EEPROM read (${bytes?.length || 0}/181 bytes).`);
    }

    let allZeros = true;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== 0) {
        allZeros = false;
        break;
      }
    }
    if (allZeros) {
      throw new Error('Mouse EEPROM returned empty (all-zero) data. Hardware communication failed.');
    }

    const recovered = deserializeSettingsFromEEPROM(bytes, settings);
    settingsManager.updateSettings(recovered);
    setSettings(recovered);
    setIsDirty(false);
    setIsLoadedFromDevice(true);
  }, [device, settings, settingsManager]);

  // Automatically read all settings from mouse on connect
  useEffect(() => {
    const isNowConnected = Boolean(device?.isConnected);
    if (isNowConnected && !prevConnectedRef.current) {
      readFromDevice().catch((err: unknown) => {
        console.error('Failed to auto-read settings on connect:', err);
      });
    } else if (!isNowConnected) {
      setIsLoadedFromDevice(false);
    }
    prevConnectedRef.current = isNowConnected;
  }, [device?.isConnected, readFromDevice]);

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

        // Auto-sync changes directly to hardware if connected
        if (device?.isConnected && device?.applySettingsToHardware) {
          clearTimeout(autoSyncTimerRef.current as number);
          autoSyncTimerRef.current = setTimeout(() => {
            device.applySettingsToHardware(next)
              .then(() => setIsDirty(false))
              .catch((err: unknown) => console.error('Auto-sync failed:', err));
          }, 150);
        }

        return next;
      });
      setIsDirty(true);
    },
    [device, settingsManager]
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


  const exportProfileJson = useCallback((): string => {
    return JSON.stringify(settings, null, 2);
  }, [settings]);

  const importProfileJson = useCallback(
    (jsonStr: string): boolean => {
      try {
        const parsed = JSON.parse(jsonStr);
        if (!parsed || typeof parsed !== 'object') return false;
        updateSettings(parsed);
        return true;
      } catch {
        return false;
      }
    },
    [updateSettings]
  );

  const value: SettingsContextType = useMemo(
    () => ({
      settings,
      isDirty,
      isLoadedFromDevice,
      updateSettings,
      resetToDefaults,
      applyToDevice,
      readFromDevice,
      exportProfileJson,
      importProfileJson,
      markClean,
    }),
    [
      settings,
      isDirty,
      isLoadedFromDevice,
      updateSettings,
      resetToDefaults,
      applyToDevice,
      readFromDevice,
      exportProfileJson,
      importProfileJson,
      markClean,
    ]
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
