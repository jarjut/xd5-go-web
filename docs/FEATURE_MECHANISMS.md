# Fantech Helios Go XD5 — Feature Mechanisms & Technical Specifications

Detailed operational mechanisms, conversion algorithms, lookup tables, and state transitions reverse engineered from `OemDrv.exe` and `InitSetup.dll` for the **Fantech Helios Go XD5**.

---

## 1. Sensor Subsystem (PixArt PAW3370)

The mouse integrates the flagship **PixArt PAW3370** optical gaming sensor, supporting up to 19,000 DPI, 400 IPS tracking, and 50g acceleration.

### 1.1 Resolution Encoding & Independent X/Y Axes
The sensor uses a two-tier resolution step:
- **Range $50 \le \text{DPI} \le 10,000$**: 50 DPI steps ($\text{step} = 50$, $\text{multiplier} = 0$).
- **Range $10,000 < \text{DPI} \le 19,000$**: 100 DPI steps ($\text{step} = 100$, $\text{multiplier} = 2$).

Each DPI stage slot occupies 4 bytes at `0x0C + (stage - 1) * 4`:
```
Byte 0 : X-Axis Raw Value
Byte 1 : Y-Axis Raw Value
Byte 2 : Multiplier Byte = ((yMul & 0x0F) << 4) | (xMul & 0x0F)
Byte 3 : Stage Checksum = (0x55 - xRaw - yRaw - mulByte) & 0xFF
```

#### TypeScript Encoding Function
```typescript
export function encodeDpi(dpi: number): { raw: number; mul: number } {
  const bounded = Math.max(50, Math.min(19000, Number(dpi) || 800));
  if (bounded <= 10000) {
    return { raw: Math.round(bounded / 50) - 1, mul: 0 };
  } else {
    return { raw: Math.round(bounded / 100) - 1, mul: 2 };
  }
}

export function encodeDpiStage(xDpi: number, yDpi: number): [number, number, number, number] {
  const x = encodeDpi(xDpi);
  const y = encodeDpi(yDpi);
  const mulByte = ((y.mul & 0x0f) << 4) | (x.mul & 0x0f);
  const chk = (0x55 - x.raw - y.raw - mulByte) & 0xff;
  return [x.raw, y.raw, mulByte, chk];
}
```

#### TypeScript Decoding Function
```typescript
export function decodeDpiStage(bytes: Uint8Array | number[]): { xDpi: number; yDpi: number } {
  const xRaw = bytes[0];
  const yRaw = bytes[1];
  const mul = bytes[2];
  const xMul = mul & 0x0f;
  const yMul = (mul >> 4) & 0x0f;

  const decodeAxis = (raw: number, m: number) => {
    const step = (m & 2) ? 100 : 50;
    let dpi = (raw + 1) * step;
    if (m & 1) dpi *= 2;
    return dpi;
  };

  return { xDpi: decodeAxis(xRaw, xMul), yDpi: decodeAxis(yRaw, yMul) };
}
```

### 1.2 Lift-Off Distance (LOD)
Controlled by the 2-byte block at `0x0A..0x0B`:
- `0x01` = **1 mm** (Lower lift cut-off for competitive FPS play).
- `0x02` = **2 mm** (Standard tracking height for varied mouse pads).
- Checksum: `(0x55 - lod) & 0xFF`.

### 1.3 Sensor Enhancements: Angle Snapping & Ripple Control
- **Angle Snapping (`FixLine`, `0xAF`)**: Prediction algorithm that flattens slight diagonal tremors into straight horizontal/vertical trajectories. Set `0` for Off (raw 1:1 input) or `1` for On.
- **Ripple Control (`0xB1`)**: Jitter-smoothing filter for high sensitivity ($> 10,000$ DPI). Set `0` for Off (maximum raw responsiveness) or `1` for On.

---

## 2. Lighting Subsystem

The XD5 features an addressable RGB spectrum strip on the rear rim and an indicator beneath the scroll wheel.

### 2.1 The 7 Spectrum Modes
`OemDrv.exe` maps UI modes to internal hardware mode codes as follows:

| Mode # | Mode Name | Hardware Byte (`0xA0`) | Adjustable Speed? | Adjustable Brightness? | Predefined Color? |
| :---: | :--- | :---: | :---: | :---: | :---: |
| 1 | **Steady** | `2` | No | Yes (Table 3) | Yes (R, G, B) |
| 2 | **Breathing** | `1` | Yes (Table 2) | Yes (Table 3) | Yes (R, G, B) |
| 3 | **Streaming** | `0` | Yes (Table 1) | Yes (Table 4) | No (Rainbow Wave) |
| 4 | **Neon** | `3` | Yes (Table 2) | Yes (Table 3) | No (Spectrum Cycle) |
| 5 | **Scrolling** | `5` | Yes (Table 2) | Yes (Table 3) | No (Color Chase) |
| 6 | **Colorful Breathing** | `7` | Yes (Table 2) | Yes (Table 3) | No (Multi-color Breath) |
| 7 | **LED OFF** | `4` | No | No | No |

### 2.2 Lookup Tables (Extracted from Driver Data Segment)

The MCU expects non-linear register values rather than 0–100% percentages. Driver binary `.data` segment at `0x5d3570..0x5d35ac` defines these 10-step discrete tables:

```typescript
// 1. Streaming Animation Speed (Mode 0) - Lower value = faster
export const STREAMING_SPEED_TABLE = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

// 2. General Animation Speed (Modes 1, 3, 5, 7) - Lower value = faster
export const SPEED_TABLE = [255, 230, 210, 190, 170, 150, 130, 110, 70, 40] as const;

// 3. General LED Brightness (Modes 1, 2, 3, 5, 7)
export const BRIGHTNESS_TABLE = [45, 50, 75, 100, 125, 150, 175, 200, 225, 255] as const;

// 4. Streaming Mode Brightness (Mode 0)
export const STREAMING_BRIGHTNESS_TABLE = [72, 92, 112, 132, 152, 172, 192, 212, 232, 252] as const;

// 5. DPI Effect / Logo RGB Brightness Table
export const DPI_EFFECT_TABLE = [16, 30, 60, 90, 128, 150, 180, 210, 230, 255] as const;
```

### 2.3 Power Optimization: Light Off On Moving
Configured at `0xB3..0xB4`. When set to `1`, the optical sensor notifies the MCU when tracking movement begins, immediately shutting off RGB LEDs to conserve battery power. The LEDs resume illumination as soon as motion ceases.

---

## 3. Button Remapping & Keyboard Scancode Engine

The XD5 exposes 6 configurable buttons:
1. Left Click
2. Middle Click (Scroll Wheel)
3. Right Click
4. Forward (Side Button 1)
5. Backward (Side Button 2)
6. DPI Cycle

### 3.1 Button Action Classification
Inside `OemDrv.exe` (VA `0x40ed50`), button assignments are compiled into three categories:

1. **Standard Direct Actions (`0x60..0x77`)**:
   - Standard clicks, DPI step modifiers, and profile triggers executed directly by firmware with zero delay.
2. **Rapid Fire (Fire Key)**:
   - Repeatedly fires mouse clicks with customizable burst count and inter-click delay:
     $$\text{Dword} = (\text{BurstCount} \ll 16) \ | \ (\text{DelayMs} \ll 8) \ | \ 0x04$$
     *Example: 3 clicks with 50 ms delay = `(3 << 16) | (50 << 8) | 0x04 = 0x00033204`.*
3. **Sniper Lock (DPI Lock)**:
   - Drops sensor DPI to a dedicated precision value while held:
     $$\text{Dword} = (\text{rawDpi} \ll 8) \ | \ 0x0A$$
4. **Multimedia Actions**:
   - Compiled as `0x00000005` in `0x60`, with sequence bytes in Zone 2 (`0x100`).
5. **Hardware Macros**:
   - Compiled as `(RepeatCount << 16) | 0x06`, with sequence bytes in Zone 3 (`0x300`).

### 3.2 USB HID Scancode $\leftrightarrow$ Windows Virtual-Key Lookup Table
Extracted directly from table at VA `0x5a9778` in `OemDrv.exe`:

| HID Scancode | Virtual Key (VK) | Key Label | HID Scancode | Virtual Key (VK) | Key Label |
| :---: | :---: | :--- | :---: | :---: | :--- |
| `0x04` | `0x41` | A | `0x1E` | `0x31` | 1 |
| `0x05` | `0x42` | B | `0x1F` | `0x32` | 2 |
| `0x06` | `0x43` | C | `0x20` | `0x33` | 3 |
| `0x07` | `0x44` | D | `0x21` | `0x34` | 4 |
| `0x08` | `0x45` | E | `0x22` | `0x35` | 5 |
| `0x09` | `0x46` | F | `0x23` | `0x36` | 6 |
| `0x0A` | `0x47` | G | `0x24` | `0x37` | 7 |
| `0x0B` | `0x48` | H | `0x25` | `0x38` | 8 |
| `0x0C` | `0x49` | I | `0x26` | `0x39` | 9 |
| `0x0D` | `0x4A` | J | `0x27` | `0x30` | 0 |
| `0x0E` | `0x4B` | K | `0x28` | `0x0D` | Enter |
| `0x0F` | `0x4C` | L | `0x29` | `0x1B` | Escape |
| `0x10` | `0x4D` | M | `0x2A` | `0x08` | Backspace |
| `0x11` | `0x4E` | N | `0x2B` | `0x09` | Tab |
| `0x12` | `0x4F` | O | `0x2C` | `0x20` | Space |
| `0x13` | `0x50` | P | `0x39` | `0x14` | Caps Lock |
| `0x14` | `0x51` | Q | `0x3A`..`0x45` | `0x70`..`0x7B` | F1 .. F12 |
| `0x15` | `0x52` | R | `0x4A` | `0x24` | Home |
| `0x16` | `0x53` | S | `0x4D` | `0x23` | End |
| `0x17` | `0x54` | T | `0x4B` | `0x21` | Page Up |
| `0x18` | `0x55` | U | `0x4E` | `0x22` | Page Down |
| `0x19` | `0x56` | V | `0x4C` | `0x2E` | Delete |
| `0x1A` | `0x57` | W | `0x49` | `0x2D` | Insert |
| `0x1B` | `0x58` | X | `0x50` | `0x25` | Left Arrow |
| `0x1C` | `0x59` | Y | `0x4F` | `0x27` | Right Arrow |
| `0x1D` | `0x5A` | Z | `0x52` | `0x26` | Up Arrow |
| `0xE0` | `0xA2` | L-Ctrl | `0x51` | `0x28` | Down Arrow |
| `0xE1` | `0xA0` | L-Shift | `0xE4` | `0xA3` | R-Ctrl |
| `0xE2` | `0xA4` | L-Alt | `0xE5` | `0xA1` | R-Shift |
| `0xE3` | `0x5B` | L-Win | `0xE6` | `0xA5` | R-Alt |

---

## 4. Hardware Macro Engine

The Areson MCU features a true standalone hardware macro player capable of executing keystrokes and button clicks autonomously without host software intervention.

### 4.1 Storage & Capacity
- **Location**: EEPROM Zone 3 (`0x300`..`0x1AFF`).
- **Slot Allocation**: 384 bytes per button slot (`0x180` stride).
- **Step Limit**: Maximum 70 actions (`0x46` steps) per button.
- **Header**: First 30 bytes contain the null-terminated macro label string (`0x301`..`0x31E`).

### 4.2 Step Execution Flow
The on-board state machine iterates through 5-byte instruction blocks:
1. Read Byte 0 (`Header`):
   - Extract event type: `0x40` (Down) or `0x80` (Up).
   - Extract device target: `0x00` (Keyboard), `0x04` (Mouse), or `0x05` (Delay).
2. Dispatch event:
   - For keyboard: issue USB HID keyboard report containing Byte 1 scancode.
   - For mouse: issue USB HID mouse report with bitmask in Byte 1.
3. Pause execution for duration in milliseconds:
   $$\text{Duration} = (\text{Byte 3} \ll 8) \ | \ \text{Byte 4}$$
4. Repeat based on loop condition (`RepeatMode` in `0x60`).

---

## 5. Power & Battery Management

### 5.1 Querying Battery Level
Host issues **CMD `0x04` (`CMD_GET_BATTERY`)**. The mouse responds via Input Report:
```
Byte 5 : Battery percentage (0 .. 100%)
Byte 6 : Charging state (1 = plugged in / charging, 0 = discharging on battery)
```
Recommended polling interval: **30 seconds** (`30,000 ms`). Avoid querying faster than 5 seconds to prevent unnecessary radio transmission overhead.

### 5.2 Auto-Sleep Timer
Configured at `0xAD..0xAE`. Defines idle period before the mouse shuts off RF transmission and enters deep sleep:
- Values range from **1 to 20 minutes** (default: 10 minutes).
- Waking the mouse from sleep requires physical movement or a button click.
