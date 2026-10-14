import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDefaultSettings,
  serializeSettingsToEEPROM,
  deserializeSettingsFromEEPROM,
  exportSettingsToJson,
  importSettingsFromJson,
  normalizeKeyBindings,
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
    expect(bytes[EEPROM_ADDR.POLLING_RATE]).toBe(0x02); // 500Hz
    expect(bytes[EEPROM_ADDR.POLLING_RATE + 1]).toBe(0x55 - 0x02); // checksum
    expect(bytes[EEPROM_ADDR.STAGE_COUNT]).toBe(7);
    expect(bytes[EEPROM_ADDR.STAGE_COUNT + 1]).toBe(0x55 - 7); // checksum
    expect(bytes[EEPROM_ADDR.CURRENT_DPI_IDX]).toBe(2);
    expect(bytes[EEPROM_ADDR.CURRENT_DPI_IDX + 1]).toBe(0x55 - 2); // checksum
    expect(bytes[EEPROM_ADDR.LOD]).toBe(2);
    expect(bytes[EEPROM_ADDR.LOD + 1]).toBe(0x55 - 2); // checksum
    expect(bytes[EEPROM_ADDR.DEBOUNCE]).toBe(8);
    expect(bytes[EEPROM_ADDR.DEBOUNCE + 1]).toBe(0x55 - 8); // checksum
    expect(bytes[EEPROM_ADDR.SLEEP_MINUTES]).toBe(15);
    expect(bytes[EEPROM_ADDR.SLEEP_MINUTES + 1]).toBe(0x55 - 15); // checksum

    const recovered = deserializeSettingsFromEEPROM(bytes, initial);
    expect(recovered.profile).toBe(2);
    expect(recovered.pollingRate).toBe(500);
    expect(recovered.lod).toBe(2);
    expect(recovered.debounce).toBe(8);
    expect(recovered.sleepMin).toBe(15);
    expect(recovered.activeDpiStage).toBe(3);
    expect(recovered.dpiStages[0].x).toBe(1200);
    expect(recovered.lighting.mode).toBe(1);
  });

  it('normalizes imported partial profiles without losing omitted DPI stages', () => {
    const imported = importSettingsFromJson('{"dpiStages":[{"x":3200}],"keys":{"key1":"0x53000101"}}');
    expect(imported.dpiStages).toHaveLength(7);
    expect(imported.dpiStages[0].x).toBe(3200);
    expect(imported.dpiStages[1].x).toBe(1600);
    expect(imported.keys.key1).toBe('0x00000101');
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

  it('computes internal modulo-256 checksum for key matrix entries matching OEM driver', () => {
    const settings = createDefaultSettings();
    const bytes = serializeSettingsToEEPROM(settings);
    for (let k = 1; k <= 6; k++) {
      const base = EEPROM_ADDR.KEY_MATRIX + (k - 1) * 4;
      const keySlice = bytes.slice(base, base + 4);
      let sum = 0;
      for (let i = 0; i < 4; i++) {
        sum = (sum + keySlice[i]) & 0xFF;
      }
      expect(sum).toBe(0x55);
    }
  });

  it('computes internal modulo-256 checksum for DPI stage colors matching OEM driver', () => {
    const settings = createDefaultSettings();
    const bytes = serializeSettingsToEEPROM(settings);
    for (let i = 0; i < 7; i++) {
      const base = EEPROM_ADDR.DPI_COLORS + i * 4;
      const colorSlice = bytes.slice(base, base + 4);
      let sum = 0;
      for (let j = 0; j < 4; j++) {
        sum = (sum + colorSlice[j]) & 0xFF;
      }
      expect(sum).toBe(0x55);
    }
  });

  it('deserializes hardware key matrix with per-button internal checksum without corrupting action codes', () => {
    const fakeHwEeprom = new Uint8Array(181);
    fakeHwEeprom[EEPROM_ADDR.POLLING_RATE] = 0x01;
    // Button 1: Left Click (0x01, 0x01, 0x00, checksum 0x53)
    fakeHwEeprom[0x60] = 0x01; fakeHwEeprom[0x61] = 0x01; fakeHwEeprom[0x62] = 0x00; fakeHwEeprom[0x63] = 0x53;
    // Button 2: Right Click (0x01, 0x02, 0x00, checksum 0x52)
    fakeHwEeprom[0x64] = 0x01; fakeHwEeprom[0x65] = 0x02; fakeHwEeprom[0x66] = 0x00; fakeHwEeprom[0x67] = 0x52;
    // Button 3: Middle Click (0x01, 0x04, 0x00, checksum 0x50)
    fakeHwEeprom[0x68] = 0x01; fakeHwEeprom[0x69] = 0x04; fakeHwEeprom[0x6A] = 0x00; fakeHwEeprom[0x6B] = 0x50;
    // Button 4: Back (0x01, 0x08, 0x00, checksum 0x4C)
    fakeHwEeprom[0x6C] = 0x01; fakeHwEeprom[0x6D] = 0x08; fakeHwEeprom[0x6E] = 0x00; fakeHwEeprom[0x6F] = 0x4C;
    // Button 5: Forward (0x01, 0x10, 0x00, checksum 0x44)
    fakeHwEeprom[0x70] = 0x01; fakeHwEeprom[0x71] = 0x10; fakeHwEeprom[0x72] = 0x00; fakeHwEeprom[0x73] = 0x44;
    // Button 6: DPI Loop / DPI + (0x02, 0x01, 0x00, checksum 0x52)
    fakeHwEeprom[0x74] = 0x02; fakeHwEeprom[0x75] = 0x01; fakeHwEeprom[0x76] = 0x00; fakeHwEeprom[0x77] = 0x52;

    const recovered = deserializeSettingsFromEEPROM(fakeHwEeprom);
    expect(recovered.keys.key1).toBe('0x00000101');
    expect(recovered.keys.key2).toBe('0x00000201');
    expect(recovered.keys.key3).toBe('0x00000401');
    expect(recovered.keys.key4).toBe('0x00000801');
    expect(recovered.keys.key5).toBe('0x00001001');
    expect(recovered.keys.key6).toBe('0x00000102');
  });

  it('normalizes key bindings with 4th-byte checksums', () => {
    const normalized = normalizeKeyBindings({
      key1: '0x53000101',
      key2: '0x52000201',
      key3: '0x50000401',
      key4: '0x4c000801',
      key5: '0x44001001',
      key6: '0x52000102',
    });
    expect(normalized.key1).toBe('0x00000101');
    expect(normalized.key2).toBe('0x00000201');
    expect(normalized.key3).toBe('0x00000401');
    expect(normalized.key4).toBe('0x00000801');
    expect(normalized.key5).toBe('0x00001001');
    expect(normalized.key6).toBe('0x00000102');
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
  it('serializes and deserializes extended multimedia keys into 0x100 blocks', () => {
    const settings = createDefaultSettings();
    settings.keys.key4 = '0x0000e905'; // Volume Up (Usage 0x00E9)
    settings.keys.key5 = '0x00019205'; // Calculator (Usage 0x0192)

    const bytes = serializeSettingsToEEPROM(settings);
    expect(bytes.length).toBeGreaterThanOrEqual(0x1c0);

    // Primary matrix at 0x6C (Button 4) and 0x70 (Button 5) must be 0x05 with checksum 0x50
    expect(bytes[0x6c]).toBe(0x05);
    expect(bytes[0x6d]).toBe(0x00);
    expect(bytes[0x6e]).toBe(0x00);
    expect(bytes[0x6f]).toBe(0x50);

    expect(bytes[0x70]).toBe(0x05);
    expect(bytes[0x71]).toBe(0x00);
    expect(bytes[0x72]).toBe(0x00);
    expect(bytes[0x73]).toBe(0x50);

    // Extended block for Button 4 at 0x100 + 3 * 0x20 = 0x160
    // Usage 0x00E9: [count=2, 0x82, 0xE9, 0x00, 0x42, 0xE9, 0x00]
    expect(bytes[0x160]).toBe(0x02);
    expect(bytes[0x161]).toBe(0x82);
    expect(bytes[0x162]).toBe(0xe9);
    expect(bytes[0x163]).toBe(0x00);
    expect(bytes[0x164]).toBe(0x42);
    expect(bytes[0x165]).toBe(0xe9);
    expect(bytes[0x166]).toBe(0x00);
    const extChk4 = (0x55 - 0x02 - 0x82 - 0xe9 - 0x00 - 0x42 - 0xe9 - 0x00) & 0xff;
    expect(bytes[0x167]).toBe(extChk4);

    // Deserialization round-trip
    const recovered = deserializeSettingsFromEEPROM(bytes);
    expect(recovered.keys.key4).toBe('0x0000e905');
    expect(recovered.keys.key5).toBe('0x00019205');
    expect(recovered.keys.key6).toBe('0x00000102');
  });
});
