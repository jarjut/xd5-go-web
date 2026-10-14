# Repository Guidelines

## Project Overview

A dedicated browser-based configuration utility for the **FANTECH Helios Go XD5** wireless gaming mouse (PixArt PAW3370 optical sensor + Areson MCU). Built entirely from static binary disassembly and dynamic reverse-engineering of the OEM driver (`OemDrv.exe`). Runs directly in Chromium browsers via the W3C WebHID API without native drivers, background agents, or vendor software.

Supports both connectivity modes:
- **Wired Type-C Mode**: `VID 0x25A7`, `PID 0xFA7B`
- **2.4 GHz Wireless Dongle**: `VID 0x25A7`, `PID 0xFA7C`

---

## Architecture & Data Flow

```
UI Panel / Interactive SVG (e.g. DpiPanel, KeyRemapPanel)
  │  updateSettings({ ... })
  ▼
SettingsSession (`src/core/settingsSession.ts`)
  │  • Clones state optimistically, bumps revision, marks isDirty = true
  │  • Notifies subscribers via useSyncExternalStore
  │  • Debounces hardware write (150 ms)
  ▼
HardwareSync (`src/core/hardwareSync.ts`)
  │  • Serializes execution onto a FIFO promise chain (`tail`)
  │  • Generation fencing guards against stale connection instances
  │  • Serializes settings to 181-byte EEPROM layout (`serializeSettingsToEEPROM`)
  │  • Differential scan against `baselineBytes` using REGISTER_BLOCKS
  ▼
XD5Protocol (`src/core/protocol.ts`)
  │  • Splits modified byte spans into <=10 byte chunks
  │  • Constructs 17-byte Feature Report (Report ID 0x08, CMD, payload, Checksum)
  │  • Calculates Modulo-256 checksum: sum(packet[0..16]) == 0x55
  ▼
WebHID API (`navigator.hid`)
  │  • device.sendFeatureReport(0x08, payload16) (16 bytes, excluding reportId)
  ▼
Areson MCU Hardware Storage
  ├── SRAM Shadow EEPROM (CMD 0x07 WriteEEPROM): <1 ms, live sensor & LED registers
  └── SPI NOR Flash (CMD 0x09 CommitFlash): 50–100 ms stall, persistent on-board memory
```

### Critical Architectural Invariants
1. **Two-Tier Storage Separation**:
   - Routine adjustments (DPI, lighting, buttons, debounce) write strictly to **SRAM Shadow EEPROM via CMD `0x07`**.
   - **CMD `0x09` (CommitFlash)** triggers a hardware sector erase that freezes mouse polling for ~50–100 ms; it is executed **only** during explicit manual flash commit or factory reset.
2. **Session-Bound State (No LocalStorage for Settings)**:
   - Mouse settings are held strictly in-memory during active connections.
   - Refreshing, disconnecting, or reconnecting wipes pending edits and starts with a fresh read from hardware registers.
   - Only UI appearance theme (`dark` / `light`) is stored in `localStorage`.
3. **Connection Gating (Ready State)**:
   - UI controls remain disabled until the initial 181-byte hardware read completes successfully (`isLoadedFromDevice === true`).

---

## Key Directories

```
xd5-go-web/
├── docs/             # Technical specifications & reverse engineering references
├── src/
│   ├── components/   # UI view layer: panels, shell layout, interactive SVG mouse
│   │   ├── layout/   # Header, ConnectionScreen, SyncBar, TabNav, ProfileTools
│   │   ├── panels/   # DpiPanel, LightingPanel, KeyRemapPanel, SensorPanel, DiagnosticsPanel
│   │   └── stage/    # MouseStage, MouseSvg, HotspotPin (SVG mouse rendering)
│   ├── context/      # React contexts: DeviceContext, SettingsContext, ThemeContext
│   ├── core/         # Core business logic: protocol, serialization, hardware sync, session
│   ├── tests/        # Vitest unit, integration, and UI component test suites
│   └── types/        # TypeScript interfaces for protocol, settings, and WebHID
```

---

## Development Commands

All tasks use standard `npm` scripts:

```bash
# Start local development server with Vite (default port: 3000)
npm run dev

# Type-check with tsc and build production bundle into dist/
npm run build

# Run Vitest test suite once across all 12 test files
npm test

# Preview production build locally
npm run preview
```

*Note: No standalone linter is configured. Type correctness and unused symbol rules are strictly enforced during `npm run build` via `tsc`.*

---

## Code Conventions & Common Patterns

### 1. Relative Imports Only (No Path Aliases)
Neither `tsconfig.json` nor `vite.config.ts` configures path aliases. Always use relative paths:
```typescript
// Correct
import { XD5Protocol } from '../core/protocol';
import { useSettings } from '../context/SettingsContext';

// Incorrect (will fail compilation)
import { XD5Protocol } from '@/core/protocol';
```

### 2. TypeScript Strictness
- `strict: true`, `noUnusedLocals: true`, and `noUnusedParameters: true` are enabled.
- Unused variables or unused imported symbols will fail `npm run build`. Prefix intentionally unused arguments with an underscore (e.g., `_event`).

### 3. Naming Conventions
- **Components & Contexts**: PascalCase (`DpiPanel.tsx`, `DeviceContext.tsx`, `SettingsSession`).
- **Utilities & Helpers**: camelCase (`serializeSettingsToEEPROM`, `encodeDpiStage`, `calculateChecksum`).
- **Hardware Constants & Opcodes**: UPPER_SNAKE_CASE (`CMD_WRITE_EEPROM`, `REPORT_ID`, `EEPROM_ADDR`).
- **Domain Terminology** (see `GLOSSARY.md`):
  - Use **"mouse settings"** (not "profile") when describing the complete device configuration.
  - Use **"session draft"** for in-memory uncommitted edits.
  - Use **"pending edits"** (not "saved changes" until verified written to hardware).

### 4. Hardware Packet Framing & Checksum Calculation
All USB HID feature reports are fixed **17 bytes**:
$$\sum_{i=0}^{16} \text{Packet}[i] \equiv 0x55 \pmod{256}$$
$$\text{Packet}[16] = \left( 0x55 - \sum_{i=0}^{15} \text{Packet}[i] \right) \ \& \ 0xFF$$

When sending via WebHID:
```typescript
// packet17 has Report ID 0x08 at index 0 and Checksum at index 16
const packet17 = buildPacket(CMD_WRITE_EEPROM, payload);
// sendFeatureReport expects bytes 1..16 (excluding Report ID)
await device.sendFeatureReport(0x08, packet17.slice(1));
```

### 5. Asynchronous Hardware Pacing & Retries
- **Write Retries**: Feature reports allow up to 3 attempts with a **50 ms** delay between failures.
- **Read Pacing**: When fetching sequential 10-byte chunks from EEPROM, insert a **10 ms** delay (`await delay(10)`) to prevent MCU FIFO overflow.
- **Flash Commit Pause**: Wait at least **100 ms** after `CMD_COMMIT_FLASH` (`0x09`) before issuing subsequent commands.

### 6. State Management Pattern
- `SettingsSession` implements an external store with `subscribe`, `getSnapshot`, and `updateSettings`.
- `SettingsContext` binds this store using React's `useSyncExternalStore`.
- Never mutate session drafts directly; always produce immutable updates:
```typescript
session.updateSettings((prev) => ({
  ...prev,
  debounce: Math.max(0, Math.min(30, val)),
}));
```

---

## Important Files

| File Path | Description & Critical Responsibilities |
| :--- | :--- |
| `src/core/protocol.ts` | Protocol framing engine: 17-byte layout, checksum math, interface picker (`selectPrimaryDevice`), asynchronous chunked EEPROM reading, battery query, and push event handling. |
| `src/core/settings.ts` | 181-byte EEPROM serializer/deserializer, PAW3370 DPI step math, register address table, and JSON profile export/import. |
| `src/core/hardwareSync.ts` | FIFO promise queue (`tail`), generation fencing, block-level differential scan against baseline bytes, and flash commit dispatch. |
| `src/core/settingsSession.ts` | In-memory reactive state machine with 150ms write debounce, dirty state tracking, and external store interface. |
| `src/context/DeviceContext.tsx` | WebHID connection gate, `navigator.hid` event listener bindings, battery polling timer (30s), and device log ring buffer. |
| `src/context/SettingsContext.tsx` | Connects React components to `SettingsSession` via `useSyncExternalStore`; bridges hardware push events (`dpi_change`). |
| `src/tests/simulatedHid.ts` | In-memory mock `HIDDevice` with full 181-byte EEPROM and flash emulation for headless testing. |
| `src/tests/ReadySettingsProvider.tsx` | Component test harness wrapping panels with a pre-loaded, ready settings session. |
| `docs/PROTOCOL_SPECIFICATION.md` | Authoritative byte-level specification for all USB HID opcodes (`0x01`..`0x10`). |
| `docs/EEPROM_MEMORY_MAP.md` | Comprehensive reference for all 3 EEPROM memory zones (`0x00..0xB4`, `0x100..0x2FF`, `0x300..0x1AFF`). |

---

## Runtime & Tooling Preferences

- **Runtime**: Node.js v18+ or v20+ (`@types/node: ^22.13.9`).
- **Package Manager**: `npm` with `package-lock.json` (v3). Do not commit alternate lockfiles (`yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`).
- **UI Framework**: React 19 (`react: ^19.0.0`) using automatic JSX runtime (`react-jsx`).
- **Styling**: Tailwind CSS v3 via PostCSS. Semantic colors map to CSS custom properties in `src/index.css`:
  - `bg-base` &rarr; `var(--base)`
  - `bg-surface` &rarr; `var(--surface)`
  - `bg-card` &rarr; `var(--card)`
  - `text-brand` / `text-cyan` &rarr; `var(--accent)`
- **Vite Server**: Fixed development port `3000`.

---

## Testing & QA

### Test Runner & Frameworks
- **Runner**: Vitest 3 (`vitest run`).
- **Environment**: `jsdom` (`jsdom: ^26.0.0`).
- **DOM Assertions**: React Testing Library (`@testing-library/react: ^16.2.0`).

### Mocking Guidelines
1. **Mocking WebHID Hardware**:
   - For protocol and sync integration tests, use `SimulatedHid` from `src/tests/simulatedHid.ts`.
   - Never attempt to call real `navigator.hid` in automated tests.
2. **Testing Isolated UI Panels**:
   - Production `SettingsProvider` prevents edits until a physical mouse connection completes.
   - Always wrap isolated panel tests in `<ReadySettingsProvider>` (`src/tests/ReadySettingsProvider.tsx`).
3. **Testing Async Latency & Race Conditions**:
   - Use the `deferred<T>()` helper to simulate hardware delays or control promise resolution timing.

### Verification Checklist Before Completing Work
- [ ] Run `npm test` &rarr; All test files must pass with zero failures.
- [ ] Run `npm run build` &rarr; TypeScript compilation (`tsc`) and Vite bundling must succeed without unused variable warnings.
- [ ] Check packet checksum invariant &rarr; Any new feature report must satisfy $\sum_{i=0}^{16} \text{buf}[i] \equiv 0x55 \pmod{256}$.
- [ ] Check import paths &rarr; Ensure no alias (`@/...`) imports were introduced.
