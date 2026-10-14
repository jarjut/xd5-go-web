# Fantech Helios Go XD5 — WebHID Integration Guide

Step-by-step developer guide and production TypeScript blueprints for integrating the **Fantech Helios Go XD5** gaming mouse into web applications using the W3C WebHID API.

---

## 1. Browser Requirements & Permissions

WebHID is supported in all modern Chromium-based browsers:
- **Google Chrome** (v89+)
- **Microsoft Edge** (v89+)
- **Brave** / **Opera** (v75+)
- *Note: Firefox and Safari do not support the WebHID standard.*

### Security Context
WebHID requires a **Secure Context**:
- `https://` domain with valid SSL, or
- `http://localhost` / `http://127.0.0.1` during local development.

---

## 2. Requesting & Selecting the Primary HID Interface

The mouse exposes multiple USB HID collections. Interface 0 is standard mouse pointer input (restricted by browsers). We must connect to the vendor configuration interface declaring **Feature Report ID `0x08`**.

```typescript
export const VID = 0x25a7;
export const PID_WIRED = 0xfa7b;
export const PID_WIRELESS = 0xfa7c;
export const REPORT_ID = 0x08;

export async function requestXD5Device(): Promise<HIDDevice> {
  const devices = await navigator.hid.requestDevice({
    filters: [
      { vendorId: VID, productId: PID_WIRED },
      { vendorId: VID, productId: PID_WIRELESS },
    ],
  });

  if (!devices || devices.length === 0) {
    throw new Error('No device selected by user.');
  }

  return selectConfigInterface(devices);
}

export function selectConfigInterface(devices: HIDDevice[]): HIDDevice {
  // 1. Look for interface explicitly declaring Feature Report ID 8
  const withFeature8 = devices.find((d) =>
    d.collections?.some((c) => c.featureReports?.some((r) => r.reportId === REPORT_ID))
  );
  if (withFeature8) return withFeature8;

  // 2. Look for interface declaring Input Report 8 or 9
  const withInput8or9 = devices.find((d) =>
    d.collections?.some((c) => c.inputReports?.some((r) => r.reportId === 8 || r.reportId === 9))
  );
  if (withInput8or9) return withInput8or9;

  // 3. Fallback: Prefer vendor usage page (0xFF00 - 0xFFFF)
  const withVendorPage = devices.find((d) =>
    d.collections?.some((c) => c.usagePage !== undefined && c.usagePage >= 0xff00)
  );
  if (withVendorPage) return withVendorPage;

  // 4. Fallback: If multiple interfaces exist, interface 0 is restricted mouse, pick the last
  return devices.length > 1 ? devices[devices.length - 1] : devices[0];
}
```

---

## 3. Packet Framing & Checksum Helper

Every packet sent to the mouse is packaged as a 17-byte buffer with a modulo-256 sum equal to `0x55`.

```typescript
export function buildPacket(cmd: number, payload: number[] = []): Uint8Array {
  const buf = new Uint8Array(17);
  buf[0] = REPORT_ID; // 0x08
  buf[1] = cmd;

  for (let i = 0; i < 14; i++) {
    buf[2 + i] = payload[i] ?? 0;
  }

  // Calculate modulo-256 checksum
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    sum = (sum + buf[i]) & 0xff;
  }
  buf[16] = (0x55 - sum) & 0xff;

  return buf;
}
```

### Transmitting Packets via WebHID
In WebHID, `sendFeatureReport(reportId, data)` takes `data` containing bytes `1..16` (excluding `reportId`):

```typescript
export async function sendCommand(device: HIDDevice, cmd: number, payload: number[] = []): Promise<void> {
  const packet17 = buildPacket(cmd, payload);
  // Slice out bytes 1..16 for sendFeatureReport
  const data16 = packet17.slice(1);

  let success = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await device.sendFeatureReport(REPORT_ID, data16);
      success = true;
      break;
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 50)); // 50ms retry delay
    }
  }
}
```

---

## 4. Reading On-Board EEPROM Data

Reading EEPROM is performed in **10-byte chunks** using **CMD `0x08` (`CMD_READ_EEPROM`)**. The mouse responds via an asynchronous `inputreport` event.

### Correlation Pattern with Promises
```typescript
class XD5Reader {
  private device: HIDDevice;
  private pendingResolvers = new Map<number, (data: Uint8Array) => void>();

  constructor(device: HIDDevice) {
    this.device = device;
    this.device.addEventListener('inputreport', this.handleInputReport.bind(this));
  }

  private handleInputReport(e: HIDInputReportEvent) {
    const bytes = new Uint8Array(e.data.buffer);
    const reportId = e.reportId;

    // Response to CMD 0x08: bytes[0] is CMD (0x08) or reportId is 8
    const isEepromResponse = bytes[0] === 0x08 || (reportId === 0x08 && bytes.length >= 16);
    if (isEepromResponse) {
      const addrHi = bytes[2];
      const addrLo = bytes[3];
      const len = bytes[4];
      const addr = (addrHi << 8) | addrLo;
      const chunkData = bytes.slice(5, 5 + len);

      const resolver = this.pendingResolvers.get(addr);
      if (resolver) {
        this.pendingResolvers.delete(addr);
        resolver(chunkData);
      }
    }
  }

  async readChunk(address: number, length: number): Promise<Uint8Array> {
    const addrHi = (address >> 8) & 0xff;
    const addrLo = address & 0xff;

    const promise = new Promise<Uint8Array>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResolvers.delete(address);
        reject(new Error(`Timeout reading EEPROM at 0x${address.toString(16)}`));
      }, 500);

      this.pendingResolvers.set(address, (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    await sendCommand(this.device, 0x08, [0x00, addrHi, addrLo, length]);
    return promise;
  }

  async readFullProfile(): Promise<Uint8Array> {
    const profile = new Uint8Array(181);
    let offset = 0;

    while (offset < 181) {
      const chunkSize = Math.min(10, 181 - offset);
      const chunk = await this.readChunk(offset, chunkSize);
      profile.set(chunk, offset);
      offset += chunkSize;

      // 10ms pacing delay between chunks
      await new Promise((r) => setTimeout(r, 10));
    }

    return profile;
  }
}
```

---

## 5. Writing to SRAM EEPROM & Committing to Flash

```typescript
export async function writeEEPROMChunk(device: HIDDevice, address: number, data: Uint8Array | number[]): Promise<void> {
  const addrHi = (address >> 8) & 0xff;
  const addrLo = address & 0xff;
  const len = data.length;

  const payload = [0x00, addrHi, addrLo, len, ...data];
  await sendCommand(device, 0x07, payload);
}

export async function writeFullProfile(device: HIDDevice, profile181: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < profile181.length) {
    const chunkSize = Math.min(10, profile181.length - offset);
    const chunk = profile181.slice(offset, offset + chunkSize);
    await writeEEPROMChunk(device, offset, chunk);
    offset += chunkSize;
    await new Promise((r) => setTimeout(r, 10)); // 10ms delay
  }
}

export async function commitFlash(device: HIDDevice): Promise<void> {
  // Command 0x09: Flashes SRAM into SPI NOR Flash
  await sendCommand(device, 0x09);
  // Wait 100ms for flash write cycle
  await new Promise((r) => setTimeout(r, 100));
}
```

---

## 6. Listening to Hardware Push Events (`0x0A`)

When the user physically presses the DPI button, Profile switch, or underside RGB button, the mouse pushes an Input Report with **CMD `0x0A`**:

```typescript
export interface DeviceEvents {
  onDpiChange?: (stage: number) => void;
  onPollingRateChange?: (hz: number) => void;
  onProfileChange?: (profileIndex: number) => void;
  onRgbModeSwitched?: () => void;
}

export function attachHardwareEventListener(device: HIDDevice, callbacks: DeviceEvents): void {
  device.addEventListener('inputreport', (e) => {
    const bytes = new Uint8Array(e.data.buffer);
    if (bytes[0] !== 0x0a || bytes.length < 8) return;

    const flags = bytes[5];

    // Bit 0: Physical DPI button clicked
    if ((flags & 0x01) !== 0) {
      const stageIndex = bytes[6]; // 0-indexed (0..6)
      callbacks.onDpiChange?.(stageIndex + 1); // 1-indexed (1..7)
    }

    // Bit 1: Physical Polling Rate switch
    if ((flags & 0x02) !== 0) {
      const rateCode = bytes[7] & 0x0f;
      const rateMap: Record<number, number> = { 1: 1000, 2: 500, 4: 250, 8: 125 };
      callbacks.onPollingRateChange?.(rateMap[rateCode] ?? 1000);
    }

    // Bit 2: Profile switch
    if ((flags & 0x04) !== 0) {
      const profileIndex = bytes[9];
      callbacks.onProfileChange?.(profileIndex);
    }

    // Bit 7: Hardware RGB button pressed
    if ((flags & 0x80) !== 0) {
      callbacks.onRgbModeSwitched?.();
    }
  });
}
```

---

## 7. Polling Battery & Charging Status

```typescript
export interface BatteryState {
  percentage: number;
  charging: boolean;
}

export async function queryBattery(device: HIDDevice): Promise<void> {
  // CMD 0x04: Get Battery
  await sendCommand(device, 0x04);
}

export function attachBatteryListener(device: HIDDevice, onBattery: (b: BatteryState) => void): void {
  device.addEventListener('inputreport', (e) => {
    const bytes = new Uint8Array(e.data.buffer);
    if (bytes[0] === 0x04 && bytes.length >= 7) {
      const percentage = bytes[5];
      const charging = Boolean(bytes[6]);
      onBattery({ percentage, charging });
    }
  });
}
```
