/**
 * FANTECH Helios Go XD5 - Profile Manager & Hardware Serializer
 * Manages multiple profiles, custom profile colors, and binary EEPROM serialization.
 */

import {
  EEPROM_ADDR,
  POLLING_RATES,
  POLLING_CODES,
  BRIGHTNESS_TABLE,
  SPEED_TABLE,
  encodeDpi,
  decodeDpi,
  encodeDpiStage,
  decodeDpiStage,
} from './protocol';
import type {
  Profile,
  ProfileExportPayload,
} from '../types/profile';
import type { EncodedDpi } from '../types/protocol';

export function createDefaultProfile(id: number, name: string, color?: string): Profile {
  const accent = color || '#00e5ff';
  const profile: Profile = {
    id,
    name,
    profileColor: accent,
    pollingRate: 1000,
    lod: 1,
    debounce: 12,
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
    lighting: {
      mode: 0, // Streaming (RGB Spectrum Wave)
      color: accent,
      brightness: 8,
      speed: 5,
    },
    keys: {
      key1: '0x00000101', // Left Click
      key2: '0x00000201', // Right Click
      key3: '0x00000401', // Middle Click
      key4: '0x00000801', // Back
      key5: '0x00001001', // Forward
      key6: '0x00000302', // DPI Loop
    },
  };

  Object.defineProperty(profile, 'debounceTime', {
    get() { return this.debounce; },
    set(v: number) { this.debounce = v; },
    enumerable: false,
    configurable: true,
  });

  Object.defineProperty(profile, 'sleepMinutes', {
    get() { return this.sleepMin; },
    set(v: number) { this.sleepMin = v; },
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(profile, 'sleepTimer', {
    get() { return this.sleepMin; },
    set(v: number) { this.sleepMin = v; },
    enumerable: false,
    configurable: true,
  });


  Object.defineProperty(profile, 'accentColor', {
    get() { return this.profileColor; },
    set(v: string) { this.profileColor = v; },
    enumerable: false,
    configurable: true,
  });

  return profile;
}

export class ProfileManager {
  profiles: Profile[] = [];
  activeIndex: number = 0;
  storageKey: string = 'xd5_dedicated_profiles';
  activeKey: string = 'xd5_dedicated_active_idx';
  hardwareSnapshotBytes: Uint8Array | null = null;
  hardwareBackupProfile: Profile | null = null;

  constructor() {
    this.load();
  }

  dpiToRaw(dpi: number): EncodedDpi {
    return encodeDpi(dpi);
  }

  rawToDpi(raw: number, mul: number): number {
    return decodeDpi(raw, mul);
  }

  load(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.profiles = parsed;
            const savedIdx = parseInt(localStorage.getItem(this.activeKey) || '0', 10);
            this.activeIndex = Math.min(Math.max(0, savedIdx), this.profiles.length - 1);
          }
        }
      }
    } catch {
      this.profiles = [];
    }

    if (!this.profiles || this.profiles.length === 0) {
      this.profiles = [
        createDefaultProfile(0, 'Profile 1 (Default / Balanced)', '#00e5ff'),
        createDefaultProfile(1, 'Profile 2 (Competitive FPS)', '#ff334b'),
        createDefaultProfile(2, 'Profile 3 (MOBA / Strategy)', '#00e676'),
        createDefaultProfile(3, 'Profile 4 (Battery Saver / Office)', '#ffab00'),
      ];
      // Profile 2 FPS customizations
      this.profiles[1].debounce = 4;
      this.profiles[1].lighting.mode = 4; // LED off
      // Profile 4 Battery Saver customizations
      this.profiles[3].pollingRate = 250;
      this.profiles[3].sleepMin = 5;
      this.profiles[3].lighting.mode = 4; // LED off
      this.save();
    }
  }

  save(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.profiles));
        localStorage.setItem(this.activeKey, this.activeIndex.toString());
      } catch {
        // Storage write failures ignored in non-DOM/quota environments
      }
    }
  }

  getActiveProfile(): Profile {
    return this.profiles[this.activeIndex] || this.profiles[0];
  }

  setActiveProfile(index: number): Profile {
    if (index >= 0 && index < this.profiles.length) {
      this.activeIndex = index;
      this.save();
    }
    return this.getActiveProfile();
  }

  addProfile(name?: string, color?: string): Profile {
    const id = this.profiles.length;
    const newProfile = createDefaultProfile(id, name || `Profile ${id + 1}`, color || '#9d4edd');
    this.profiles.push(newProfile);
    this.activeIndex = this.profiles.length - 1;
    this.save();
    return newProfile;
  }

  deleteProfile(index: number): Profile {
    if (this.profiles.length <= 1) {
      throw new Error('Cannot delete the last remaining profile.');
    }
    this.profiles.splice(index, 1);
    this.activeIndex = Math.max(0, Math.min(this.activeIndex, this.profiles.length - 1));
    this.save();
    return this.getActiveProfile();
  }

  renameProfile(index: number, newName: string): void {
    if (this.profiles[index] && newName && newName.trim()) {
      this.profiles[index].name = newName.trim();
      this.save();
    }
  }

  setProfileColor(index: number, color: string): void {
    if (this.profiles[index] && color) {
      this.profiles[index].profileColor = color;
      this.profiles[index].accentColor = color;
      this.save();
    }
  }

  resetProfile(index: number): Profile | undefined {
    const p = this.profiles[index];
    if (p) {
      const fresh = createDefaultProfile(p.id, p.name, p.profileColor);
      this.profiles[index] = fresh;
      this.save();
      return fresh;
    }
    return undefined;
  }

  exportProfileJson(index: number = this.activeIndex): string {
    const p = this.profiles[index] || this.getActiveProfile();
    const payload: ProfileExportPayload = {
      app: 'Fantech Helios Go XD5 Dedicated Web Configurator',
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      profile: p,
    };
    return JSON.stringify(payload, null, 2);
  }

  importProfileJson(jsonString: string): Profile {
    const data = JSON.parse(jsonString);
    const candidate = (data && typeof data === 'object' && 'profile' in data) ? data.profile : data;
    if (!candidate || typeof candidate !== 'object' || !candidate.dpiStages || !candidate.name) {
      throw new Error('Invalid profile file format.');
    }
    const imported = candidate as Profile;
    imported.id = this.profiles.length;
    imported.name = `${imported.name} (Imported)`;
    if (!imported.profileColor) {
      imported.profileColor = '#00e5ff';
    }
    imported.accentColor = imported.profileColor;
    this.profiles.push(imported);
    this.activeIndex = this.profiles.length - 1;
    this.save();
    return imported;
  }

  /**
   * Serializes profile into the exact 181-byte EEPROM memory map (0x00 .. 0xB4)
   */
  serializeProfileToEEPROM(profile: Profile): Uint8Array {
    const buf = new Uint8Array(181);

    // 0x00: Polling Rate
    buf[EEPROM_ADDR.POLLING_RATE] = POLLING_RATES[profile.pollingRate] || 0x01;

    // 0x01: Active Profile Index
    buf[EEPROM_ADDR.ACTIVE_PROFILE] = Math.min(3, Math.max(0, this.activeIndex));

    // 0x02: Active Stage Count
    buf[EEPROM_ADDR.STAGE_COUNT] = profile.dpiStages.filter((s) => s.enabled).length || 1;

    // 0x04: Current DPI Stage index (0..6)
    buf[EEPROM_ADDR.CURRENT_DPI_IDX] = Math.max(0, Math.min(6, profile.activeDpiStage - 1));

    // 0x0A: LOD
    buf[EEPROM_ADDR.LOD] = profile.lod || 1;

    // 0x0C .. 0x27: 7 DPI Stages (4 bytes each = 28 bytes)
    for (let i = 0; i < 7; i++) {
      const st = profile.dpiStages[i] || { x: 800, y: 800 };
      const stageBytes = encodeDpiStage(st.x, st.y);
      buf.set(stageBytes, EEPROM_ADDR.DPI_STAGES + i * 4);
    }

    // 0x2C .. 0x47: 7 DPI Stage Colors (4 bytes each = 28 bytes)
    for (let i = 0; i < 7; i++) {
      const st = profile.dpiStages[i] || { color: '#ff0000' };
      const hex = (st.color || '#ff0000').replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      buf[EEPROM_ADDR.DPI_COLORS + i * 4]     = r;
      buf[EEPROM_ADDR.DPI_COLORS + i * 4 + 1] = g;
      buf[EEPROM_ADDR.DPI_COLORS + i * 4 + 2] = b;
      buf[EEPROM_ADDR.DPI_COLORS + i * 4 + 3] = 0;
    }

    // 0x60 .. 0x77: Key Remapping (6 buttons x 4 bytes LE dword = 24 bytes)
    for (let k = 1; k <= 6; k++) {
      const val = parseInt(profile.keys[`key${k}`] || '0x00000101', 16);
      const base = EEPROM_ADDR.KEY_MATRIX + (k - 1) * 4;
      buf[base]     = val & 0xff;
      buf[base + 1] = (val >> 8) & 0xff;
      buf[base + 2] = (val >> 16) & 0xff;
      buf[base + 3] = (val >> 24) & 0xff;
    }

    // 0xA0 .. 0xA7: Lighting (8 bytes)
    const led = profile.lighting || { mode: 0, color: '#00e5ff', brightness: 8, speed: 5 };
    const ledHex = (led.color || '#00e5ff').replace('#', '');
    const lr = parseInt(ledHex.substring(0, 2), 16) || 0;
    const lg = parseInt(ledHex.substring(2, 4), 16) || 0;
    const lb = parseInt(ledHex.substring(4, 6), 16) || 0;
    const briIdx = Math.max(0, Math.min(9, (led.brightness || 8) - 1));
    const spdIdx = Math.max(0, Math.min(9, (led.speed || 5) - 1));

    buf[EEPROM_ADDR.LIGHTING]     = led.mode !== undefined ? led.mode : 0;
    buf[EEPROM_ADDR.LIGHTING + 1] = lr;
    buf[EEPROM_ADDR.LIGHTING + 2] = lg;
    buf[EEPROM_ADDR.LIGHTING + 3] = lb;
    buf[EEPROM_ADDR.LIGHTING + 4] = SPEED_TABLE[spdIdx];
    buf[EEPROM_ADDR.LIGHTING + 5] = BRIGHTNESS_TABLE[briIdx];
    buf[EEPROM_ADDR.LIGHTING + 6] = 0;
    buf[EEPROM_ADDR.LIGHTING + 7] = 0;

    // 0xA9: Debounce Time
    const resolvedDebounce = profile.debounce ?? profile.debounceTime ?? 12;
    buf[EEPROM_ADDR.DEBOUNCE] = resolvedDebounce;

    // 0xAD: Auto-Sleep Time
    const resolvedSleep = profile.sleepTimer ?? profile.sleepMin ?? profile.sleepMinutes ?? 10;
    buf[EEPROM_ADDR.SLEEP_MINUTES] = resolvedSleep;

    // 0xAF: Angle Snapping
    buf[EEPROM_ADDR.ANGLE_SNAPPING] = profile.angleSnap ? 1 : 0;

    // 0xB1: Ripple Control
    buf[EEPROM_ADDR.RIPPLE_CONTROL] = profile.ripple ? 1 : 0;

    // 0xB3: Turn off light on move
    buf[EEPROM_ADDR.LIGHT_OFF_MOVE] = profile.turnOffOnMove ? 1 : 0;

    return buf;
  }

  serializeEEPROM(profile: Profile = this.getActiveProfile()): Uint8Array {
    return this.serializeProfileToEEPROM(profile);
  }

  /**
   * Deserializes a 181-byte EEPROM dump from mouse into profile state
   */
  deserializeEEPROMToProfile(buf: Uint8Array, targetProfile: Profile = this.getActiveProfile()): Profile {
    if (buf.length < 181) return targetProfile;

    // Polling Rate
    const pCode = buf[EEPROM_ADDR.POLLING_RATE];
    if (POLLING_CODES[pCode]) {
      targetProfile.pollingRate = POLLING_CODES[pCode];
    }

    // LOD
    const lod = buf[EEPROM_ADDR.LOD];
    if (lod === 1 || lod === 2) targetProfile.lod = lod;

    // Debounce
    const debounce = buf[EEPROM_ADDR.DEBOUNCE];
    if (debounce >= 4 && debounce <= 30) {
      targetProfile.debounce = debounce;
      if ('debounceTime' in targetProfile) {
        targetProfile.debounceTime = debounce;
      }
    }

    // Sleep
    const sleep = buf[EEPROM_ADDR.SLEEP_MINUTES];
    if (sleep >= 1 && sleep <= 30) {
      targetProfile.sleepMin = sleep;
      if ('sleepMinutes' in targetProfile) {
        targetProfile.sleepMinutes = sleep;
      }
      if ('sleepTimer' in targetProfile) {
        targetProfile.sleepTimer = sleep;
      }
    }

    // Toggles
    targetProfile.angleSnap = !!buf[EEPROM_ADDR.ANGLE_SNAPPING];
    targetProfile.ripple = !!buf[EEPROM_ADDR.RIPPLE_CONTROL];
    targetProfile.turnOffOnMove = !!buf[EEPROM_ADDR.LIGHT_OFF_MOVE];

    // DPI Stages
    for (let i = 0; i < 7; i++) {
      const stageBytes = buf.subarray(EEPROM_ADDR.DPI_STAGES + i * 4, EEPROM_ADDR.DPI_STAGES + (i + 1) * 4);
      const decoded = decodeDpiStage(stageBytes);
      if (!targetProfile.dpiStages[i]) {
        targetProfile.dpiStages[i] = { enabled: true, x: 800, y: 800, color: '#ffffff' };
      }
      targetProfile.dpiStages[i].x = decoded.xDpi;
      targetProfile.dpiStages[i].y = decoded.yDpi;

      // Color
      const cBase = EEPROM_ADDR.DPI_COLORS + i * 4;
      const r = buf[cBase].toString(16).padStart(2, '0');
      const g = buf[cBase + 1].toString(16).padStart(2, '0');
      const b = buf[cBase + 2].toString(16).padStart(2, '0');
      targetProfile.dpiStages[i].color = `#${r}${g}${b}`;
    }

    // Active Stage Index
    const activeStage = buf[EEPROM_ADDR.CURRENT_DPI_IDX];
    targetProfile.activeDpiStage = activeStage + 1;

    // Lighting
    const lBase = EEPROM_ADDR.LIGHTING;
    const lMode = buf[lBase];
    const lr = buf[lBase + 1].toString(16).padStart(2, '0');
    const lg = buf[lBase + 2].toString(16).padStart(2, '0');
    const lb = buf[lBase + 3].toString(16).padStart(2, '0');
    targetProfile.lighting.mode = lMode;
    targetProfile.lighting.color = `#${lr}${lg}${lb}`;

    // Lighting Speed & Brightness
    const spdByte = buf[lBase + 4];
    const briByte = buf[lBase + 5];
    const spdIdx = SPEED_TABLE.indexOf(spdByte as typeof SPEED_TABLE[number]);
    const briIdx = BRIGHTNESS_TABLE.indexOf(briByte as typeof BRIGHTNESS_TABLE[number]);
    if (spdIdx !== -1) targetProfile.lighting.speed = spdIdx + 1;
    if (briIdx !== -1) targetProfile.lighting.brightness = briIdx + 1;

    // Key Remapping (0x60 .. 0x77)
    for (let k = 1; k <= 6; k++) {
      const base = EEPROM_ADDR.KEY_MATRIX + (k - 1) * 4;
      const b0 = buf[base];
      const b1 = buf[base + 1];
      const b2 = buf[base + 2];
      const b3 = buf[base + 3];
      const val = (b3 << 24) | (b2 << 16) | (b1 << 8) | b0;
      targetProfile.keys[`key${k}`] = '0x' + (val >>> 0).toString(16).padStart(8, '0');
    }

    targetProfile.hwProfileId = buf[EEPROM_ADDR.ACTIVE_PROFILE];
    this.save();
    return targetProfile;
  }

  deserializeEEPROM(buf: Uint8Array, targetProfile: Profile = this.getActiveProfile()): Profile {
    return this.deserializeEEPROMToProfile(buf, targetProfile);
  }

  createHardwareBackup(buf: Uint8Array): Profile {
    const backup = createDefaultProfile(999, 'Original Hardware State (Read on Connect)', '#00e676');
    this.deserializeEEPROMToProfile(buf, backup);
    this.hardwareSnapshotBytes = new Uint8Array(buf);
    this.hardwareBackupProfile = backup;
    return backup;
  }
}
