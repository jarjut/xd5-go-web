import {
  EEPROM_ADDR,
  POLLING_RATES,
  POLLING_CODES,
  BRIGHTNESS_TABLE,
  SPEED_TABLE,
  STREAMING_SPEED_TABLE,
  STREAMING_BRIGHTNESS_TABLE,
  LED_MODES,
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

export function normalizeKeyBindings(keys: KeyBindings): KeyBindings {
  const normalized: KeyBindings = { ...keys };
  for (let k = 1; k <= 6; k++) {
    const keyName = `key${k}`;
    const raw = keys[keyName] || DEFAULT_KEYS[keyName];
    const num = parseInt(raw, 16);
    if (!isNaN(num)) {
      normalized[keyName] = '0x' + ((num & 0x00ffffff) >>> 0).toString(16).padStart(8, '0');
    }
  }
  return normalized;
};

export const DEFAULT_LIGHTING: LightingSettings = {
  mode: 0,
  color: '#00e5ff',
  brightness: 8,
  speed: 5,
};

export function createDefaultSettings(): MouseSettings {
  return {
    profile: 0,
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

export const DEFAULT_EEPROM_TEMPLATE = new Uint8Array([
  0x01, 0x54, 0x04, 0x51, 0x01, 0x54, 0x00, 0x55, 0x00, 0x55, 0x01, 0x54,
  0x0f, 0x0f, 0x00, 0x37, 0x17, 0x17, 0x00, 0x27, 0x1f, 0x1f, 0x00, 0x17,
  0xc7, 0xc7, 0x00, 0xc7, 0x3f, 0x3f, 0x00, 0xd7, 0x63, 0x63, 0x00, 0x8f,
  0xbd, 0xbd, 0x22, 0xb9, 0xbd, 0xbd, 0x22, 0xb9,
  0x00, 0x80, 0xff, 0xd6, 0x00, 0xff, 0xff, 0x56, 0xff, 0x80, 0x00, 0xd6,
  0xff, 0x00, 0x00, 0x56, 0x00, 0xff, 0xff, 0x57, 0xff, 0xff, 0x00, 0x57,
  0xff, 0xff, 0xff, 0x58, 0xff, 0xff, 0xff, 0x58,
  0x01, 0x54, 0x80, 0xd5, 0x03, 0x52, 0x00, 0x55,
  0xff, 0x00, 0xff, 0x57, 0x00, 0x55, 0x80, 0xd5, 0x03, 0x52, 0x00, 0x55,
  0x01, 0x01, 0x00, 0x53, 0x01, 0x02, 0x00, 0x52, 0x01, 0x04, 0x00, 0x50,
  0x01, 0x08, 0x00, 0x4c, 0x01, 0x10, 0x00, 0x44, 0x02, 0x01, 0x00, 0x52,
  0x04, 0x0a, 0x03, 0x44, 0x08, 0x00, 0x00, 0x4d, 0x07, 0x00, 0x00, 0x4e,
  0x02, 0x02, 0x00, 0x51, 0x02, 0x03, 0x00, 0x50, 0x00, 0x00, 0x00, 0x55,
  0x00, 0x00, 0x00, 0x55, 0x00, 0x00, 0x00, 0x55, 0x00, 0x00, 0x00, 0x55,
  0x00, 0x00, 0x00, 0x55,
  0x00, 0x00, 0xe5, 0xff, 0x06, 0xd4, 0x97, 0x00,
  0x55,
  0x0c, 0x49,
  0x00, 0x55,
  0x0a, 0x4b,
  0x00, 0x55,
  0x00, 0x55,
  0x01, 0x54,
]);

export function serializeSettingsToEEPROM(
  settings: MouseSettings,
  baseBuffer?: Uint8Array
): Uint8Array {
  const buf = new Uint8Array(181);
  if (baseBuffer && baseBuffer.length >= 181) {
    buf.set(baseBuffer.subarray(0, 181));
  } else {
    buf.set(DEFAULT_EEPROM_TEMPLATE);
  }
  const pRateCode = POLLING_RATES[settings.pollingRate] || 0x01;
  buf[EEPROM_ADDR.POLLING_RATE] = pRateCode;
  buf[EEPROM_ADDR.POLLING_RATE + 1] = (0x55 - pRateCode) & 0xff;

  const stageCount = Math.max(1, Math.min(7, settings.dpiStages.filter((s) => s.enabled).length || 1));
  buf[EEPROM_ADDR.STAGE_COUNT] = stageCount;
  buf[EEPROM_ADDR.STAGE_COUNT + 1] = (0x55 - stageCount) & 0xff;

  const currentDpiIdx = Math.max(0, Math.min(6, settings.activeDpiStage - 1));
  buf[EEPROM_ADDR.CURRENT_DPI_IDX] = currentDpiIdx;
  buf[EEPROM_ADDR.CURRENT_DPI_IDX + 1] = (0x55 - currentDpiIdx) & 0xff;

  buf[6] = 0x00;
  buf[7] = 0x55;
  buf[8] = 0x00;
  buf[9] = 0x55;

  const lod = settings.lod || 1;
  buf[EEPROM_ADDR.LOD] = lod;
  buf[EEPROM_ADDR.LOD + 1] = (0x55 - lod) & 0xff;
  for (let i = 0; i < 7; i++) {
    const st = settings.dpiStages[i] || { x: 800, y: 800 };
    const stageBytes = encodeDpiStage(st.x, st.y);
    buf.set(stageBytes, EEPROM_ADDR.DPI_STAGES + i * 4);
  }
  buf.set(encodeDpiStage(19000, 19000), EEPROM_ADDR.DPI_STAGES + 7 * 4);

  for (let i = 0; i < 7; i++) {
    const st = settings.dpiStages[i] || { color: '#ff0000' };
    const hex = (st.color || '#ff0000').replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const chk = (0x55 - r - g - b) & 0xff;
    buf[EEPROM_ADDR.DPI_COLORS + i * 4] = r;
    buf[EEPROM_ADDR.DPI_COLORS + i * 4 + 1] = g;
    buf[EEPROM_ADDR.DPI_COLORS + i * 4 + 2] = b;
    buf[EEPROM_ADDR.DPI_COLORS + i * 4 + 3] = chk;
  }
  buf[EEPROM_ADDR.DPI_COLORS + 7 * 4] = 0xff;
  buf[EEPROM_ADDR.DPI_COLORS + 7 * 4 + 1] = 0xff;
  buf[EEPROM_ADDR.DPI_COLORS + 7 * 4 + 2] = 0xff;
  buf[EEPROM_ADDR.DPI_COLORS + 7 * 4 + 3] = 0x58;

  for (let k = 1; k <= 6; k++) {
    const val = parseInt(settings.keys[`key${k}`] || '0x00000101', 16);
    const base = EEPROM_ADDR.KEY_MATRIX + (k - 1) * 4;
    const b0 = val & 0xff;
    const b1 = (val >> 8) & 0xff;
    const b2 = (val >> 16) & 0xff;
    const chk = (0x55 - b0 - b1 - b2) & 0xff;
    buf[base] = b0;
    buf[base + 1] = b1;
    buf[base + 2] = b2;
    buf[base + 3] = chk;
  }

  const led = settings.lighting || DEFAULT_LIGHTING;
  const ledHex = (led.color || '#00e5ff').replace('#', '');
  const lr = parseInt(ledHex.substring(0, 2), 16) || 0;
  const lg = parseInt(ledHex.substring(2, 4), 16) || 0;
  const lb = parseInt(ledHex.substring(4, 6), 16) || 0;
  const briIdx = Math.max(0, Math.min(9, (led.brightness || 8) - 1));
  const spdIdx = Math.max(0, Math.min(9, (led.speed || 5) - 1));

  const mode = led.mode !== undefined ? led.mode : 0;
  const spdByte = mode === LED_MODES.STREAMING
    ? STREAMING_SPEED_TABLE[spdIdx]
    : SPEED_TABLE[spdIdx];
  const briByte = mode === LED_MODES.STREAMING
    ? STREAMING_BRIGHTNESS_TABLE[briIdx]
    : BRIGHTNESS_TABLE[briIdx];

  // Internal checksum for Lighting: sum(bytes[0..6]) == 0x55 (mod 256) (OemDrv.exe VA 0x40fe17..0x40fe47)
  const chk = (0x55 - mode - lr - lg - lb - spdByte - briByte) & 0xff;

  buf[EEPROM_ADDR.LIGHTING] = mode;
  buf[EEPROM_ADDR.LIGHTING + 1] = lr;
  buf[EEPROM_ADDR.LIGHTING + 2] = lg;
  buf[EEPROM_ADDR.LIGHTING + 3] = lb;
  buf[EEPROM_ADDR.LIGHTING + 4] = spdByte;
  buf[EEPROM_ADDR.LIGHTING + 5] = briByte;
  buf[EEPROM_ADDR.LIGHTING + 6] = chk;
  buf[EEPROM_ADDR.LIGHTING + 7] = 0;

  buf[0xA8] = 0x55;
  const debounce = settings.debounce ?? 12;
  buf[EEPROM_ADDR.DEBOUNCE] = debounce;
  buf[EEPROM_ADDR.DEBOUNCE + 1] = (0x55 - debounce) & 0xff;

  buf[0xAB] = 0x00;
  buf[0xAC] = 0x55;

  const sleepMin = settings.sleepMin ?? 10;
  buf[EEPROM_ADDR.SLEEP_MINUTES] = sleepMin;
  buf[EEPROM_ADDR.SLEEP_MINUTES + 1] = (0x55 - sleepMin) & 0xff;

  const angleSnap = settings.angleSnap ? 1 : 0;
  buf[EEPROM_ADDR.ANGLE_SNAPPING] = angleSnap;
  buf[EEPROM_ADDR.ANGLE_SNAPPING + 1] = (0x55 - angleSnap) & 0xff;

  const ripple = settings.ripple ? 1 : 0;
  buf[EEPROM_ADDR.RIPPLE_CONTROL] = ripple;
  buf[EEPROM_ADDR.RIPPLE_CONTROL + 1] = (0x55 - ripple) & 0xff;

  const turnOffOnMove = settings.turnOffOnMove ? 1 : 0;
  buf[EEPROM_ADDR.LIGHT_OFF_MOVE] = turnOffOnMove;
  buf[EEPROM_ADDR.LIGHT_OFF_MOVE + 1] = (0x55 - turnOffOnMove) & 0xff;
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

  result.profile = Math.max(0, Math.min(2, targetSettings.profile ?? 0));

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
    const b0 = buf[base];
    const b1 = buf[base + 1];
    const b2 = buf[base + 2];
    // The 4th byte is the per-button checksum (sum mod 256 == 0x55), not part of key action code
    const dword = (b0 | (b1 << 8) | (b2 << 16)) >>> 0;
    result.keys[`key${k}`] = '0x' + dword.toString(16).padStart(8, '0');
  }

  const mode = buf[EEPROM_ADDR.LIGHTING];
  const lr = buf[EEPROM_ADDR.LIGHTING + 1];
  const lg = buf[EEPROM_ADDR.LIGHTING + 2];
  const lb = buf[EEPROM_ADDR.LIGHTING + 3];
  const spdByte = buf[EEPROM_ADDR.LIGHTING + 4];
  const briByte = buf[EEPROM_ADDR.LIGHTING + 5];

  let spdIdx = -1;
  let briIdx = -1;
  if (mode === LED_MODES.STREAMING) {
    spdIdx = (STREAMING_SPEED_TABLE as readonly number[]).indexOf(spdByte);
    briIdx = (STREAMING_BRIGHTNESS_TABLE as readonly number[]).indexOf(briByte);
  } else {
    spdIdx = (SPEED_TABLE as readonly number[]).indexOf(spdByte);
    briIdx = (BRIGHTNESS_TABLE as readonly number[]).indexOf(briByte);
  }

  result.lighting = {
    mode,
    color: `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`,
    speed: spdIdx >= 0 ? spdIdx + 1 : 5,
    brightness: briIdx >= 0 ? briIdx + 1 : 8,
  };

  return result;
}


export function exportSettingsToJson(settings: MouseSettings): string {
  return JSON.stringify(settings, null, 2);
}

export function importSettingsFromJson(jsonStr: string): MouseSettings {
  const parsed: unknown = JSON.parse(jsonStr);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Profile must be a settings object.');
  }
  const updates = parsed as Partial<MouseSettings>;
  const base = createDefaultSettings();
  if (updates.dpiStages !== undefined && (!Array.isArray(updates.dpiStages) || updates.dpiStages.length === 0)) {
    throw new Error('Profile DPI stages must be a nonempty array.');
  }
  return {
    ...base,
    ...updates,
    profile: typeof updates.profile === 'number' ? Math.max(0, Math.min(2, updates.profile)) : base.profile,
    dpiStages: updates.dpiStages
      ? base.dpiStages.map((stage, index) => ({ ...stage, ...updates.dpiStages?.[index] }))
      : base.dpiStages,
    lighting: updates.lighting ? { ...base.lighting, ...updates.lighting } : base.lighting,
    keys: updates.keys ? normalizeKeyBindings({ ...base.keys, ...updates.keys }) : base.keys,
  };
}
