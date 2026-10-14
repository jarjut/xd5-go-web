# Fantech Helios Go XD5 — EEPROM Memory Map

Complete memory map and internal validation rules for the on-board SRAM Shadow EEPROM of the **Fantech Helios Go XD5** (Areson MCU + PixArt PAW3370).

The MCU divides its EEPROM space into **three distinct functional zones**:
1. **Zone 1 (`0x00`..`0xB4`)**: Core Device Configuration (181 Bytes)
2. **Zone 2 (`0x100`..`0x2FF`)**: Extended Consumer & Multimedia Key Sequence Matrix (512 Bytes)
3. **Zone 3 (`0x300`..`0x1AFF`)**: On-Board Hardware Macro Storage (6,144 Bytes)

---

## 1. Zone 1: Core Configuration (`0x00`..`0xB4`, 181 Bytes)

Every single parameter in this zone is protected by an adjacent internal parity/checksum byte. The rule for 1-byte parameters is:
$$\text{Checksum} = (0x55 - \text{Value}) \ \& \ 0xFF$$

### Memory Map Table

| Address Range | Size | Parameter Name | Format & Bit Layout | Validation / Checksum Rule |
| :---: | :---: | :--- | :--- | :--- |
| `0x00..0x01` | 2 B | **USB Polling Rate** | `Byte 0`: Rate Code:<br>• `0x01` = 1000 Hz<br>• `0x02` = 500 Hz<br>• `0x04` = 250 Hz<br>• `0x08` = 125 Hz | `Byte 1 = (0x55 - Byte 0) & 0xFF` |
| `0x02..0x03` | 2 B | **DPI Stage Count** | `Byte 0`: Active stages count (`1..7`). | `Byte 1 = (0x55 - Byte 0) & 0xFF` |
| `0x04..0x05` | 2 B | **Current DPI Index** | `Byte 0`: 0-indexed active stage (`0..6`). | `Byte 1 = (0x55 - Byte 0) & 0xFF` |
| `0x06..0x09` | 4 B | **Reserved Padding** | Fixed pattern | `[0x00, 0x55, 0x00, 0x55]` |
| `0x0A..0x0B` | 2 B | **Lift-Off Distance (LOD)** | `Byte 0`: `0x01` (1 mm) or `0x02` (2 mm). | `Byte 1 = (0x55 - Byte 0) & 0xFF` |
| `0x0C..0x2B` | 32 B | **8 × DPI Stage Slots** | 8 stages × 4 bytes:<br>`[xRaw, yRaw, mulByte, stageChk]` | $\text{stageChk} = (0x55 - \text{xRaw} - \text{yRaw} - \text{mulByte}) \ \& \ 0xFF$<br>*(See Section 4 for DPI math)* |
| `0x2C..0x4B` | 32 B | **8 × DPI Color Slots** | 8 stages × 4 bytes:<br>`[R, G, B, colorChk]` | $\text{colorChk} = (0x55 - R - G - B) \ \& \ 0xFF$<br>Stage 8 requires fixed padding: `[0xFF, 0xFF, 0xFF, 0x58]` |
| `0x4C..0x53` | 8 B | **DPI Effect / Indicator** | `[mode, chk, bri, 0, speed, 0, 0, 0]`<br>Mode: `0`=Off, `1`=Breathing, `2`=Steady | `Byte 1 = (0x55 - mode) & 0xFF` |
| `0x54..0x5B` | 8 B | **Logo RGB / DPI Switch** | `[R, G, B, chk, speed, 0, bri, 0, mode]` | Used when `ShowRGBSw=1` |
| `0x60..0x77` | 24 B | **Physical Buttons (1..6)** | 6 buttons × 4-byte Little-Endian dword.<br>`[b0, b1, b2, chk]` | $\text{chk} = (0x55 - b0 - b1 - b2) \ \& \ 0xFF$<br>*(See Section 5 for Button Codes)* |
| `0x78..0x9F` | 40 B | **Extended Buttons (7..16)** | 10 buttons × 4-byte Little-Endian dword. | $\text{chk} = (0x55 - b0 - b1 - b2) \ \& \ 0xFF$ |
| `0xA0..0xA7` | 8 B | **Main RGB Lighting** | Atomic 8-byte configuration block:<br>`[mode, R, G, B, speed, bri, chk, 0x00]` | $\text{chk} = (0x55 - \text{mode} - R - G - B - \text{speed} - \text{bri}) \ \& \ 0xFF$<br>*(Must be written atomically at 0xA0)* |
| `0xA8` | 1 B | **Fixed Byte** | Fixed delimiter byte | Always `0x55` |
| `0xA9..0xAA` | 2 B | **Debounce Delay** | `Byte 0`: Switch debounce time (`0..30` ms, default 12 ms). | `Byte 1 = (0x55 - Byte 0) & 0xFF` |
| `0xAB..0xAC` | 2 B | **Reserved Delimiter** | Fixed pattern | `[0x00, 0x55]` |
| `0xAD..0xAE` | 2 B | **Auto-Sleep Timer** | `Byte 0`: Idle threshold in minutes (`1..20`). | `Byte 1 = (0x55 - Byte 0) & 0xFF` |
| `0xAF..0xB0` | 2 B | **Angle Snapping (FixLine)** | `Byte 0`: `0` (Off) or `1` (On). | `Byte 1 = (0x55 - Byte 0) & 0xFF` |
| `0xB1..0xB2` | 2 B | **Ripple Control** | `Byte 0`: `0` (Off) or `1` (On). | `Byte 1 = (0x55 - Byte 0) & 0xFF` |
| `0xB3..0xB4` | 2 B | **Light Off on Moving** | `Byte 0`: `0` (Off) or `1` (On). | `Byte 1 = (0x55 - Byte 0) & 0xFF` |

---

## 2. Zone 2: Extended Consumer & Multimedia Keys (`0x100`..`0x2FF`, 512 Bytes)

When a button in the primary matrix (`0x60..0x77`) is assigned to **Multimedia or Windows Consumer actions**, its primary code is set to `0x00000005` (`[0x05, 0x00, 0x00, 0x50]`).

The actual keystroke sequence is stored in **Zone 2**, where each button slot is assigned **32 bytes (`0x20` stride)**:
$$\text{Slot Address} = 0x100 + (\text{Button Number} - 1) \times 0x20$$

### Consumer Sequence Packet Layout (8 Bytes)
```
Byte 0      : Event Count (always 0x02: one Down event + one Up event)
Byte 1      : Action Type = 0x82 (Consumer Key Down)
Byte 2      : Usage Code Low Byte (usage & 0xFF)
Byte 3      : Usage Code High Byte ((usage >> 8) & 0xFF)
Byte 4      : Action Type = 0x42 (Consumer Key Up)
Byte 5      : Usage Code Low Byte (usage & 0xFF)
Byte 6      : Usage Code High Byte ((usage >> 8) & 0xFF)
Byte 7      : Checksum = (0x55 - sum(bytes[0..6])) & 0xFF
Byte 8..31  : Zero padding (0x00)
```

### Common Consumer Usages
| Action | Usage (16-bit) | Low Byte | High Byte |
| :--- | :---: | :---: | :---: |
| Play / Pause | `0x00CD` | `0xCD` | `0x00` |
| Next Track | `0x00B5` | `0xB5` | `0x00` |
| Previous Track | `0x00B6` | `0xB6` | `0x00` |
| Stop Playback | `0x00B7` | `0xB7` | `0x00` |
| Volume Up | `0x00E9` | `0xE9` | `0x00` |
| Volume Down | `0x00EA` | `0xEA` | `0x00` |
| Mute | `0x00E2` | `0xE2` | `0x00` |
| Calculator | `0x0192` | `0x92` | `0x01` |
| Windows Explorer | `0x0194` | `0x94` | `0x01` |
| Browser Home | `0x0223` | `0x23` | `0x02` |
| Web Search | `0x0221` | `0x21` | `0x02` |

---

## 3. Zone 3: On-Board Hardware Macro Storage (`0x300`..`0x1AFF`, 6,144 Bytes)

When a physical button is assigned to run a **Hardware Macro**, its primary matrix code in `0x60` is set to:
$$\text{Matrix Code} = (\text{RepeatMode} \ll 16) \ | \ 0x0006$$

Where `RepeatMode` is:
- `1..255`: Fixed cycle repeat count ($N$ times).
- `0xFE`: Cycle continuously while button is held down.
- `0xFF`: Cycle continuously until any other button is pressed (toggle mode).

The macro action sequence is programmed into **Zone 3**, where each button slot spans **384 bytes (`0x180` stride)**:
$$\text{Macro Slot Address} = 0x300 + (\text{Button Number} - 1) \times 0x180$$

### Macro Slot Structure
```
Offset 0x00        : Length / step counter byte
Offset 0x01..0x1E  : Macro Name string (up to 30 bytes, null-terminated ASCII)
Offset 0x1F..0x17F : Macro Action Stream (5 bytes per step, up to 70 steps)
Offset 0x17D..0x17F: Trailing parity padding
```

### 5-Byte Macro Step Format
Each action in the stream is encoded as a 5-byte structure:
```
Byte 0: Action Header = (EventType << 6) | KeyCategory
        • EventType: 1 = Key Down (0x40), 2 = Key Up (0x80)
        • KeyCategory:
            0 = Keyboard Key
            4 = Mouse Button
            5 = Delay Interval
Byte 1: Key / Button Code:
        • Keyboard: USB HID Scancode (0x04 = A, etc.)
        • Mouse: 0x01 = Left, 0x02 = Right, 0x04 = Middle, 0x08 = Back, 0x10 = Forward
Byte 2: Reserved (0x00)
Byte 3: Delay High Byte ((delayMs >> 8) & 0xFF)
Byte 4: Delay Low Byte (delayMs & 0xFF)
```

---

## 4. DPI Sensor Register Math (PixArt PAW3370)

The PixArt PAW3370 sensor uses a segmented resolution scale:
1. **$50 \le \text{DPI} \le 10,000$ (50 DPI resolution step)**:
   $$\text{raw} = \text{round}\left(\frac{\text{DPI}}{50}\right) - 1, \quad \text{mul} = 0$$
2. **$10,000 < \text{DPI} \le 19,000$ (100 DPI resolution step)**:
   $$\text{raw} = \text{round}\left(\frac{\text{DPI}}{100}\right) - 1, \quad \text{mul} = 2$$
3. **Multiplier Byte Construction**:
   $$\text{mulByte} = ((\text{yMul} \ \& \ 0x0F) \ll 4) \ | \ (\text{xMul} \ \& \ 0x0F)$$
4. **Stage Checksum**:
   $$\text{stageChk} = (0x55 - \text{xRaw} - \text{yRaw} - \text{mulByte}) \ \& \ 0xFF$$

### Decoding Formula
$$\text{step} = (\text{mul} \ \& \ 2) \ ? \ 100 : 50$$
$$\text{DPI} = (\text{raw} + 1) \times \text{step} \times ((\text{mul} \ \& \ 1) \ ? \ 2 : 1)$$

---

## 5. Physical Button Action Matrix Reference (`0x60..0x77`)

Each button in `0x60..0x77` is represented as a 4-byte Little-Endian integer `[b0, b1, b2, chk]`:

| Function Name | Hex Value (LE Dword) | Byte Array `[b0, b1, b2, chk]` |
| :--- | :---: | :--- |
| **Left Click** | `0x00000101` | `[0x01, 0x01, 0x00, 0x53]` |
| **Right Click** | `0x00000201` | `[0x01, 0x02, 0x00, 0x52]` |
| **Middle Click** | `0x00000401` | `[0x01, 0x04, 0x00, 0x50]` |
| **Back Button** | `0x00000801` | `[0x01, 0x08, 0x00, 0x4C]` |
| **Forward Button** | `0x00001001` | `[0x01, 0x10, 0x00, 0x44]` |
| **Double Click** | `0x00023204` | `[0x04, 0x32, 0x02, 0x1D]` |
| **Triple Click** | `0x00033204` | `[0x04, 0x32, 0x03, 0x1C]` |
| **Fire Key (Rapid)** | `(count << 16) \| (delay << 8) \| 0x04` | Dynamically calculated |
| **Disable Button** | `0x00000000` | `[0x00, 0x00, 0x00, 0x55]` |
| **DPI Loop (Cycle)** | `0x00000102` | `[0x02, 0x01, 0x00, 0x52]` |
| **DPI +** | `0x00000202` | `[0x02, 0x02, 0x00, 0x51]` |
| **DPI -** | `0x00000302` | `[0x02, 0x03, 0x00, 0x50]` |
| **DPI Lock (Sniper)**| `(rawDpi << 8) \| 0x0A` | Dynamically calculated |
| **RGB Mode Switch** | `0x00000007` | `[0x07, 0x00, 0x00, 0x4E]` |
| **Polling Rate Switch**| `0x00000008`| `[0x08, 0x00, 0x00, 0x4D]` |
| **Profile Switch** | `0x00000009` | `[0x09, 0x00, 0x00, 0x4C]` |
| **Multimedia Key** | `0x00000005` | `[0x05, 0x00, 0x00, 0x50]` *(Payload in Zone 2)* |
| **Hardware Macro** | `(repeat << 16) \| 0x06` | *(Payload in Zone 3)* |
