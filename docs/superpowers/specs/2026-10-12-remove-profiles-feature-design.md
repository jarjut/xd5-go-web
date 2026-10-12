# Design Specification: Removal of Profiles Feature

- **Date:** 2026-10-12
- **Topic:** Remove Profiles Feature & Transition to Single MouseSettings Architecture
- **Status:** Approved for Implementation

---

## 1. Background & Motivation

The original OEM driver (`OemDrv.exe`) for the Fantech Helios Go XD5 gaming mouse does not support arbitrary profile management (multiple custom-named profiles, profile color branding, adding, deleting, renaming profiles, or JSON profile export/import). 

The web configurator previously contained an artificial multi-profile layer (`ProfileBar`, `ProfileContext`, `ProfileManager`, profile accent colors) which does not exist in the official application and creates unnecessary complexity. 

This change completely removes the profiles feature, replacing it with a single, unified `MouseSettings` configuration model.

---

## 2. Architecture & Data Model

### 2.1 Types (`src/types/settings.ts`)

Replace `Profile` type with `MouseSettings`:

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

Delete:
- `src/types/profile.ts`
- Profile metadata (`id`, `name`, `profileColor`, `accentColor`, `ProfileExportPayload`).

### 2.2 Core Logic & EEPROM Serialization (`src/core/settings.ts`)

Implement `SettingsManager` and standalone serialization functions:
- `createDefaultSettings(): MouseSettings`
- `serializeSettingsToEEPROM(settings: MouseSettings): Uint8Array`
- `deserializeSettingsFromEEPROM(bytes: Uint8Array): MouseSettings`
- Local persistence key: `'xd5_mouse_settings'` (stores the active single `MouseSettings` object directly).

Delete:
- `src/core/profiles.ts`
- `js/profiles.js` (or update/clean up legacy JS if referenced)

### 2.3 Context Layer (`src/context/SettingsContext.tsx`)

Provide `SettingsContext` and `useSettings()` hook:

```typescript
export interface SettingsContextType {
  settings: MouseSettings;
  isDirty: boolean;
  updateSettings: (updates: Partial<MouseSettings>) => void;
  resetToDefaults: () => void;
  applyToDevice: () => Promise<void>;
  readFromDevice: () => Promise<void>;
}
```

- Loads from `localStorage['xd5_mouse_settings']` or falls back to `createDefaultSettings()`.
- Updates persist to `localStorage` and flag `isDirty = true`.
- `applyToDevice()` serializes `settings` to EEPROM, writes to hardware, commits flash, and sets `isDirty = false`.
- `readFromDevice()` reads EEPROM from hardware, deserializes into `settings`, updates `localStorage`, and sets `isDirty = false`.

---

## 3. Component & UI Changes

### 3.1 Deleted Files & Styles
- Delete `src/components/layout/ProfileBar.tsx`.
- Remove `--profile-accent` from `src/index.css`.

### 3.2 Header (`src/components/layout/Header.tsx`)
- Remove `showProfileBar` prop and `<ProfileBar />` rendering.
- Change button label from `"Read Profile"` to `"Read Device"`.
- Switch from `useProfiles()` to `useSettings()`.

### 3.3 Panels
- **`DpiPanel.tsx`**: Consume `useSettings()`. Read stages and update via `updateSettings({ dpiStages: ..., activeDpiStage: ... })`.
- **`LightingPanel.tsx`**: Consume `useSettings()`. Remove the "Match Profile Accent" button and logic.
- **`SensorPanel.tsx`**: Consume `useSettings()`. Bind sliders and toggles directly to `settings` and `updateSettings`.
- **`KeyRemapPanel.tsx`**: Consume `useSettings()`. Bind button key assignments to `settings.keys`.

### 3.4 Visual Stage (`MouseStage.tsx` & `MouseSvg.tsx`)
- Consume `useSettings()`.
- Remove `profileColor` prop.
- LED glow and diffuser render from `settings.lighting.color` (or default theme color `#00e5ff` if unconfigured).

### 3.5 App Shell (`src/App.tsx`)
- Wrap WorkbenchShell with `<SettingsProvider>` instead of `<ProfileProvider>`.
- Remove `showProfileBar={true}` from `<Header />`.

---

## 4. Hardware Synchronization (`DeviceContext.tsx`)

- Replace `applyProfileToHardware` with `applySettingsToHardware(settings: MouseSettings)`.
- Replace `readProfileFromHardware` with `readSettingsFromHardware(): Promise<Uint8Array>`.
- Remove invocation of `setHardwareProfile` / command `0x10` from normal flow (can remain in low-level `protocol.ts` for diagnostic reference only).

---

## 5. Verification & Testing

- Delete `src/tests/profiles.test.ts` and create `src/tests/settings.test.ts` verifying default creation, serialization, and deserialization.
- Update test wrappers in:
  - `src/tests/Header.test.tsx`
  - `src/tests/DpiPanel.test.tsx`
  - `src/tests/Panels.test.tsx`
  - `src/tests/MouseStage.test.tsx`
  - `src/tests/contexts.test.tsx`
  - `src/tests/App.test.tsx`
- Ensure all Vitest tests run and pass cleanly.
