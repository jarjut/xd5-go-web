import {
  EEPROM_ADDR,
  POLLING_RATES,
  POLLING_CODES,
  BRIGHTNESS_TABLE,
  SPEED_TABLE,
  encodeDpiStage,
  decodeDpiStage,
} from './protocol';
import type { MouseSettings, DpiStage, KeyBindings, LightingSettings } from '../types/settings';

export const DEFAULT_DPI_STAGES: DpiStage[] = [
  { enabled: true, x: 800, y: 800, color: '#ff0000' },
  { enabled: true, x: 1600, y: 1600, color: '#0000ff' },
  { enabled: true, x: 2000, y: 2000, color: '#00ff00' },
  { enabled: true, x: 2400, y: 2400, color: '#ff00ff' },
  { enabled: true, x: 3200, y: 3200, color: '#00ffff' },
  { enabled: true, x: 5000, y: 5000, color: '#ff8000' },
  { enabled: true, x: 19000, y: 19000, color: '#ffffff' },
];

export const DEFAULT_KEYS: KeyBindings = {
  key1: '0x00000101', // Left Click
  key2: '0x00000201', // Right Click
  key3: '0x00000401', // Middle Click
  key4: '0x00000801', // Back
  key5: '0x00001001', // Forward
  key6: '0x00000302', // DPI Loop
};

export const DEFAULT_LIGHTING: LightingSettings = {
  mode: 0,
  color: '#00e5ff',
  brightness: 8,
  speed: 5,
};

export function createDefaultSettings(): MouseSettings {
  return {
    pollingRate: 1000,
    lod: 1,
    debounce: 12,
    sleepMin: 10,
    ripple: false,
    angleSnap: false,
    turnOffOnMove: true,
    activeDpiStage: 1,
    separateXY: false,
    dpiStages: DEFAULT_DPI_STAGES.map((s) => ({ ...s })),
    lighting: { ...DEFAULT_LIGHTING },
    keys: { ...DEFAULT_KEYS },
  };
}

export function serializeSettingsToEEPROM(settings: MouseSettings): Uint8Array {
  const buf = new Uint8Array(181);

  buf[EEPROM_ADDR.POLLING_RATE] = POLLING_RATES[settings.pollingRate] || 0x01;
  buf[EEPROM_ADDR.ACTIVE_PROFILE] = 0x00;
  buf[EEPROM_ADDR.STAGE_COUNT] = settings.dpiStages.filter((s) => s.enabled).length || 1;
  buf[EEPROM_ADDR.CURRENT_DPI_IDX] = Math.max(0, Math.min(6, settings.activeDpiStage - 1));
  buf[EEPROM_ADDR.LOD] = settings.lod || 1;

  for (let i = 0; i < 7; i++) {
    const st = settings.dpiStages[i] || { x: 800, y: 800 };
    const stageBytes = encodeDpiStage(st.x, st.y);
    buf.set(stageBytes, EEPROM_ADDR.DPI_STAGES + i * 4);
  }

  for (let i = 0; i < 7; i++) {
    const st = settings.dpiStages[i] || { color: '#ff0000' };
    const hex = (st.color || '#ff0000').replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    buf[EEPROM_ADDR.DPI_COLORS + i * 4] = r;
    buf[EEPROM_ADDR.DPI_COLORS + i * 4 + 1] = g;
    buf[EEPROM_ADDR.DPI_COLORS + i * 4 + 2] = b;
    buf[EEPROM_ADDR.DPI_COLORS + i * 4 + 3] = 0;
  }

  for (let k = 1; k <= 6; k++) {
    const val = parseInt(settings.keys[`key${k}`] || '0x00000101', 16);
    const base = EEPROM_ADDR.KEY_MATRIX + (k - 1) * 4;
    buf[base] = val & 0xff;
    buf[base + 1] = (val >> 8) & 0xff;
    buf[base + 2] = (val >> 16) & 0xff;
    buf[base + 3] = (val >> 24) & 0xff;
  }

  const led = settings.lighting || DEFAULT_LIGHTING;
  const ledHex = (led.color || '#00e5ff').replace('#', '');
  const lr = parseInt(ledHex.substring(0, 2), 16) || 0;
  const lg = parseInt(ledHex.substring(2, 4), 16) || 0;
  const lb = parseInt(ledHex.substring(4, 6), 16) || 0;
  const briIdx = Math.max(0, Math.min(9, (led.brightness || 8) - 1));
  const spdIdx = Math.max(0, Math.min(9, (led.speed || 5) - 1));

  buf[EEPROM_ADDR.LIGHTING] = led.mode !== undefined ? led.mode : 0;
  buf[EEPROM_ADDR.LIGHTING + 1] = lr;
  buf[EEPROM_ADDR.LIGHTING + 2] = lg;
  buf[EEPROM_ADDR.LIGHTING + 3] = lb;
  buf[EEPROM_ADDR.LIGHTING + 4] = SPEED_TABLE[spdIdx];
  buf[EEPROM_ADDR.LIGHTING + 5] = BRIGHTNESS_TABLE[briIdx];
  buf[EEPROM_ADDR.LIGHTING + 6] = 0;
  buf[EEPROM_ADDR.LIGHTING + 7] = 0;

  buf[EEPROM_ADDR.DEBOUNCE] = settings.debounce ?? 12;
  buf[EEPROM_ADDR.SLEEP_MINUTES] = settings.sleepMin ?? 10;
  buf[EEPROM_ADDR.ANGLE_SNAPPING] = settings.angleSnap ? 1 : 0;
  buf[EEPROM_ADDR.RIPPLE_CONTROL] = settings.ripple ? 1 : 0;
  buf[EEPROM_ADDR.LIGHT_OFF_MOVE] = settings.turnOffOnMove ? 1 : 0;

  return buf;
}

export function deserializeSettingsFromEEPROM(
  buf: Uint8Array,
  targetSettings: MouseSettings = createDefaultSettings()
): MouseSettings {
  if (buf.length < 181) return targetSettings;

  const result: MouseSettings = {
    ...targetSettings,
    dpiStages: targetSettings.dpiStages.map((s) => ({ ...s })),
    lighting: { ...targetSettings.lighting },
    keys: { ...targetSettings.keys },
  };

  const pCode = buf[EEPROM_ADDR.POLLING_RATE];
  if (POLLING_CODES[pCode]) {
    result.pollingRate = POLLING_CODES[pCode];
  }

  const lod = buf[EEPROM_ADDR.LOD];
  if (lod === 1 || lod === 2) result.lod = lod;

  const debounce = buf[EEPROM_ADDR.DEBOUNCE];
  if (debounce >= 4 && debounce <= 30) {
    result.debounce = debounce;
  }

  const sleep = buf[EEPROM_ADDR.SLEEP_MINUTES];
  if (sleep >= 1 && sleep <= 60) {
    result.sleepMin = sleep;
  }

  result.angleSnap = buf[EEPROM_ADDR.ANGLE_SNAPPING] === 1;
  result.ripple = buf[EEPROM_ADDR.RIPPLE_CONTROL] === 1;
  result.turnOffOnMove = buf[EEPROM_ADDR.LIGHT_OFF_MOVE] === 1;

  const stageCount = Math.max(1, Math.min(7, buf[EEPROM_ADDR.STAGE_COUNT]));
  const activeIdx = Math.max(0, Math.min(6, buf[EEPROM_ADDR.CURRENT_DPI_IDX]));
  result.activeDpiStage = activeIdx + 1;

  for (let i = 0; i < 7; i++) {
    const rawStage = buf.subarray(EEPROM_ADDR.DPI_STAGES + i * 4, EEPROM_ADDR.DPI_STAGES + (i + 1) * 4);
    const decoded = decodeDpiStage(rawStage);
    const r = buf[EEPROM_ADDR.DPI_COLORS + i * 4];
    const g = buf[EEPROM_ADDR.DPI_COLORS + i * 4 + 1];
    const b = buf[EEPROM_ADDR.DPI_COLORS + i * 4 + 2];
    const colorHex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

    result.dpiStages[i] = {
      enabled: i < stageCount,
      x: decoded.xDpi,
      y: decoded.yDpi,
      color: colorHex,
    };
  }

  for (let k = 1; k <= 6; k++) {
    const base = EEPROM_ADDR.KEY_MATRIX + (k - 1) * 4;
    const dword =
      buf[base] |
      (buf[base + 1] << 8) |
      (buf[base + 2] << 16) |
      (buf[base + 3] << 24);
    result.keys[`key${k}`] = '0x' + (dword >>> 0).toString(16).padStart(8, '0');
  }

  const mode = buf[EEPROM_ADDR.LIGHTING];
  const lr = buf[EEPROM_ADDR.LIGHTING + 1];
  const lg = buf[EEPROM_ADDR.LIGHTING + 2];
  const lb = buf[EEPROM_ADDR.LIGHTING + 3];
  const spdByte = buf[EEPROM_ADDR.LIGHTING + 4];
  const briByte = buf[EEPROM_ADDR.LIGHTING + 5];

  const spdIdx = SPEED_TABLE.indexOf(spdByte);
  const briIdx = BRIGHTNESS_TABLE.indexOf(briByte);

  result.lighting = {
    mode,
    color: `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`,
    speed: spdIdx >= 0 ? spdIdx + 1 : 5,
    brightness: briIdx >= 0 ? briIdx + 1 : 8,
  };

  return result;
}

export class SettingsManager {
  settings: MouseSettings;
  storageKey: string = 'xd5_mouse_settings';

  constructor() {
    this.settings = createDefaultSettings();
    this.load();
  }

  load(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            this.settings = { ...this.settings, ...parsed };
          }
        }
      } catch {
        // Ignored
      }
    }
  }

  save(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
      } catch {
        // Ignored
      }
    }
  }

  getSettings(): MouseSettings {
    return this.settings;
  }

  updateSettings(updates: Partial<MouseSettings>): MouseSettings {
    this.settings = {
      ...this.settings,
      ...updates,
      lighting: updates.lighting ? { ...this.settings.lighting, ...updates.lighting } : this.settings.lighting,
      keys: updates.keys ? { ...this.settings.keys, ...updates.keys } : this.settings.keys,
    };
    this.save();
    return this.settings;
  }

  resetToDefaults(): MouseSettings {
    this.settings = createDefaultSettings();
    this.save();
    return this.settings;
  }
}
