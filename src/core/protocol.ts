/**
 * FANTECH Helios Go XD5 - WebHID Protocol Engine
 * Implements reverse-engineered packet framing, checksums, and EEPROM commands.
 */

import type {
  HIDDevice,
  BatteryStatus,
  DeviceEvent,
  TransportType,
  EncodedDpi,
  DecodedDpiStage,
  TimerHandle,
} from '../types/protocol';

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export const VID = 0x25a7;
export const PID_WIRED = 0xfa7b;
export const PID_WIRELESS = 0xfa7c;
export const REPORT_ID = 0x08;

export const CMD_HANDSHAKE    = 0x02; // TellDrvStatus (1 = active, 0 = exiting)
export const CMD_GET_BATTERY  = 0x04; // Read battery & charging state
export const CMD_WRITE_EEPROM = 0x07; // Write up to 10 bytes to mouse EEPROM
export const CMD_READ_EEPROM  = 0x08; // Read up to 10 bytes from mouse EEPROM
export const CMD_COMMIT_FLASH = 0x09; // Commit EEPROM buffer to flash memory
export const CMD_DEVICE_EVENT = 0x0a; // Physical DPI/profile change push notification
export const CMD_SET_PROFILE  = 0x10; // Hardware profile selector

// EEPROM Memory Map
export const EEPROM_ADDR = {
  POLLING_RATE:    0x00, // 1 byte: 0x01=1000Hz, 0x02=500Hz, 0x04=250Hz, 0x08=125Hz
  ACTIVE_PROFILE:  0x01, // 1 byte: profile index 0..3
  STAGE_COUNT:     0x02, // 1 byte: active DPI stage count
  CURRENT_DPI_IDX: 0x04, // 1 byte: active DPI stage index (0..6)
  LOD:             0x0a, // 1 byte: 1 = 1mm, 2 = 2mm
  DPI_STAGES:      0x0c, // 28 bytes: 7 stages x 4 bytes (X, Y, Mul, Checksum)
  DPI_COLORS:      0x2c, // 28 bytes: 7 stages x 4 bytes (R, G, B, 0)
  DPI_EFFECT:      0x4c, // 8 bytes: DPI indicator behavior
  KEY_MATRIX:      0x60, // 24 bytes: 6 buttons x 4 bytes LE dword
  LIGHTING:        0xa0, // 8 bytes: [mode, R, G, B, speed, bri, 0, 0]
  DEBOUNCE:        0xa9, // 1 byte: 4..20 ms
  SLEEP_MINUTES:   0xad, // 1 byte: 1..20 min
  ANGLE_SNAPPING:  0xaf, // 1 byte: 0 = off, 1 = on (FixLine)
  RIPPLE_CONTROL:  0xb1, // 1 byte: 0 = off, 1 = on
  LIGHT_OFF_MOVE:  0xb3, // 1 byte: 0 = off, 1 = on
} as const;

export const POLLING_RATES: Record<number, number> = {
  1000: 0x01,
  500:  0x02,
  250:  0x04,
  125:  0x08,
};

export const POLLING_CODES: Record<number, number> = {
  0x01: 1000,
  0x02: 500,
  0x04: 250,
  0x08: 125,
};

export const STREAMING_SPEED_TABLE = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
export const STREAMING_BRIGHTNESS_TABLE = [72, 92, 112, 132, 152, 172, 192, 212, 232, 252] as const;
export const SPEED_TABLE = [255, 230, 210, 190, 170, 150, 130, 110, 70, 40] as const;
export const BRIGHTNESS_TABLE = [45, 50, 75, 100, 125, 150, 175, 200, 225, 255] as const;

export const LED_MODES = {
  STREAMING: 0,
  BREATHING: 1,
  STEADY: 2,
  NEON: 3,
  OFF: 4,
  SCROLLING: 5,
  COLORFUL_BREATHING: 7,
} as const;

/**
 * Calculates modulo-256 checksum where sum(packet[0..16]) == 0x55
 */
export function calculateChecksum(buf: Uint8Array | number[]): number {
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    sum = (sum + buf[i]) & 0xff;
  }
  return (0x55 - sum) & 0xff;
}

export const calcChecksum = calculateChecksum;

/**
 * Encodes a DPI value (50 - 19000) for PixArt PAW3370 sensor
 */
export function encodeDpi(dpi: number): EncodedDpi {
  const boundedDpi = Math.max(50, Math.min(19000, Number(dpi) || 800));
  if (boundedDpi <= 10000) {
    const raw = Math.round(boundedDpi / 50) - 1;
    return { raw, mul: 0 };
  } else {
    const raw = Math.round(boundedDpi / 100) - 1;
    return { raw, mul: 2 };
  }
}

/**
 * Decodes raw byte and multiplier into human-readable DPI
 */
export function decodeDpi(raw: number, mul: number): number {
  const step = (mul & 2) ? 100 : 50;
  let dpi = (raw + 1) * step;
  if (mul & 1) dpi *= 2;
  return dpi;
}

/**
 * Encodes a 4-byte DPI stage block with internal checksum:
 * byte[0] = xRaw, byte[1] = yRaw, byte[2] = mulByte, byte[3] = checksum
 * xRaw + yRaw + mulByte + checksum == 0x55 (mod 256)
 */
export function encodeDpiStage(xDpi: number, yDpi: number): [number, number, number, number] {
  const xEnc = encodeDpi(xDpi);
  const yEnc = encodeDpi(yDpi);
  const mulByte = ((yEnc.mul & 0x0f) << 4) | (xEnc.mul & 0x0f);
  const chk = (0x55 - xEnc.raw - yEnc.raw - mulByte) & 0xff;
  return [xEnc.raw, yEnc.raw, mulByte, chk];
}

/**
 * Decodes a 4-byte DPI stage block
 */
export function decodeDpiStage(bytes: Uint8Array | number[]): DecodedDpiStage {
  const xRaw = bytes[0];
  const yRaw = bytes[1];
  const mul = bytes[2];
  const xMul = mul & 0x0f;
  const yMul = (mul >> 4) & 0x0f;
  return {
    xDpi: decodeDpi(xRaw, xMul),
    yDpi: decodeDpi(yRaw, yMul),
  };
}

export function selectPrimaryDevice(devices: HIDDevice[]): HIDDevice {
  if (!devices || devices.length === 0) {
    throw new Error('No HID devices provided.');
  }
  // 1. Prioritize interface declaring Feature Report ID 8 (0x08)
  const withFeature8 = devices.find((d) =>
    d.collections?.some((c) => c.featureReports?.some((r) => r.reportId === 8))
  );
  if (withFeature8) return withFeature8;

  // 2. Prioritize interface declaring Input Report ID 9 or 8
  const withInput8or9 = devices.find((d) =>
    d.collections?.some((c) => c.inputReports?.some((r) => r.reportId === 8 || r.reportId === 9))
  );
  if (withInput8or9) return withInput8or9;

  // 3. Prioritize Vendor-defined usage page (0xFF00 - 0xFFFF)
  const withVendorPage = devices.find((d) =>
    d.collections?.some((c) => c.usagePage !== undefined && c.usagePage >= 0xff00)
  );
  if (withVendorPage) return withVendorPage;

  // 4. Prioritize interface with any feature reports defined
  const withAnyFeature = devices.find((d) =>
    d.collections?.some((c) => c.featureReports && c.featureReports.length > 0)
  );
  if (withAnyFeature) return withAnyFeature;

  // 5. Fallback: if multiple interfaces exist, interface 0 is usually standard mouse (restricted/read-only),
  // so prefer later interfaces. If only one, pick it.
  return devices.length > 1 ? devices[devices.length - 1] : devices[0];
}

export class XD5Protocol {
  private connectionGeneration = 0;
  private readonly interfaceGenerations = new WeakMap<HIDDevice, number>();
  device: HIDDevice | null = null;
  openedDevices: HIDDevice[] = [];
  batteryTimer: TimerHandle | null = null;
  onLog: ((msg: string, type: 'in' | 'out' | 'err') => void) | null = null;
  onBatteryUpdate: ((status: BatteryStatus) => void) | null = null;
  onDeviceEvent: ((event: DeviceEvent) => void) | null = null;
  pendingReadResolvers: Map<number, (data: Uint8Array) => void> = new Map();
  mockEEPROM: Uint8Array | null = null;
  log(msg: string, type: 'in' | 'out' | 'err' = 'out'): void {
    if (this.onLog) this.onLog(msg, type);
  }
  get isConnected(): boolean {
    return !!(this.device && this.device.opened);
  }

  get transport(): TransportType {
    if (!this.isConnected || !this.device) return 'disconnected';
    return this.device.productId === PID_WIRELESS ? 'wireless' : 'wired';
  }

  calcChecksum(buf: Uint8Array | number[]): number {
    return calculateChecksum(buf);
  }

  buildFeatureReport(cmd: number, args: number[] = []): Uint8Array {
    const buf = new Uint8Array(17);
    buf[0] = REPORT_ID;
    buf[1] = cmd;
    for (let i = 0; i < args.length && i < 14; i++) {
      buf[2 + i] = args[i];
    }
    buf[16] = calculateChecksum(buf);
    return buf;
  }

  buildPacket(cmdId: number, payload: number[] = []): Uint8Array {
    return this.buildFeatureReport(cmdId, payload);
  }

  buildWriteEEPROM(addr: number, data: number[]): Uint8Array {
    const chunkLen = Math.min(10, data.length);
    const chunk = data.slice(0, chunkLen);
    const payload = [
      0x00,
      (addr >> 8) & 0xff,
      addr & 0xff,
      chunkLen,
      ...chunk,
    ];
    return this.buildFeatureReport(CMD_WRITE_EEPROM, payload);
  }

  buildReadEEPROM(addr: number, len: number): Uint8Array {
    const chunkLen = Math.min(10, len);
    return this.buildFeatureReport(CMD_READ_EEPROM, [
      0x00,
      (addr >> 8) & 0xff,
      addr & 0xff,
      chunkLen,
    ]);
  }

  async requestAndOpen(): Promise<HIDDevice | null> {
    if (typeof navigator === 'undefined' || !navigator.hid) {
      throw new Error('WebHID API is not supported in this browser.');
    }

    const generation = this.connectionGeneration;
    const requested = await navigator.hid.requestDevice({
      filters: [
        { vendorId: VID, productId: PID_WIRED },
        { vendorId: VID, productId: PID_WIRELESS },
      ],
    });

    if (!requested || requested.length === 0) {
      return null;
    }

    // Retrieve all granted devices for this VID to ensure all interfaces are captured
    const allCandidates: HIDDevice[] = [...requested];
    try {
      const permitted = await navigator.hid.getDevices();
      for (const d of permitted) {
        if (d.vendorId === VID && (d.productId === PID_WIRED || d.productId === PID_WIRELESS)) {
          if (!allCandidates.includes(d)) {
            allCandidates.push(d);
          }
        }
      }
    } catch {
      // ignore error
    }

    const primaryDevice = selectPrimaryDevice(allCandidates);
    if (generation !== this.connectionGeneration) return null;
    return await this.open(primaryDevice, allCandidates);
  }

  async open(hidDevice: HIDDevice, allCandidateDevices: HIDDevice[] = [hidDevice]): Promise<HIDDevice> {
    this.close();
    const generation = this.connectionGeneration;
    const devicesToOpen = allCandidateDevices.length > 0 ? allCandidateDevices : [hidDevice];
    const openedList: HIDDevice[] = [];
    const attempted: HIDDevice[] = [];

    try {
      for (const device of devicesToOpen) {
        if (generation !== this.connectionGeneration) throw new Error('Mouse connection changed.');
        this.interfaceGenerations.set(device, generation);
        attempted.push(device);
        try {
          if (!device.opened) await device.open();
          if (generation !== this.connectionGeneration) throw new Error('Mouse connection changed.');
          device.addEventListener('inputreport', (event) => {
            if (generation === this.connectionGeneration) this.handleInputReport(event);
          });
          openedList.push(device);
        } catch (error) {
          if (generation !== this.connectionGeneration) throw new Error('Mouse connection changed.');
          this.log(`Warning: Failed to open interface ${device.productName || 'HID'}: ${error}`, 'err');
        }
      }

      this.openedDevices = openedList;
      this.device = hidDevice.opened ? hidDevice : (openedList[0] || hidDevice);
      if (!this.device.opened) await this.device.open();
      if (generation !== this.connectionGeneration) throw new Error('Mouse connection changed.');
      const isWireless = this.device.productId === PID_WIRELESS;
      this.log(
        `Connected: ${this.device.productName || 'Fantech Helios Go XD5'} (${isWireless ? '2.4GHz Wireless' : 'Wired USB'}) [${openedList.length} interfaces opened]`,
        'in'
      );
      await this.sendHandshake(true);
      if (generation !== this.connectionGeneration) throw new Error('Mouse connection changed.');
      await this.queryBattery();
      if (generation !== this.connectionGeneration) throw new Error('Mouse connection changed.');
      this.startBatteryPolling();
      return this.device;
    } catch (error) {
      for (const device of attempted) {
        // A newer attempt may have claimed the same WebHID object while this one awaited open.
        if (this.interfaceGenerations.get(device) !== generation) continue;
        this.interfaceGenerations.delete(device);
        try { await device.close(); } catch { /* Release remaining interfaces even if one close fails. */ }
      }
      if (generation === this.connectionGeneration) {
        this.device = null;
        this.openedDevices = [];
      }
      throw error;
    }
  }

  close(): void {
    this.connectionGeneration++;
    clearInterval(this.batteryTimer as number);
    this.batteryTimer = null;
    for (const d of this.openedDevices) {
      try {
        d.close().catch(() => {});
      } catch {}
    }
    this.openedDevices = [];
    if (this.device) {
      this.sendHandshake(false).catch(() => {});
      this.device.close().catch(() => {});
      this.device = null;
    }
    this.log('Device closed.', 'err');
  }

  async sendFeatureReport(packet: Uint8Array): Promise<void> {
    if (!this.isConnected || !this.device) throw new Error('Mouse is not connected.');
    const reportId = packet[0];
    const data = packet.subarray(1); // WebHID payload excludes report ID

    try {
      await this.device.sendFeatureReport(reportId, data);
    } catch (err) {
      let sent = false;
      for (const d of this.openedDevices) {
        if (d !== this.device && d.opened) {
          try {
            await d.sendFeatureReport(reportId, data);
            this.device = d;
            sent = true;
            break;
          } catch {}
        }
      }
      if (!sent) throw err;
    }

    const hex = Array.from(packet).map(b => b.toString(16).padStart(2, '0')).join(' ');
    this.log(`TX [Feature 0x08]: ${hex}`, 'out');
  }

  handleInputReport(event: { reportId: number; data: DataView }): void {
    const { reportId, data } = event;
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
    this.log(`RX [Input 0x${reportId.toString(16).padStart(2, '0')}]: ${hex}`, 'in');

    // Command 0x08 EEPROM Read Response (OemDrv.exe VA 0x448ac0..0x448aed)
    const isEepromResponse =
      bytes[0] === CMD_READ_EEPROM ||
      (bytes.length >= 7 && bytes[1] === CMD_READ_EEPROM) ||
      (reportId === CMD_READ_EEPROM && bytes.length >= 6);

    if (isEepromResponse) {
      const offset = bytes[0] === CMD_READ_EEPROM ? 0 : (bytes[1] === CMD_READ_EEPROM ? 1 : -1);
      const addrHi = offset >= 0 ? bytes[offset + 2] : bytes[1];
      const addrLo = offset >= 0 ? bytes[offset + 3] : bytes[2];
      const respAddr = (addrHi << 8) | addrLo;
      const chunkLen = (offset >= 0 ? bytes[offset + 4] : bytes[3]) || 10;
      const dataStart = offset >= 0 ? offset + 5 : 4;
      const chunkData = bytes.slice(dataStart, dataStart + chunkLen);
      const chunkHex = Array.from(chunkData).map(b => b.toString(16).padStart(2, '0')).join(' ');
      this.log(`RX [EEPROM Read 0x${respAddr.toString(16).padStart(4, '0')}]: ${chunkLen} bytes (${chunkHex})`, 'in');

      const resolver = this.pendingReadResolvers.get(respAddr);
      if (resolver) {
        this.pendingReadResolvers.delete(respAddr);
        resolver(chunkData);
      } else {
        const firstEntry = this.pendingReadResolvers.entries().next().value;
        if (firstEntry) {
          const [firstAddr, firstResolver] = firstEntry;
          this.pendingReadResolvers.delete(firstAddr);
          firstResolver(chunkData);
        }
      }
    }

    // Command 0x04 Battery response (OemDrv.exe VA 0x449213 / 0x449218)
    const isBatteryResponse =
      bytes[0] === CMD_GET_BATTERY ||
      (bytes.length >= 7 && bytes[1] === CMD_GET_BATTERY) ||
      (reportId === CMD_GET_BATTERY && bytes.length >= 6);

    if (isBatteryResponse) {
      const offset = bytes[0] === CMD_GET_BATTERY ? 0 : (bytes[1] === CMD_GET_BATTERY ? 1 : -1);
      const power = offset >= 0 ? bytes[offset + 5] : bytes[4];
      const charging = offset >= 0 ? bytes[offset + 6] : bytes[5];
      if (this.onBatteryUpdate && power !== undefined) {
        this.onBatteryUpdate({ power, charging: Boolean(charging) });
      }
    }

    // Command 0x0A Physical Hardware Event (OemDrv.exe VA 0x447700..0x447745)
    if (bytes[0] === CMD_DEVICE_EVENT && bytes.length >= 7) {
      const flags = bytes[5];
      if ((flags & 0x01) !== 0) {
        const stage = bytes[6];
        this.log(`Hardware DPI Button Pressed: Stage ${stage}`, 'in');
        if (this.onDeviceEvent) {
          this.onDeviceEvent({ type: 'dpi_change', stage });
        }
      }
      if ((flags & 0x02) !== 0 && bytes.length >= 8) {
        const profileIndex = bytes[7] & 0x0f;
        this.log(`Hardware Profile Button Pressed: Profile ${profileIndex + 1}`, 'in');
        if (this.onDeviceEvent) {
          this.onDeviceEvent({ type: 'profile_change', profileIndex });
        }
      }
    }
  }

  async sendHandshake(active: boolean = true): Promise<void> {
    this.log(`Sending Driver Handshake (TellDrvStatus: ${active ? 'Active' : 'Exiting'})...`);
    const pkt = this.buildPacket(CMD_HANDSHAKE, [0, 0, 0, 1, active ? 1 : 0]);
    await this.sendFeatureReport(pkt);
  }

  async queryBattery(): Promise<void> {
    const pkt = this.buildPacket(CMD_GET_BATTERY);
    await this.sendFeatureReport(pkt);
  }

  startBatteryPolling(intervalMs: number = 30000): void {
    clearInterval(this.batteryTimer as number);
    this.batteryTimer = null;
    this.batteryTimer = setInterval(() => {
      if (this.isConnected) this.queryBattery().catch(() => {});
    }, intervalMs);
  }

  async setHardwareProfile(profileIdx: number): Promise<void> {
    const idx = Math.max(0, Math.min(3, profileIdx));
    this.log(`Setting Hardware Profile index: ${idx} (Cmd 0x10)...`);
    const pkt = this.buildPacket(CMD_SET_PROFILE, [0, 0, 0, 1, idx]);
    await this.sendFeatureReport(pkt);
    await this.writeEEPROM(EEPROM_ADDR.ACTIVE_PROFILE, [idx]);
  }

  async writeEEPROM(startAddr: number, data: number[] | Uint8Array, isCurrent: () => boolean = () => true): Promise<void> {
    let offset = 0;
    const arrayData = Array.isArray(data) ? data : Array.from(data);
    while (offset < arrayData.length) {
      if (!isCurrent()) throw new Error('Device disconnected during EEPROM write.');
      const chunkLen = Math.min(10, arrayData.length - offset);
      const chunk = arrayData.slice(offset, offset + chunkLen);
      const addr = startAddr + offset;
      const pkt = this.buildWriteEEPROM(addr, chunk);
      this.log(`Writing EEPROM @ 0x${addr.toString(16).padStart(4, '0')} (${chunkLen} bytes)...`);
      await this.sendFeatureReport(pkt);
      await delay(15); // Hardware write settling delay
      offset += chunkLen;
    }
  }

  async readEEPROMChunk(addr: number, chunkLen: number, retries: number = 3, isCurrent: () => boolean = () => true): Promise<Uint8Array> {
    if (this.mockEEPROM) {
      return this.mockEEPROM.subarray(addr, addr + chunkLen);
    }
    for (let attempt = 0; attempt < retries; attempt++) {
      if (!isCurrent()) throw new Error('Device disconnected during EEPROM read.');
      const pkt = this.buildReadEEPROM(addr, chunkLen);
      let cancelRead = () => {};
      const readPromise = new Promise<Uint8Array>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingReadResolvers.delete(addr);
          reject(new Error(`Timeout reading EEPROM @ 0x${addr.toString(16).padStart(4, '0')}`));
        }, 1000);

        this.pendingReadResolvers.set(addr, (data) => {
          clearTimeout(timer);
          resolve(data);
        });
        cancelRead = () => {
          clearTimeout(timer);
          this.pendingReadResolvers.delete(addr);
          resolve(new Uint8Array());
        };
      });

      try {
        await this.sendFeatureReport(pkt);
      } catch (error) {
        cancelRead();
        throw error;
      }

      try {
        const data = await readPromise;
        return data;
      } catch {
        if (!isCurrent() || !this.isConnected) throw new Error('Device disconnected during EEPROM read.');
        this.log(`Retry ${attempt + 1}/${retries} reading EEPROM @ 0x${addr.toString(16).padStart(4, '0')}...`, 'err');
        await delay(35);
      }
    }
    throw new Error(`EEPROM read timed out @ 0x${addr.toString(16).padStart(4, '0')} after ${retries} attempts.`);
  }

  async readEEPROM(startAddr: number, totalLen: number, isCurrent: () => boolean = () => true): Promise<Uint8Array> {
    const result = new Uint8Array(totalLen);
    let offset = 0;
    while (offset < totalLen) {
      if (!isCurrent()) throw new Error('Device disconnected during EEPROM read.');
      const chunkLen = Math.min(10, totalLen - offset);
      const addr = startAddr + offset;
      this.log(`Reading EEPROM @ 0x${addr.toString(16).padStart(4, '0')} (${chunkLen} bytes)...`);
      const chunk = await this.readEEPROMChunk(addr, chunkLen, 3, isCurrent);
      if (chunk.length !== chunkLen) throw new Error(`Incomplete EEPROM chunk (${chunk.length}/${chunkLen} bytes).`);
      result.set(chunk.subarray(0, chunkLen), offset);
      offset += chunkLen;
      await delay(15);
    }
    return result;
  }

  async commitFlash(): Promise<void> {
    this.log('Committing changes to mouse flash memory (Cmd 0x09)...');
    const pkt = this.buildPacket(CMD_COMMIT_FLASH);
    await this.sendFeatureReport(pkt);
  }
}
