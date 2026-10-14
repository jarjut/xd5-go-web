# Fantech Helios Go XD5 — USB HID Protocol Specification

Comprehensive low-level technical specification of the USB HID communication protocol for the **Fantech Helios Go XD5** wireless gaming mouse (Areson MCU + PixArt PAW3370 sensor).

---

## 1. Device USB Identifiers

| Parameter | Value | Notes |
| :--- | :--- | :--- |
| **Vendor ID (VID)** | `0x25A7` | Areson / SinoWealth OEM platform |
| **Product ID (PID) — Wired Mode** | `0xFA7B` | Direct USB Type-C connection |
| **Product ID (PID) — Wireless Dongle** | `0xFA7C` | 2.4 GHz RF Nano Receiver |
| **Report ID** | `0x08` (Feature Report)<br>`0x08` / `0x09` (Input Report) | Configuration channel |
| **Packet Length** | Fixed 17 Bytes | Identical for all requests & responses |

### Interface Selection in WebHID
When connecting via WebHID, multiple USB interfaces and collections are declared by the device:
1. **Standard Mouse Interface (`Interface 0`)**: Reports standard cursor movement and mouse clicks (Collection: Usage Page `0x01` Generic Desktop, Usage `0x02` Mouse). Browsers enforce security restrictions preventing direct manipulation of this collection.
2. **Vendor Configuration Interface (`Interface 1`)**:
   - Declares Feature Report ID `0x08` (Length: 17 bytes) or Vendor-defined usage page (`0xFF00`–`0xFFFF`).
   - Receives commands via `device.sendFeatureReport(0x08, payload16)` or `device.sendReport(0x08, payload16)`.
   - Sends asynchronous hardware responses and notifications via Input Report `0x08` or `0x09` (`device.addEventListener('inputreport', ...)`).

---

## 2. Packet Framing & Layout

Every packet transmitted between host and mouse is exactly **17 bytes** long:

```
 Byte Index:   0      1      2      3      4     ...    15     16
            +------+------+------+------+------+-----+------+------+
            | RID  | CMD  |           Payload Data          | CHK  |
            +------+------+------+------+------+-----+------+------+
             0x08    Op     Param  Addr   Len   ...   Padding Sum55
```

| Byte Offset | Field | Description |
| :---: | :--- | :--- |
| **0** | **Report ID** | Always `0x08`. In WebHID `sendFeatureReport(reportId, data)`, byte 0 is passed as the first argument, and `data` contains bytes `1..16`. |
| **1** | **Command Opcode (CMD)** | Identifies the action (`0x01`, `0x02`, `0x03`, `0x04`, `0x07`, `0x08`, `0x09`, `0x10`). |
| **2..15** | **Arguments & Payload** | 14 bytes dedicated to addresses, chunk lengths, data payload, or zero-padding. |
| **16** | **Modulo-256 Checksum** | Checksum byte ensuring packet integrity. |

---

## 3. Checksum Algorithm (Modulo-256 Sum-to-`0x55`)

The mouse firmware validates every incoming packet against a strict arithmetic rule: **the sum of all 17 bytes modulo 256 must equal `0x55`**.

$$\sum_{i=0}^{16} \text{Packet}[i] \equiv 0x55 \pmod{256}$$

### Checksum Calculation
To compute the checksum byte for transmission:
$$\text{Packet}[16] = \left( 0x55 - \sum_{i=0}^{15} \text{Packet}[i] \right) \ \& \ 0xFF$$

### Validation Rule
Upon receiving an inbound report from the mouse:
$$\left( \sum_{i=0}^{16} \text{Packet}[i] \right) \ \& \ 0xFF \stackrel{?}{=} 0x55$$

*Note: In WebHID, when `sendFeatureReport` accepts a 16-byte payload (omitting byte 0), remember that byte 0 (`0x08`) is still included in the 17-byte sum!*

```typescript
export function calculateChecksum(packet17: Uint8Array | number[]): number {
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    sum = (sum + packet17[i]) & 0xff;
  }
  return (0x55 - sum) & 0xff;
}
```

---

## 4. Hardware Storage Architecture: Dual-Tier Model

The Areson MCU architecture employs a **two-tier memory model**:

```
[ WebHID Client / Driver ]
            │
            │  CMD 0x07 (WriteEEPROM) ───► Fast (<1 ms), non-blocking
            ▼
┌──────────────────────────────────────────────┐
│  Areson MCU - Shadow EEPROM (SRAM Volatile)  │ ──► Direct hardware register control
└──────────────────────────────────────────────┘     (PixArt CPI registers, PWM LED timers)
            │
            │  CMD 0x09 (CommitFlash) ────► High latency (50–100 ms), stalls USB polling
            ▼
┌──────────────────────────────────────────────┐
│     SPI NOR Flash Physical (Non-Volatile)    │ ──► Survives power-off & cable unplug
└──────────────────────────────────────────────┘
```

1. **SRAM Shadow EEPROM (`0x00`..`0x1AFF`)**:
   - Internal MCU memory buffer directly mapped to hardware registers.
   - Operations via **CMD `0x07` (WriteEEPROM)** take under 1 millisecond.
   - Real-time updates with zero sensor lag or cursor jitter.
   - Content is volatile: lost when mouse power is switched off or battery runs out.
2. **Physical SPI NOR Flash Memory**:
   - Onboard non-volatile flash chip.
   - Operations via **CMD `0x09` (CommitFlash)** perform hardware sector erase and page programming.
   - During flashing (~50–100 ms), the MCU halts interrupts, causing mouse polling to stall briefly.
   - Flash chips have endurance limits (~100,000 write cycles).
3. **Application Strategy**:
   - Routine adjustments (sliders, color pickers, DPI steps) should write to **SRAM EEPROM via CMD `0x07`**.
   - Issue **CMD `0x09` (CommitFlash)** only when explicitly requested (e.g. "Save to Mouse" button) or during factory reset.

---

## 5. Command Reference Table

| CMD | Name | Dir | Description & Byte Structure |
| :---: | :--- | :---: | :--- |
| `0x01` | `CMD_CHECK_PSD` | Out | Pairing & authentication challenge.<br>`buf[1] = 0x01`<br>`buf[4] = 0x08` (Length)<br>`buf[5..8] = 4 random challenge bytes`<br>Response confirms `CID=4`, `MID=1`. |
| `0x02` | `CMD_HANDSHAKE`<br>`TellDrvStatus` | Out | Informs mouse firmware whether software is active.<br>`buf[1] = 0x02`<br>`buf[5] = 0x01`<br>`buf[6] = 0x01` (Active) or `0x00` (Exiting). |
| `0x03` | `CMD_GET_CONNECT_STATUS` | Out | Queries 2.4 GHz wireless link status on dongle (`0xFA7C`).<br>`buf[1] = 0x03`<br>Response byte 1 == 0 indicates active link, non-zero indicates offline. |
| `0x04` | `CMD_GET_BATTERY` | Out | Queries battery capacity and charging status.<br>`buf[1] = 0x04`<br>Payload bytes 2..15 = `0x00`.<br>Response via Input Report: byte 5 = battery %, byte 6 = charging bit. |
| `0x07` | `CMD_WRITE_EEPROM` | Out | Writes up to 10 bytes to SRAM EEPROM.<br>`buf[1] = 0x07`<br>`buf[2] = 0x00`<br>`buf[3] = addr_hi`<br>`buf[4] = addr_lo`<br>`buf[5] = length` (1..10)<br>`buf[6..15] = data payload` (padded with `0x00`). |
| `0x08` | `CMD_READ_EEPROM` | Out | Requests reading up to 10 bytes from EEPROM.<br>`buf[1] = 0x08`<br>`buf[2] = 0x00`<br>`buf[3] = addr_hi`<br>`buf[4] = addr_lo`<br>`buf[5] = length` (1..10).<br>Response delivered via Input Report: data starts at byte 6. |
| `0x09` | `CMD_COMMIT_FLASH` | Out | Commits current SRAM EEPROM buffer into physical SPI NOR Flash.<br>`buf[1] = 0x09`<br>`buf[2..15] = 0x00` (zero padding). |
| `0x0A` | `CMD_DEVICE_EVENT` | In | Physical button event pushed asynchronously by mouse.<br>`buf[0] = 0x0A`<br>`buf[5] = Event Bitmask`:<br>• `bit 0` (`0x01`): DPI Stage change $\rightarrow$ `buf[6]` = 0-indexed stage (`0..6`).<br>• `bit 1` (`0x02`): Polling rate change $\rightarrow$ `buf[7] & 0x0F` = rate code.<br>• `bit 2` (`0x04`): Profile switch $\rightarrow$ `buf[9]` = profile index.<br>• `bit 7` (`0x80`): Main RGB mode button pressed $\rightarrow$ re-read `0xA0`.<br>• `bit 6` (`0x40`): Logo RGB switch button pressed $\rightarrow$ re-read `0x54`.<br>• `bit 5` (`0x20`): DPI Effect button pressed $\rightarrow$ re-read `0x4C`. |
| `0x0F` | `CMD_ACK` | In | Hardware acknowledge packet confirming command reception. |
| `0x10` | `CMD_SET_PROFILE` | Out | Switches active on-board memory profile slot.<br>`buf[1] = 0x10`<br>`buf[2..4] = 0x00`<br>`buf[5] = 0x01`<br>`buf[6] = profile_index` (`0..3` for Profiles 1..4). |

---

## 6. Timing, Retry, and Delay Constraints

Reverse engineering of `OemDrv.exe` (VA `0x4486c7`, `0x449260`, and `0x447810`) reveals strict hardware timing rules:

1. **Write Retry Loop (`HidD_SetFeature`)**:
   - The driver allows up to **3 attempts** for every transmitted feature report.
   - If transmission fails, it waits **50 milliseconds** (`Sleep(0x32)`) before reattempting.
2. **Read Chunk Pacing**:
   - When reading multiple 10-byte EEPROM chunks sequentially (e.g. reading the 181-byte profile), an interval of **10 milliseconds** (`Sleep(10)`) is inserted between chunks.
   - This prevents buffer overflow in the MCU USB endpoint FIFO.
3. **Response Timeout**:
   - Acknowledgment wait timeout is set to **200 milliseconds** (`0xC8`).
   - If no input report matching the requested CMD is received within 200 ms, the operation is considered timed out.
4. **Flash Commit Delay**:
   - After issuing **CMD `0x09` (CommitFlash)**, wait a minimum of **100 milliseconds** before issuing further commands to allow the SPI NOR Flash sector write cycle to complete.
