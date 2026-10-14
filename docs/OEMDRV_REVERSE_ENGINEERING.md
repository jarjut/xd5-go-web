# Fantech Helios Go XD5 (OemDrv.exe) - Reverse Engineering Reference

Comprehensive technical reference document derived from static and dynamic reverse engineering of the OEM driver binary (`OemDrv.exe`), supporting libraries (`InitSetup.dll`, `Cfg.ini`), and live USB HID communications on the **Fantech Helios Go XD5** gaming mouse (Areson MCU + PixArt PAW3370 sensor, `VID_25A7`, `PID_FA7B` / `PID_FA7C`).

---

## 1. Hardware Memory Architecture: Dual-Layer Model

The Areson MCU employs a **two-tier** storage architecture:

```
[Web App / OemDrv.exe]
       │
       │  CMD 0x07 (WriteEEPROM) ───► Fast (<1 ms), non-blocking
       ▼
┌──────────────────────────────────────────────┐
│  Areson MCU - Shadow EEPROM (SRAM Volatile)  │ ──► Controls live hardware registers
└──────────────────────────────────────────────┘     (PixArt CPI, PWM Timer LED, Debounce)
       │
       │  CMD 0x09 (CommitFlash) ────► Heavy (50–100 ms), MCU USB polling stalled
       ▼
┌──────────────────────────────────────────────┐
│     SPI NOR Flash Physical (Non-Volatile)    │ ──► Persistence across mouse power loss
└──────────────────────────────────────────────┘
```

1. **SRAM Shadow EEPROM (181 Bytes, Addresses `0x00`..`0xB4`)**:
   - Resides directly in the internal MCU memory space.
   - Updates via **CMD `0x07` (WriteEEPROM)** execute in less than 1 millisecond.
   - The MCU reloads PixArt CPI registers and PWM LED timers in real time with zero perceived latency.
   - Volatile: all contents are lost when power is disconnected.

2. **Physical SPI NOR Flash (On-Board PCB)**:
   - Dedicated non-volatile NOR flash memory chip attached to the MCU SPI bus.
   - Writes via **CMD `0x09` (CommitFlash)** trigger a hardware sector erase and page programming cycle (~50–100 milliseconds).
   - During flash programming, MCU interrupts are halted and USB report transmission freezes (causing immediate cursor stutter/stall).
   - The flash chip has a finite erase/write cycle endurance (~100,000 cycles).

### Why `OemDrv.exe` Lacks a "Save" Button
The driver configuration `Cfg.ini` sets `ApplyNow=1`. In the UI skin (`mak.skn`), the developer intentionally hid the "Apply" and "OK/Cancel" buttons.
Whenever the user drags a slider, toggles a radio button, or selects a color, the driver **exclusively sends CMD `0x07` to SRAM EEPROM**. The original software **never issues CMD `0x09` (CommitFlash)** during routine control adjustments. This ensures the mouse never stutters or drops polling frames while in use.
CMD `0x09` is reserved strictly for factory reset procedures (*Reset to Defaults*).

---

## 2. USB HID Protocol Specification

### Endpoint & Report Identity
- **Vendor ID (VID)**: `0x25A7`
- **Product ID (PID)**:
  - Wired Mode (USB-C cable): `0xFA7B` (Interface 1, Collection 7 for Feature Reports, Collection 5 for Input Reports)
  - Wireless Dongle (2.4GHz): `0xFA7C`
- **Report ID**: `0x08`
- **Packet Length**: Exactly 17 bytes (`[ReportID=0x08, CMD, ...payload..., Checksum]`).

### Packet Framing
Every USB Feature Report follows this 17-byte layout:
```
Byte 0      : Report ID (always 0x08)
Byte 1      : Command ID (CMD)
Byte 2..15  : Arguments / Data payload (up to 14 bytes)
Byte 16     : Modulo-256 Checksum
```

### Modulo-256 Checksum Algorithm
The sum of all bytes from index 0 to 16 modulo-256 must equal `0x55`:
$$\sum_{i=0}^{16} \text{Packet}[i] \equiv 0x55 \pmod{256}$$
$$\text{Packet}[16] = \left( 0x55 - \sum_{i=0}^{15} \text{Packet}[i] \right) \ \& \ 0xFF$$

---

## 3. Command Reference

| CMD | Command Name | Direction | Function & Payload Structure |
| :---: | :--- | :---: | :--- |
| `0x02` | `CMD_HANDSHAKE` / `TellDrvStatus` | Out | Notifies firmware of driver status (active or exiting).<br>Payload: `[0x00, 0x00, 0x00, 0x01, active (1/0)]`. |
| `0x04` | `CMD_GET_BATTERY` | Out | Requests wireless battery level and charging status.<br>Response delivered via Input Report `0x08` (Byte 8 = battery %, Byte 9 = charging bit). |
| `0x07` | `CMD_WRITE_EEPROM` | Out | Writes up to 10 bytes to the MCU SRAM EEPROM buffer.<br>Payload: `[0x00, addr_hi, addr_lo, length, ...data...]`. |
| `0x08` | `CMD_READ_EEPROM` | Out | Requests reading up to 10 bytes from EEPROM.<br>Payload: `[0x00, addr_hi, addr_lo, length]`.<br>Response delivered via Input Report `0x08` starting at offset byte 6. |
| `0x09` | `CMD_COMMIT_FLASH` | Out | Erases SPI flash sector and burns current 181-byte SRAM buffer.<br>Payload: 14 zero padding bytes (`[0x00 * 14]`). |
| `0x0A` | `CMD_DEVICE_EVENT` | In | Physical hardware notification pushed by mouse when button is pressed.<br>Byte 5 = Event flags (`0x01` = DPI change, `0x02` = Profile change).<br>Byte 6 = **DPI Stage index (0-indexed: 0..6)**.<br>Byte 7 = Profile index (`bytes[7] & 0x0F`). |
| `0x10` | `CMD_SET_PROFILE` | Out | Switches active hardware profile index (0..3).<br>Payload: `[0x00, 0x00, 0x00, 0x01, profile_index]`. |

---

## 4. EEPROM Memory Map (181 Bytes, `0x00`..`0xB4`)

| Address | Size | Parameter | Format & Internal Validation Rule |
| :---: | :---: | :--- | :--- |
| `0x00..0x01` | 2 Bytes | Polling Rate | Byte 0: Rate code (`0x01`=1000Hz, `0x02`=500Hz, `0x04`=250Hz, `0x08`=125Hz).<br>Byte 1: `(0x55 - b0) & 0xff`. |
| `0x02..0x03` | 2 Bytes | DPI Stage Count | Byte 0: Active stage count (`1..7`).<br>Byte 1: `(0x55 - b0) & 0xff`. |
| `0x04..0x05` | 2 Bytes | Current DPI Index | Byte 0: Active stage index (`0..6`, 0-indexed).<br>Byte 1: `(0x55 - b0) & 0xff`. |
| `0x06..0x09` | 4 Bytes | Reserved Padding | Fixed bytes: `[0x00, 0x55, 0x00, 0x55]`. |
| `0x0A..0x0B` | 2 Bytes | Lift-Off Distance (LOD) | Byte 0: `1` (1mm) or `2` (2mm).<br>Byte 1: `(0x55 - b0) & 0xff`. |
| `0x0C..0x2B` | 32 Bytes | 8 DPI Stage Slots (4 Bytes each) | 8 stages $\times$ 4 bytes: `[xRaw, yRaw, mulByte, chk]`.<br>Stage checksum formula: `(0x55 - xRaw - yRaw - mulByte) & 0xff`. |
| `0x2C..0x4B` | 32 Bytes | 8 DPI Indicator Color Slots | 8 stages $\times$ 4 bytes: `[R, G, B, chk]`.<br>Color checksum formula: `(0x55 - R - G - B) & 0xff`.<br>Stage 8 slot requires fixed padding: `[0xff, 0xff, 0xff, 0x58]`. |
| `0x4C..0x53` | 8 Bytes | DPI Effect / Indicator Mode | `0x4C`: Mode (`0`=Off, `1`=Breathing, `2`=Steady).<br>`0x4D`: `(0x55 - mode) & 0xff`. |
| `0x54..0x5B` | 8 Bytes | DPI RGB Switch | Used when `ShowRGBSw=1`. |
| `0x60..0x77` | 24 Bytes | Key Action Matrix (Buttons 1..6) | 6 buttons $\times$ 4-byte Little-Endian dword.<br>Bytes 0..2 = HID / Windows action code.<br>Byte 3 = `(0x55 - b0 - b1 - b2) & 0xff`. |
| `0x78..0x9F` | 40 Bytes | Macro & Extended Bindings | Memory offsets pointing to macro definitions. |
| `0xA0..0xA7` | 8 Bytes | Main Lighting Configuration | `[mode, R, G, B, speed, brightness, chk, 0x00]`.<br>Checksum formula: `(0x55 - mode - R - G - B - speed - brightness) & 0xff`.<br>Must be written as an atomic 7-byte block at offset `0xA0`. |
| `0xA8` | 1 Byte | Padding | `0x55`. |
| `0xA9..0xAA` | 2 Bytes | Button Debounce Time | Byte 0: Debounce time in ms (`4..20`).<br>Byte 1: `(0x55 - b0) & 0xff`. |
| `0xAB..0xAC` | 2 Bytes | Padding | `[0x00, 0x55]`. |
| `0xAD..0xAE` | 2 Bytes | Auto-Sleep Minutes | Byte 0: Sleep idle threshold in minutes (`1..20`).<br>Byte 1: `(0x55 - b0) & 0xff`. |
| `0xAF..0xB0` | 2 Bytes | Angle Snapping (FixLine) | Byte 0: `0` (Off) or `1` (On).<br>Byte 1: `(0x55 - b0) & 0xff`. |
| `0xB1..0xB2` | 2 Bytes | Ripple Control | Byte 0: `0` (Off) or `1` (On).<br>Byte 1: `(0x55 - b0) & 0xff`. |
| `0xB3..0xB4` | 2 Bytes | Light Off on Moving | Byte 0: `0` (Off) or `1` (On).<br>Byte 1: `(0x55 - b0) & 0xff`. |

---

## 5. DPI Encoding & Decoding Algorithms (PixArt PAW3370)

Functions at VA `0x40b710` (encoding) and `0x40b980` (decoding) translate user-facing DPI values into sensor register representations:

### Encoding Algorithm:
1. Range $\le 10,000$ DPI (50 DPI resolution step):
   $$\text{raw} = \text{round}(\text{dpi} / 50) - 1, \quad \text{mul} = 0$$
2. Range $> 10,000$ DPI up to $19,000$ DPI (100 DPI resolution step):
   $$\text{raw} = \text{round}(\text{dpi} / 100) - 1, \quad \text{mul} = 2$$
3. Multiplier Byte Construction:
   $$\text{mulByte} = ((\text{yMul} \ \& \ 0x0F) \ll 4) \ | \ (\text{xMul} \ \& \ 0x0F)$$
4. Stage Checksum:
   $$\text{chk} = (0x55 - \text{xRaw} - \text{yRaw} - \text{mulByte}) \ \& \ 0xFF$$

### Decoding Algorithm:
$$\text{step} = (\text{mul} \ \& \ 2) \ ? \ 100 : 50$$
$$\text{dpi} = (\text{raw} + 1) \times \text{step} \times ((\text{mul} \ \& \ 1) \ ? \ 2 : 1)$$

---

## 6. Internal Threading & IPC Architecture of `OemDrv.exe`

The original driver decouples the UI message loop from USB I/O using a semaphore-gated worker thread:

```
[UI Window Thread]
       │
       │ (1) User adjusts slider / dropdown / radio
       │ (2) Document state pDoc updated (0x408860)
       │ (3) Set nFlag (0x5fb604) & nData (0x5fb60c)
       │ (4) ReleaseSemaphore (0x576480)
       ▼
[Worker Thread Apply (VA 0x4091f0 / 0x40f850)]
       │
       │ (5) Wakes from WaitForSingleObject
       │ (6) Evaluates nFlag bitmask
       │ (7) Sends targeted CMD 0x07 via WriteEEPROM (0x448680)
       │ (8) Checks nFlag & 0x100: IF 0, NO COMMIT FLASH
       │ (9) Returns to sleep waiting for next semaphore
```

### `nFlag` Bitmask Table (`0x5fb604`)
| Bit | Hex Mask | Subsystem | Action Executed |
| :---: | :---: | :--- | :--- |
| Bit 0 | `0x0001` | Key Matrix | CMD `0x07` at address `0x60` (24 bytes). |
| Bit 1 | `0x0002` | Main Lighting | CMD `0x07` at address `0xA0` (7 atomic bytes). |
| Bit 2 | `0x0004` | DPI Stage Values | CMD `0x07` at `0x0C + i*4` (4 bytes per stage). |
| Bit 4 | `0x0010` | Active DPI Stage | CMD `0x07` at address `0x04` (2 bytes). |
| Bit 5 | `0x0020` | Polling Rate | CMD `0x07` at address `0x00` (2 bytes). |
| Bit 6 | `0x0040` | DPI Stage Colors | CMD `0x07` at `0x2C + i*4` (4 bytes per color). |
| Bit 7 | `0x0080` | Stage Count | CMD `0x07` at address `0x02` (2 bytes). |
| Bit 8 | `0x0100` | **Commit Flash** | **CMD `0x09` (Executed ONLY when this bit is set).** |
| Bit 9 | `0x0200` | LOD | CMD `0x07` at address `0x0A` (2 bytes). |
| Bit 10 | `0x0400` | Angle Snapping | CMD `0x07` at address `0xAF` (2 bytes). |
| Bit 11 | `0x0800` | Ripple Control | CMD `0x07` at address `0xB1` (2 bytes). |
| Bit 12 | `0x1000` | Debounce Time | CMD `0x07` at address `0xA9` (2 bytes). |
| Bit 14 | `0x4000` | Sleep Minutes | CMD `0x07` at address `0xAD` (2 bytes). |
| Bit 16 | `0x10000`| Light Off on Move | CMD `0x07` at address `0xB3` (2 bytes). |
| Bit 15 | `0x8000` | Full Apply Flag | Indicates Reset / full template apply (`0xffff`). |

---

## 7. Physical Mouse Button Event Processing (CMD `0x0A`)

When the physical DPI cycle button underneath the mouse is clicked, the mouse firmware asynchronously pushes an Input Report `0x08` with CMD `0x0A`:
- `bytes[0]` = `0x0A`
- `bytes[5]` = Event Flags (`bytes[5] & 0x01` indicates DPI stage switch)
- `bytes[6]` = **Stage index (0-indexed: 0, 1, 2, 3...)**

In `OemDrv.exe` (VA `0x44770f`):
```asm
movzx eax, byte ptr [esi + 6]  ; Extract 0-indexed stage from packet
push  1                        ; lParam = 1 (EventType: DPI)
push  eax                      ; wParam = stage index (0..6)
push  0x7eb                    ; WM_USER message
call  PostMessageW
```
In the window message dispatcher (VA `0x43676c`):
```asm
lea   eax, [ebx + 1]           ; UI Display = wParam + 1 (1-based: Stage 1..7)
mov   dword ptr [0x5d3010], ebx ; Store active stage index (0-based)
```
**Web App Implementation Rule**:
Whenever a `CMD_DEVICE_EVENT` (`0x0A`) packet arrives from the mouse, `bytes[6]` (0..6) must be normalized to 1-based format:
$$\text{activeDpiStage} = \text{bytes}[6] + 1$$
The valid hardware input range is $0 \le \text{bytes}[6] < \text{stageCount}$.
