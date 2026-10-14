# FANTECH Helios Go XD5 - WebHID Mouse Configurator

A dedicated browser-based configuration utility for the **FANTECH Helios Go XD5** wireless gaming mouse (PixArt PAW3370 sensor). Built from binary disassembly and reverse-engineering of the original driver (`OemDrv.exe`). Completely standalone—runs in any modern Chromium browser without installing native drivers, background services, or bloated vendor software.

---

## Quick start

Use a Chromium browser such as Chrome or Edge for mouse access.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For a production preview, run `npm run build` and `npm run preview`.

The app opens on a connection screen. Connect your XD5 by USB or its wireless receiver, select **Connect mouse**, and grant browser access. Configuration remains unavailable until the mouse's current settings have been read successfully. Failed connections or initial reads show a retry action; unsupported browsers show Chrome/Edge guidance.

Edits are held in memory and automatically written to the mouse after a short debounce, then committed to flash. The status bar distinguishes pending changes, synchronization, success, and failure. Failed writes remain dirty and can be retried. **Reload from mouse** replaces the draft and asks for confirmation if edits are pending.

Mouse settings are not stored in browser storage. Refreshing, disconnecting, or reconnecting discards pending edits; every connection starts with a fresh hardware read. Use JSON export/import in the connected workspace for explicit backups. Only the appearance preference is persisted locally.

The interface starts dark. Use Light/Dark in the connected header to switch appearance without changing mouse settings. Select a numbered mouse button to open its binding under **Buttons**. Other tabs are **DPI**, **Lights**, **Sensor**, and **Device log**. The XD5 SVG is independently authored against product references; no vendor photograph is bundled.

---

## 📚 Documentation & Technical Specifications

Comprehensive reverse-engineering documents, protocol specifications, memory maps, and integration guides are available in the [`docs/`](docs/) directory:

* **[User Manual (`docs/USER_MANUAL.md`)](docs/USER_MANUAL.md)**: Official product specifications, hardware button layout, connectivity, and feature overview transcribed from the manufacturer manual.
* **[Protocol Specification (`docs/PROTOCOL_SPECIFICATION.md`)](docs/PROTOCOL_SPECIFICATION.md)**: 17-byte USB HID framing, Modulo-256 sum-to-`0x55` checksum algorithm, two-tier storage model (SRAM vs Flash), and full command opcode reference (`0x01`–`0x10`).
* **[EEPROM Memory Map (`docs/EEPROM_MEMORY_MAP.md`)](docs/EEPROM_MEMORY_MAP.md)**: Complete byte-level layout of all 3 memory zones: Core Configuration (`0x00..0xB4`), Extended Multimedia Keys (`0x100..0x2FF`), and Hardware Macro Storage (`0x300..0x1AFF`).
* **[Feature Mechanisms (`docs/FEATURE_MECHANISMS.md`)](docs/FEATURE_MECHANISMS.md)**: PixArt PAW3370 DPI step conversion math, 7 Spectrum RGB modes with discrete speed/brightness lookup tables, 104 USB HID scancodes, and macro engine.
* **[WebHID Integration Guide (`docs/WEBHID_INTEGRATION_GUIDE.md`)](docs/WEBHID_INTEGRATION_GUIDE.md)**: Developer guide and production TypeScript code blueprints for integrating the mouse directly into web applications.
* **[Technical Documentation Index (`docs/README.md`)](docs/README.md)**: Quick navigation hub and high-level architecture diagram.

---

## 🎨 Project Features

1. **Connection-first configuration and backup**:
   - Read current hardware settings before enabling configuration.
   - Export and import settings as JSON after connection.
   - Automatically synchronize edits with visible failure and retry status.
2. **7-Stage DPI Studio**:
   - Custom stage selection, stage color pickers, and independent X / Y axis slider controls (50 to 19,000 DPI).
3. **RGB Lighting Control**:
   - Modes: Steady, Breathing, Streaming, Neon, Scrolling, Colorful Breathing, and OFF.
   - Brightness and Speed tuning with live animated SVG preview.
4. **Sensor & Button Configuration**:
   - Polling rate (125/250/500/1000 Hz), LOD (1mm/2mm), Debounce (4–20 ms), Sleep timer (1–20 min), Angle Snapping, Ripple Control.
   - Key remapping for all 6 buttons.
5. **Real-time Diagnostics & Battery Monitoring**:
   - Live battery percentage and charging status.
   - Hex packet inspector logging all transmitted 17-byte feature reports and received input reports.

---

## 📁 File Structure
```
xd5-go-web/
├── docs/                  # Comprehensive reverse-engineering and protocol specifications
│   ├── USER_MANUAL.md     # Transcribed official user manual
│   ├── PROTOCOL_SPECIFICATION.md # USB HID framing, checksums & command reference
│   ├── EEPROM_MEMORY_MAP.md      # Full 3-zone memory layout & validation rules
│   ├── FEATURE_MECHANISMS.md     # DPI math, RGB tables, scancodes & macro engine
│   ├── WEBHID_INTEGRATION_GUIDE.md # WebHID API implementation guide & TypeScript blueprints
│   └── README.md          # Documentation index and architecture overview
├── src/
│   ├── components/        # Layout, settings panels and interactive XD5 SVG
│   ├── context/           # Device, settings and separate UI theme state
│   ├── core/              # In-memory settings session, hardware synchronization and protocol
│   ├── tests/             # Behavioral regression tests
│   ├── App.tsx            # Connection gate and device/settings workspace
│   └── index.css          # Dark/light appearance and responsive layout
├── index.html             # Vite entry page
├── package.json           # Development, build and test commands
└── README.md              # Project overview and quick start guide
```
