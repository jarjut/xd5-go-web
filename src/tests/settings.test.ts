import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDefaultSettings,
  serializeSettingsToEEPROM,
  deserializeSettingsFromEEPROM,
  SettingsManager,
} from '../core/settings';
import { EEPROM_ADDR } from '../core/protocol';

describe('Settings Core & EEPROM Serialization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates default settings with factory parameters', () => {
    const settings = createDefaultSettings();
    expect(settings.pollingRate).toBe(1000);
    expect(settings.lod).toBe(1);
    expect(settings.debounce).toBe(12);
    expect(settings.sleepMin).toBe(10);
    expect(settings.activeDpiStage).toBe(1);
    expect(settings.dpiStages.length).toBe(7);
    expect(settings.lighting.mode).toBe(0);
    expect(settings.keys.key1).toBe('0x00000101');
  });

  it('serializes and deserializes settings round-trip', () => {
    const initial = createDefaultSettings();
    initial.pollingRate = 500;
    initial.lod = 2;
    initial.debounce = 8;
    initial.sleepMin = 15;
    initial.activeDpiStage = 3;
    initial.dpiStages[0].x = 1200;
    initial.dpiStages[0].y = 1200;
    initial.lighting.mode = 1;
    initial.lighting.color = '#ff0055';

    const bytes = serializeSettingsToEEPROM(initial);
    expect(bytes.length).toBe(181);
    expect(bytes[EEPROM_ADDR.POLLING_RATE]).toBe(0x02); // 500Hz
    expect(bytes[EEPROM_ADDR.LOD]).toBe(2);
    expect(bytes[EEPROM_ADDR.DEBOUNCE]).toBe(8);
    expect(bytes[EEPROM_ADDR.SLEEP_MINUTES]).toBe(15);
    expect(bytes[EEPROM_ADDR.CURRENT_DPI_IDX]).toBe(2);

    const recovered = deserializeSettingsFromEEPROM(bytes);
    expect(recovered.pollingRate).toBe(500);
    expect(recovered.lod).toBe(2);
    expect(recovered.debounce).toBe(8);
    expect(recovered.sleepMin).toBe(15);
    expect(recovered.activeDpiStage).toBe(3);
    expect(recovered.dpiStages[0].x).toBe(1200);
    expect(recovered.lighting.mode).toBe(1);
  });

  it('persists and loads settings via SettingsManager', () => {
    const manager = new SettingsManager();
    const settings = manager.getSettings();
    expect(settings.pollingRate).toBe(1000);

    manager.updateSettings({ debounce: 4, sleepMin: 5 });
    expect(manager.getSettings().debounce).toBe(4);

    const reloaded = new SettingsManager();
    expect(reloaded.getSettings().debounce).toBe(4);
    expect(reloaded.getSettings().sleepMin).toBe(5);
  });
});
