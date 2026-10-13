import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDefaultSettings,
  serializeSettingsToEEPROM,
  deserializeSettingsFromEEPROM,
  SettingsManager,
  exportSettingsToJson,
  importSettingsFromJson,
} from '../core/settings';
import {
  EEPROM_ADDR,
  LED_MODES,
  STREAMING_SPEED_TABLE,
  STREAMING_BRIGHTNESS_TABLE,
} from '../core/protocol';


describe('Settings Core & EEPROM Serialization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates default settings with factory parameters', () => {
    const settings = createDefaultSettings();
    expect(settings.profile).toBe(0);
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
    initial.profile = 2; // Mode 3
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
    expect(bytes[EEPROM_ADDR.ACTIVE_PROFILE]).toBe(2);
    expect(bytes[EEPROM_ADDR.POLLING_RATE]).toBe(0x02); // 500Hz
    expect(bytes[EEPROM_ADDR.LOD]).toBe(2);
    expect(bytes[EEPROM_ADDR.DEBOUNCE]).toBe(8);
    expect(bytes[EEPROM_ADDR.SLEEP_MINUTES]).toBe(15);
    expect(bytes[EEPROM_ADDR.CURRENT_DPI_IDX]).toBe(2);

    const recovered = deserializeSettingsFromEEPROM(bytes);
    expect(recovered.profile).toBe(2);
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

  it('serializes and deserializes streaming mode with OEM specific speed and brightness tables', () => {
    const settings = createDefaultSettings();
    settings.lighting.mode = LED_MODES.STREAMING;
    settings.lighting.speed = 3; // level 3 -> STREAMING_SPEED_TABLE[2] = 8
    settings.lighting.brightness = 4; // level 4 -> STREAMING_BRIGHTNESS_TABLE[3] = 132

    const bytes = serializeSettingsToEEPROM(settings);
    expect(bytes[EEPROM_ADDR.LIGHTING]).toBe(LED_MODES.STREAMING);
    expect(bytes[EEPROM_ADDR.LIGHTING + 4]).toBe(STREAMING_SPEED_TABLE[2]);
    expect(bytes[EEPROM_ADDR.LIGHTING + 5]).toBe(STREAMING_BRIGHTNESS_TABLE[3]);

    const recovered = deserializeSettingsFromEEPROM(bytes);
    expect(recovered.lighting.mode).toBe(LED_MODES.STREAMING);
    expect(recovered.lighting.speed).toBe(3);
    expect(recovered.lighting.brightness).toBe(4);
  });

  it('computes internal modulo-256 checksum for lighting block matching OEM driver', () => {
    const settings = createDefaultSettings();
    settings.lighting.mode = LED_MODES.BREATHING;
    settings.lighting.color = '#ff8800';
    settings.lighting.speed = 5;
    settings.lighting.brightness = 8;

    const bytes = serializeSettingsToEEPROM(settings);
    const ledSlice = bytes.slice(EEPROM_ADDR.LIGHTING, EEPROM_ADDR.LIGHTING + 7);
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      sum = (sum + ledSlice[i]) & 0xFF;
    }
    expect(sum).toBe(0x55);
  });
  it('exports and imports profile settings JSON reliably', () => {
    const original = createDefaultSettings();
    original.profile = 1;
    original.debounce = 4;
    original.dpiStages[0].x = 3200;

    const json = exportSettingsToJson(original);
    const imported = importSettingsFromJson(json);

    expect(imported.profile).toBe(1);
    expect(imported.debounce).toBe(4);
    expect(imported.dpiStages[0].x).toBe(3200);
  });
});
