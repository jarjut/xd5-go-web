import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProfileManager,
  createDefaultProfile,
} from '../core/profiles';
import {
  EEPROM_ADDR,
  POLLING_RATES,
} from '../core/protocol';
import type { Profile } from '../types/profile';

describe('ProfileManager & EEPROM Serialization', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('creates default profile with expected keys, 7 DPI stages, and lighting settings', () => {
    const p = createDefaultProfile(0, 'Default Profile', '#00e5ff');
    expect(p.id).toBe(0);
    expect(p.name).toBe('Default Profile');
    expect(p.profileColor).toBe('#00e5ff');
    expect(p.pollingRate).toBe(1000);
    expect(p.lod).toBe(1);
    expect(p.debounce).toBe(12);
    expect(p.debounceTime).toBe(12);
    expect(p.sleepMin).toBe(10);
    expect(p.sleepMinutes).toBe(10);
    expect(p.ripple).toBe(false);
    expect(p.angleSnap).toBe(false);
    expect(p.turnOffOnMove).toBe(true);
    expect(p.activeDpiStage).toBe(1);
    expect(p.dpiStages.length).toBe(7);
    expect(p.lighting.mode).toBe(0);
    expect(p.keys.key1).toBe('0x00000101');
    expect(p.keys.key6).toBe('0x00000302');
  });

  it('initializes 4 default profiles in ProfileManager', () => {
    const pm = new ProfileManager();
    expect(pm.profiles.length).toBe(4);
    expect(pm.activeIndex).toBe(0);
    expect(pm.getActiveProfile().name).toContain('Default');
  });

  it('manages profile lifecycle: add, rename, color, delete, reset', () => {
    const pm = new ProfileManager();
    const initialCount = pm.profiles.length;

    // Add profile
    const added = pm.addProfile('Sniper Config', '#ff0055');
    expect(pm.profiles.length).toBe(initialCount + 1);
    expect(pm.activeIndex).toBe(pm.profiles.length - 1);
    expect(added.name).toBe('Sniper Config');
    expect(added.profileColor).toBe('#ff0055');

    // Rename active profile
    pm.renameProfile(pm.activeIndex, 'Pro Sniper');
    expect(pm.getActiveProfile().name).toBe('Pro Sniper');

    // Set color
    pm.setProfileColor(pm.activeIndex, '#123456');
    expect(pm.getActiveProfile().profileColor).toBe('#123456');

    // Reset profile
    pm.resetProfile(pm.activeIndex);
    expect(pm.getActiveProfile().name).toBe('Pro Sniper');
    expect(pm.getActiveProfile().debounce).toBe(12);

    // Delete profile
    pm.deleteProfile(pm.activeIndex);
    expect(pm.profiles.length).toBe(initialCount);

    // Cannot delete last remaining profile
    while (pm.profiles.length > 1) {
      pm.deleteProfile(0);
    }
    expect(() => pm.deleteProfile(0)).toThrow('Cannot delete the last remaining profile');
  });

  it('supports JSON export and import round-trip', () => {
    const pm = new ProfileManager();
    const exportedJson = pm.exportProfileJson(0);
    const parsed = JSON.parse(exportedJson);

    expect(parsed.app).toContain('Fantech');
    expect(parsed.profile).toBeDefined();

    const imported = pm.importProfileJson(exportedJson);
    expect(imported.name).toContain('(Imported)');
    expect(pm.profiles.includes(imported)).toBe(true);
  });

  it('serializes profile to exact 181-byte EEPROM memory map', () => {
    const pm = new ProfileManager();
    const profile = pm.getActiveProfile();
    profile.pollingRate = 500;
    profile.lod = 2;
    profile.debounce = 8;
    profile.sleepMin = 15;
    profile.angleSnap = true;
    profile.ripple = true;
    profile.turnOffOnMove = false;
    profile.activeDpiStage = 3;

    const eeprom = pm.serializeProfileToEEPROM(profile);
    expect(eeprom.length).toBe(181);

    // Polling rate: 500Hz -> 0x02
    expect(eeprom[EEPROM_ADDR.POLLING_RATE]).toBe(POLLING_RATES[500]);
    // Active Profile: 0..3
    expect(eeprom[EEPROM_ADDR.ACTIVE_PROFILE]).toBe(pm.activeIndex);
    // LOD: 2
    expect(eeprom[EEPROM_ADDR.LOD]).toBe(2);
    // Active DPI stage: 3 -> index 2
    expect(eeprom[EEPROM_ADDR.CURRENT_DPI_IDX]).toBe(2);
    // Debounce: 8
    expect(eeprom[EEPROM_ADDR.DEBOUNCE]).toBe(8);
    // Sleep: 15
    expect(eeprom[EEPROM_ADDR.SLEEP_MINUTES]).toBe(15);
    // Angle snap: 1
    expect(eeprom[EEPROM_ADDR.ANGLE_SNAPPING]).toBe(1);
    // Ripple: 1
    expect(eeprom[EEPROM_ADDR.RIPPLE_CONTROL]).toBe(1);
    // Light off move: 0
    expect(eeprom[EEPROM_ADDR.LIGHT_OFF_MOVE]).toBe(0);
  });

  it('performs 100% byte-accurate EEPROM serialization and deserialization round-trip', () => {
    const pm = new ProfileManager();
    const customProfile: Profile = createDefaultProfile(2, 'Test Roundtrip', '#ff00aa');
    customProfile.pollingRate = 500;
    customProfile.lod = 2;
    customProfile.debounce = 16;
    customProfile.debounceTime = 16;
    customProfile.sleepMin = 20;
    customProfile.sleepMinutes = 20;
    customProfile.angleSnap = true;
    customProfile.ripple = true;
    customProfile.turnOffOnMove = false;
    customProfile.activeDpiStage = 4;
    customProfile.dpiStages[0] = { enabled: true, x: 400, y: 400, color: '#ff0000' };
    customProfile.dpiStages[1] = { enabled: true, x: 800, y: 800, color: '#00ff00' };
    customProfile.dpiStages[2] = { enabled: true, x: 1200, y: 1200, color: '#0000ff' };
    customProfile.dpiStages[3] = { enabled: true, x: 2400, y: 2400, color: '#ffff00' };
    customProfile.dpiStages[4] = { enabled: true, x: 3200, y: 3200, color: '#00ffff' };
    customProfile.dpiStages[5] = { enabled: true, x: 6400, y: 6400, color: '#ff00ff' };
    customProfile.dpiStages[6] = { enabled: true, x: 16000, y: 16000, color: '#ffffff' };
    customProfile.keys.key1 = '0x00000201'; // Right Click mapped to key 1
    customProfile.keys.key2 = '0x00000101'; // Left Click mapped to key 2
    customProfile.lighting.mode = 2; // Steady
    customProfile.lighting.color = '#112233';
    customProfile.lighting.speed = 3;
    customProfile.lighting.brightness = 7;

    const rawEEPROM = pm.serializeProfileToEEPROM(customProfile);
    expect(rawEEPROM.length).toBe(181);

    const target = createDefaultProfile(99, 'Reconstructed', '#000000');
    const restored = pm.deserializeEEPROMToProfile(rawEEPROM, target);

    expect(restored.pollingRate).toBe(500);
    expect(restored.lod).toBe(2);
    expect(restored.debounce).toBe(16);
    expect(restored.sleepMin).toBe(20);
    expect(restored.angleSnap).toBe(true);
    expect(restored.ripple).toBe(true);
    expect(restored.turnOffOnMove).toBe(false);
    expect(restored.activeDpiStage).toBe(4);

    expect(restored.dpiStages[0].x).toBe(400);
    expect(restored.dpiStages[0].color.toLowerCase()).toBe('#ff0000');
    expect(restored.dpiStages[6].x).toBe(16000);
    expect(restored.dpiStages[6].color.toLowerCase()).toBe('#ffffff');

    expect(restored.keys.key1).toBe('0x00000201');
    expect(restored.keys.key2).toBe('0x00000101');
    expect(restored.lighting.mode).toBe(2);
    expect(restored.lighting.color.toLowerCase()).toBe('#112233');
    expect(restored.lighting.speed).toBe(3);
    expect(restored.lighting.brightness).toBe(7);
  });

  it('creates hardware backup snapshot profile and retains raw bytes', () => {
    const pm = new ProfileManager();
    const baseEEPROM = pm.serializeProfileToEEPROM(pm.getActiveProfile());
    const backup = pm.createHardwareBackup(baseEEPROM);

    expect(backup.id).toBe(999);
    expect(backup.name).toContain('Original Hardware State');
    expect(pm.hardwareSnapshotBytes).toBeDefined();
    expect(pm.hardwareSnapshotBytes?.length).toBe(181);
    expect(pm.hardwareBackupProfile).toBe(backup);
  });
});
