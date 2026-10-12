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
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
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

export class XD5Protocol {
  device: HIDDevice | null = null;
  batteryTimer: TimerHandle | null = null;
  onLog: ((msg: string, type: 'in' | 'out' | 'err') => void) | null = null;
  onBatteryUpdate: ((status: BatteryStatus) => void) | null = null;
  onDeviceEvent: ((event: DeviceEvent) => void) | null = null;

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
      (addr >> 8) & 0xff,
      addr & 0xff,
      chunkLen,
    ]);
  }

  async requestAndOpen(): Promise<HIDDevice | null> {
    if (typeof navigator === 'undefined' || !navigator.hid) {
      throw new Error('WebHID API is not supported in this browser.');
    }

    const devices = await navigator.hid.requestDevice({
      filters: [
        { vendorId: VID, productId: PID_WIRED },
        { vendorId: VID, productId: PID_WIRELESS },
      ],
    });

    if (!devices || devices.length === 0) {
      return null;
    }

    return await this.open(devices[0]);
  }

  async open(hidDevice: HIDDevice): Promise<HIDDevice> {
    this.device = hidDevice;
    await this.device.open();

    this.device.addEventListener('inputreport', (e) => this.handleInputReport(e));

    const isWireless = this.device.productId === PID_WIRELESS;
    this.log(`Connected: ${this.device.productName || 'Fantech Helios Go XD5'} (${isWireless ? '2.4GHz Wireless' : 'Wired USB'})`, 'in');

    // Initial handshake
    await this.sendHandshake(true);
    // Initial battery query
    await this.queryBattery();

    // Start battery polling
    this.startBatteryPolling();
    return this.device;
  }

  close(): void {
    clearInterval(this.batteryTimer as number);
    this.batteryTimer = null;
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
    await this.device.sendFeatureReport(reportId, data);
    const hex = Array.from(packet).map(b => b.toString(16).padStart(2, '0')).join(' ');
    this.log(`TX [Feature 0x08]: ${hex}`, 'out');
  }

  handleInputReport(event: { reportId: number; data: DataView }): void {
    const { reportId, data } = event;
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
    this.log(`RX [Input 0x${reportId.toString(16).padStart(2, '0')}]: ${hex}`, 'in');

    // Command 0x04 Battery response
    if (bytes[0] === CMD_GET_BATTERY || (bytes.length >= 11 && bytes[1] === CMD_GET_BATTERY)) {
      const power = bytes[8] !== undefined ? bytes[8] : bytes[9];
      const charging = bytes[9] !== undefined ? bytes[9] : bytes[10];
      if (this.onBatteryUpdate && power !== undefined) {
        this.onBatteryUpdate({ power, charging: !!charging });
      }
    }

    // Command 0x0A Physical DPI Button Event
    if (bytes[0] === CMD_DEVICE_EVENT && bytes.length >= 7) {
      const stage = bytes[5];
      this.log(`Hardware DPI Button Pressed: Stage ${stage}`, 'in');
      if (this.onDeviceEvent) {
        this.onDeviceEvent({ type: 'dpi_change', stage });
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
    const pkt = this.buildPacket(CMD_SET_PROFILE, [0, 0, 0, idx, 1]);
    await this.sendFeatureReport(pkt);
    await this.writeEEPROM(EEPROM_ADDR.ACTIVE_PROFILE, [idx]);
  }

  async writeEEPROM(startAddr: number, data: number[] | Uint8Array): Promise<void> {
    let offset = 0;
    const arrayData = Array.isArray(data) ? data : Array.from(data);
    while (offset < arrayData.length) {
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

  async readEEPROM(startAddr: number, totalLen: number): Promise<Uint8Array> {
    const result = new Uint8Array(totalLen);
    let offset = 0;
    while (offset < totalLen) {
      const chunkLen = Math.min(10, totalLen - offset);
      const addr = startAddr + offset;
      const pkt = this.buildReadEEPROM(addr, chunkLen);
      this.log(`Reading EEPROM @ 0x${addr.toString(16).padStart(4, '0')}...`);
      await this.sendFeatureReport(pkt);
      await delay(20);
      offset += chunkLen;
    }
    return result;
  }

  async commitFlash(): Promise<void> {
    this.log('Committing changes to mouse flash memory (Cmd 0x09)...');
    const pkt = this.buildPacket(CMD_COMMIT_FLASH);
    await this.sendFeatureReport(pkt);
  }
}
