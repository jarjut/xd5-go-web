# Remove Profiles Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove multi-profile management features and transition the application to a single MouseSettings model matching the original Fantech Helios Go XD5 application scope.

**Architecture:** Replace multi-profile state with a unified `MouseSettings` model and `SettingsContext`, remove `ProfileBar` and profile styling/metadata, update all configuration panels and the mouse visualizer stage, and adapt WebHID EEPROM synchronization.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS, WebHID API, Vitest 3.0

**Spec:** `docs/superpowers/specs/2026-10-12-remove-profiles-feature-design.md`

## Global Constraints

- Complete removal of profile naming, adding, deleting, switching, and JSON profile export/import.
- No unused types or dead files (`ProfileBar.tsx`, `ProfileContext.tsx`, `profile.ts`, `profiles.ts`).
- Full compatibility with the 181-byte EEPROM memory map defined in `protocol.ts`.
- Retain all functional hardware controls: 7-stage DPI, RGB lighting, Sensor settings (polling rate, LOD, debounce, sleep, ripple, angle snap), and 6-button remapping.
- All vitest test suites must pass without regressions.

---

### Task 1: Core Data Models & EEPROM Serializer

**Files:**
- Create: `src/types/settings.ts`
- Create: `src/core/settings.ts`
- Create: `src/tests/settings.test.ts`
- Delete: `src/types/profile.ts`
- Delete: `src/core/profiles.ts`
- Delete: `src/tests/profiles.test.ts`

**Interfaces:**
- Produces:
  - `MouseSettings`, `DpiStage`, `LightingSettings`, `KeyBindings` from `src/types/settings.ts`
  - `createDefaultSettings(): MouseSettings`
  - `serializeSettingsToEEPROM(settings: MouseSettings): Uint8Array`
  - `deserializeSettingsFromEEPROM(buf: Uint8Array, target?: MouseSettings): MouseSettings`
  - `SettingsManager` from `src/core/settings.ts`

- [ ] **Step 1: Write the failing unit tests for settings serialization**

Create `src/tests/settings.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/settings.test.ts`
Expected: FAIL with missing module `../core/settings`.

- [ ] **Step 3: Implement `src/types/settings.ts` and `src/core/settings.ts`**

Create `src/types/settings.ts`:
```typescript
export interface DpiStage {
  enabled: boolean;
  x: number;
  y: number;
  color: string;
}

export interface LightingSettings {
  mode: number;
  color: string;
  brightness: number;
  speed: number;
}

export interface KeyBindings {
  key1: string;
  key2: string;
  key3: string;
  key4: string;
  key5: string;
  key6: string;
  [key: string]: string;
}

export interface MouseSettings {
  pollingRate: number;
  lod: number;
  debounce: number;
  sleepMin: number;
  ripple: boolean;
  angleSnap: boolean;
  turnOffOnMove: boolean;
  activeDpiStage: number;
  separateXY: boolean;
  dpiStages: DpiStage[];
  lighting: LightingSettings;
  keys: KeyBindings;
}
```

Create `src/core/settings.ts`:
```typescript
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
      x: decoded.x,
      y: decoded.y,
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Delete dead profile files and commit**

Delete `src/tests/profiles.test.ts`, `src/types/profile.ts`, `src/core/profiles.ts`, and `js/profiles.js`.
```bash
git rm src/tests/profiles.test.ts src/types/profile.ts src/core/profiles.ts js/profiles.js
git add src/types/settings.ts src/core/settings.ts src/tests/settings.test.ts
git commit -m "feat(core): implement MouseSettings core and remove profile models"
```

---

### Task 2: Update DeviceContext Hardware Transport

**Files:**
- Modify: `src/context/DeviceContext.tsx`

**Interfaces:**
- Consumes: `MouseSettings`, `serializeSettingsToEEPROM` from `src/core/settings.ts`
- Produces:
  - `applySettingsToHardware: (settings: MouseSettings) => Promise<void>`
  - `readSettingsFromHardware: () => Promise<Uint8Array>`

- [ ] **Step 1: Update `src/context/DeviceContext.tsx`**

Replace:
```typescript
applyProfileToHardware: (profile: Profile) => Promise<void>;
readProfileFromHardware: () => Promise<Uint8Array>;
```
With:
```typescript
applySettingsToHardware: (settings: MouseSettings) => Promise<void>;
readSettingsFromHardware: () => Promise<Uint8Array>;
```

In implementation:
```typescript
const applySettingsToHardware = useCallback(
  async (settings: MouseSettings) => {
    if (!protocol.isConnected) {
      throw new Error('Mouse is not connected.');
    }
    setIsSyncing(true);
    try {
      const bytes = serializeSettingsToEEPROM(settings);
      await protocol.writeEEPROM(0x00, bytes);
      await protocol.commitFlash();
      protocol.log('Settings successfully applied to hardware and committed to flash.', 'in');
    } finally {
      setIsSyncing(false);
    }
  },
  [protocol]
);

const readSettingsFromHardware = useCallback(async (): Promise<Uint8Array> => {
  if (!protocol.isConnected) {
    throw new Error('Mouse is not connected.');
  }
  setIsSyncing(true);
  try {
    const bytes = await protocol.readEEPROM(0x00, 181);
    protocol.log(`Read ${bytes.length} bytes from hardware EEPROM.`, 'in');
    return bytes;
  } finally {
    setIsSyncing(false);
  }
}, [protocol]);
```

- [ ] **Step 2: Commit**

```bash
git add src/context/DeviceContext.tsx
git commit -m "refactor(device): adapt DeviceContext to serialize MouseSettings"
```

---

### Task 3: Implement SettingsContext & Update Contexts Test

**Files:**
- Create: `src/context/SettingsContext.tsx`
- Delete: `src/context/ProfileContext.tsx`
- Modify: `src/tests/contexts.test.tsx`

**Interfaces:**
- Consumes: `MouseSettings`, `SettingsManager`, `deserializeSettingsFromEEPROM` from `src/core/settings.ts`, `DeviceContext`
- Produces:
  - `SettingsContext`, `SettingsProvider`, `useSettings()`
  - `SettingsContextType`

- [ ] **Step 1: Write `src/context/SettingsContext.tsx`**

Create `src/context/SettingsContext.tsx`:
```typescript
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
        const next = {
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
```

- [ ] **Step 2: Update `src/tests/contexts.test.tsx`**

Replace `ProfileContext` testing with `SettingsContext`:
- Verify `useSettings` initial defaults
- Verify `updateSettings` updates state and flags `isDirty`
- Verify `resetToDefaults` restores defaults
- Verify `applyToDevice` calls `device.applySettingsToHardware`
- Verify `readFromDevice` calls `device.readSettingsFromHardware` and updates `settings`

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run src/tests/contexts.test.tsx`
Expected: PASS.

- [ ] **Step 4: Delete `src/context/ProfileContext.tsx` and commit**

```bash
git rm src/context/ProfileContext.tsx
git add src/context/SettingsContext.tsx src/tests/contexts.test.tsx
git commit -m "feat(context): add SettingsContext and remove ProfileContext"
```

---

### Task 4: Layout & Header Refactoring

**Files:**
- Delete: `src/components/layout/ProfileBar.tsx`
- Modify: `src/index.css`
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/tests/Header.test.tsx`

**Interfaces:**
- Header consumes `useSettings()` from `src/context/SettingsContext.tsx`

- [ ] **Step 1: Remove `ProfileBar.tsx` and clean `src/index.css`**

Delete `src/components/layout/ProfileBar.tsx`.
In `src/index.css`, delete:
```css
:root {
  --profile-accent: #00e5ff;
}
```

- [ ] **Step 2: Update `src/components/layout/Header.tsx`**

- Remove import of `useProfiles` and `ProfileBar`.
- Import `useSettings` from `../../context/SettingsContext`.
- Remove `showProfileBar` from `HeaderProps`.
- In Header buttons: change "Read Profile" label to "Read Device".
- Change `applyToDevice` and `readFromDevice` calls to use `useSettings()`.

- [ ] **Step 3: Update `src/tests/Header.test.tsx`**

- Replace `ProfileProvider` with `SettingsProvider`.
- Assert on text "Read Device" instead of "Read Profile".
- Remove test cases relating to profile switching or ProfileBar.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/Header.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git rm src/components/layout/ProfileBar.tsx
git add src/index.css src/components/layout/Header.tsx src/tests/Header.test.tsx
git commit -m "refactor(layout): remove ProfileBar and update Header to use SettingsContext"
```

---

### Task 5: Panels Refactoring & Panel Tests

**Files:**
- Modify: `src/components/panels/DpiPanel.tsx`
- Modify: `src/components/panels/LightingPanel.tsx`
- Modify: `src/components/panels/SensorPanel.tsx`
- Modify: `src/components/panels/KeyRemapPanel.tsx`
- Modify: `src/components/panels/DiagnosticsPanel.tsx`
- Modify: `src/tests/DpiPanel.test.tsx`
- Modify: `src/tests/Panels.test.tsx`

**Interfaces:**
- Panels consume `useSettings()` from `src/context/SettingsContext.tsx`

- [ ] **Step 1: Refactor `DpiPanel.tsx`**

- Replace `useProfiles` with `useSettings`.
- `const { settings, updateSettings } = useSettings();`
- Replace `activeProfile.dpiStages` with `settings.dpiStages`.
- Replace `activeProfile.activeDpiStage` with `settings.activeDpiStage`.
- Replace `activeProfile.separateXY` with `settings.separateXY`.
- Replace `updateActiveProfile` with `updateSettings`.

- [ ] **Step 2: Refactor `LightingPanel.tsx`**

- Replace `useProfiles` with `useSettings`.
- Remove "Match Profile Accent" button and handler `onMatchProfileAccent`.
- Bind `settings.lighting` and `updateSettings({ lighting: ... })`.

- [ ] **Step 3: Refactor `SensorPanel.tsx` and `KeyRemapPanel.tsx`**

- Replace `useProfiles` with `useSettings`.
- Bind sensor values (`pollingRate`, `lod`, `debounce`, `sleepMin`, `ripple`, `angleSnap`, `turnOffOnMove`) directly to `settings`.
- In `KeyRemapPanel.tsx`, bind keys to `settings.keys` and update via `updateSettings({ keys: ... })`.

- [ ] **Step 4: Update `DiagnosticsPanel.tsx`**

Update `DEFAULT_BANNER`:
```typescript
const DEFAULT_BANNER = `Fantech Helios Go XD5 WebHID Protocol Initialized.
Target VID: 0x25A7 | PID: 0xFA7B (Wired) / 0xFA7C (2.4G Wireless)
Packet Spec: 17 Bytes Feature Reports (Report ID: 0x08, Checksum: sum mod 256 = 0x55)
Settings Management: Persistent in LocalStorage & Synchronized with Hardware EEPROM.`;
```

- [ ] **Step 5: Update `src/tests/DpiPanel.test.tsx` and `src/tests/Panels.test.tsx`**

- Wrap rendered components in `<SettingsProvider>` instead of `<ProfileProvider>`.
- Remove test asserting "Match Profile Accent".

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/tests/DpiPanel.test.tsx src/tests/Panels.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/panels/ src/tests/DpiPanel.test.tsx src/tests/Panels.test.tsx
git commit -m "refactor(panels): migrate panels to useSettings and remove profile accent"
```

---

### Task 6: Visual Stage, App Shell, & Final Verification

**Files:**
- Modify: `src/components/stage/MouseSvg.tsx`
- Modify: `src/components/stage/MouseStage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/tests/MouseStage.test.tsx`
- Modify: `src/tests/App.test.tsx`

**Interfaces:**
- `MouseStage` consumes `useSettings()` from `src/context/SettingsContext.tsx`
- `App` wraps `WorkbenchShell` in `SettingsProvider`

- [ ] **Step 1: Refactor `MouseSvg.tsx` and `MouseStage.tsx`**

In `MouseSvg.tsx`:
- Remove `profileColor` from `MouseSvgProps`.
- LED color uses `lighting?.color || '#00e5ff'`.

In `MouseStage.tsx`:
- Replace `ProfileContext` with `SettingsContext`.
- Remove `FALLBACK_PROFILE` and use `DEFAULT_SETTINGS`.
- Glow and LED strip use `settings.lighting?.color || '#00e5ff'`.
- Button sublabels read from `settings.keys`.

- [ ] **Step 2: Refactor `App.tsx`**

- Replace `<ProfileProvider>` with `<SettingsProvider>`.
- Remove `showProfileBar={true}` from `<Header />`.

- [ ] **Step 3: Update `src/tests/MouseStage.test.tsx` and `src/tests/App.test.tsx`**

- Wrap in `<SettingsProvider>`.
- Remove any references to `ProfileManager` in tests, replace with `SettingsManager`.
- Ensure all tests assert correct stages, buttons, and responsive views.

- [ ] **Step 4: Run full test suite and build verification**

Run: `npm test && npm run build`
Expected: All tests pass, build succeeds with 0 TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/stage/ src/App.tsx src/tests/MouseStage.test.tsx src/tests/App.test.tsx
git commit -m "feat: complete profiles removal and finalize SettingsProvider integration"
```
