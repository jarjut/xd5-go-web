# FANTECH Helios Go XD5 - WebHID Mouse Configurator

A dedicated browser-based configuration utility for the **FANTECH Helios Go XD5** wireless gaming mouse (PixArt PAW3370 sensor). Built from binary disassembly and reverse-engineering of the original driver (`OemDrv.exe`). Completely standalone—runs in any modern Chromium browser without installing native drivers, background services, or bloated vendor software.

---

## ⚡ Quick Start

### Option 1: Direct File
Open `index.html` directly in **Google Chrome**, **Microsoft Edge**, **Brave**, or **Opera**:
```
E:\Projects\xd5-go-web\index.html
```
*(Note: Because ES modules are used, some browsers require serving via local HTTP to satisfy CORS module policies).*

### Option 2: Local HTTP Server
Run with Python (built-in):
```bash
cd E:\Projects\xd5-go-web
python -m http.server 3000
```
Or with Node.js:
```bash
npx serve -l 3000 E:\Projects\xd5-go-web
```
Then navigate to: `http://localhost:3000`

---

## 🔍 Reverse-Engineered Hardware Specification

### USB Identifiers
- **Vendor ID (VID)**: `0x25A7` (Areson / SinoWealth MCU platform)
- **Product ID (PID - Wired Mode)**: `0xFA7B`
- **Product ID (PID - 2.4GHz Wireless Dongle)**: `0xFA7C`
- **Report ID**: `0x08` (Feature Report)

### 17-Byte Packet Framing & Checksum
Every command sent to the mouse is packaged as a 17-byte Feature Report with the following layout:
- `buf[0]`: Report ID = `0x08`
- `buf[1]`: Command ID (`0x02`, `0x04`, `0x07`, `0x08`, `0x09`, `0x10`)
- `buf[2..15]`: Command arguments & payload
- `buf[16]`: Checksum byte

#### Checksum Equation (Extracted from VA `0x44816d` & `0x4492ae`)
$$\sum_{i=0}^{16} \text{buf}[i] \equiv 0x55 \pmod{256}$$
$$\text{buf}[16] = \left(0x55 - \sum_{i=0}^{15} \text{buf}[i]\right) \pmod{256}$$

---

### Command Dispatch Table
| Command | Name | Function |
|---|---|---|
| `0x02` | `TellDrvStatus` | Driver handshake (`buf[6] = 1` active, `0` closed). |
| `0x04` | `GetPower` | Returns battery level (byte 9 = 0..100%) and charging flag (byte 10 = 0/1). |
| `0x07` | `WriteEEPROM` | Writes up to 10 bytes at 16-bit address (`buf[2..3] = Addr (BE)`, `buf[4] = Len`, `buf[5..] = Data`). |
| `0x08` | `ReadEEPROM` | Reads up to 10 bytes from 16-bit address (`buf[2..3] = Addr (BE)`, `buf[4] = Len`). |
| `0x09` | `CommitFlash` | Flashes the staged EEPROM configuration into non-volatile memory. |
| `0x0A` | `DeviceEvent` | Inbound notification pushed when physical DPI/Profile button is pressed on the mouse. |
| `0x10` | `SetProfile` | Active hardware profile index switch (`buf[5] = Profile Index 0..3`). |

---

### EEPROM Memory Map (`0x00 .. 0xB4`)
| Address | Bytes | Function | Hardware Values / Encoding |
|---|---|---|---|
| `0x00` | 1 | USB Polling Rate | `0x01` = 1000 Hz, `0x02` = 500 Hz, `0x04` = 250 Hz, `0x08` = 125 Hz |
| `0x01` | 1 | Hardware Profile ID | `0` = Profile 1, `1` = Profile 2, `2` = Profile 3, `3` = Profile 4 |
| `0x02` | 1 | Stage Count | Number of active DPI stages (1..7) |
| `0x04` | 1 | Current DPI Index | 0-indexed active stage pointer (`0` = Stage 1, etc.) |
| `0x0A` | 1 | LOD (Lift-off Distance) | `0x01` = 1 mm, `0x02` = 2 mm |
| `0x0C`–`0x27` | 28 | DPI Stages (7 × 4 B) | `[X_Raw, Y_Raw, Mul_Byte, Stage_Checksum]` |
| `0x2C`–`0x47` | 28 | DPI Colors (7 × 4 B) | `[R, G, B, 0]` stage indicator colors |
| `0x60`–`0x77` | 24 | Key Remap Matrix | 6 buttons × 4 bytes Little-Endian Dword |
| `0xA0`–`0xA7` | 8 | Main RGB Lighting | `[Mode, R, G, B, SpeedByte, BrightnessByte, 0, 0]` |
| `0xA9` | 1 | Debounce Delay | Switch debounce time in ms (4 to 20 ms, default 12 ms) |
| `0xAD` | 1 | Auto-Sleep Timer | Idle delay in minutes (1 to 20 min, default 10 min) |
| `0xAF` | 1 | Angle Snapping (FixLine) | `0` = Off, `1` = On |
| `0xB1` | 1 | Ripple Control | `0` = Off, `1` = On (Jitter smoothing at >10,000 DPI) |
| `0xB3` | 1 | Light Off On Move | `0` = Off, `1` = On (Saves wireless battery while tracking) |

---

### PAW3370 DPI Math (Extracted from VA `0x40b850` & `0x40b980`)
- **DPI $\le 10,000$**: `raw = Math.round(DPI / 50) - 1`, `mul = 0`
- **$10,000 < \text{DPI} \le 19,000$**: `raw = Math.round(DPI / 100) - 1`, `mul = 2`
- **Multiplier Byte**: `(yMul << 4) | (xMul & 0x0F)`
- **Stage Checksum**: `(0x55 - xRaw - yRaw - mulByte) & 0xFF`

---

## 🎨 Project Features

1. **Profile Management & Signature Colors**:
   - Manage multiple independent profiles (Balanced, Competitive FPS, MOBA, Battery Saver, or Custom).
   - Customize profile signature accent color with visual glowing theme swatch.
   - One-click sync from profile color to the mouse's physical LED.
   - Synchronizes active hardware profile ID directly to mouse EEPROM `0x01` and Command `0x10`.
   - Full JSON Export and Import capabilities for profile backup and sharing.
2. **7-Stage DPI Studio**:
   - Custom stage selection, stage color pickers, and independent X / Y axis slider controls (50 to 19,000 DPI).
3. **RGB Lighting Control**:
   - Modes: Steady, Breathing, Streaming, Neon, Scrolling, Colorful Breathing, and OFF.
   - Brightness and Speed tuning with live animated SVG preview.
4. **Sensor & Button Configuration**:
   - Polling rate (125/250/500/1000 Hz), LOD (1mm/2mm), Debounce (4–20 ms), Sleep timer (1–20 min), Angle Snapping, Ripple Control.
   - Key remapping for all 6 buttons.
5. **Real-time Diagnostics & Battery Monitoring**:
   - Live battery percentage bar and charging status indicator.
   - Hex packet inspector logging all transmitted 17-byte feature reports and received input reports.

---

## 📁 File Structure
```
xd5-go-web/
├── css/
│   └── styles.css          # Dark gaming UI stylesheet
├── js/
│   ├── protocol.js         # WebHID communication, packet builder & checksums
│   ├── profiles.js         # Multi-profile state, EEPROM serialization & storage
│   ├── mouse-svg.js        # Responsive vector mouse visualizer
│   └── app.js              # UI controller, event bindings & transaction orchestrator
├── index.html              # Main application shell
├── package.json            # Node.js project descriptor & serve scripts
└── README.md               # Hardware & protocol documentation
```
