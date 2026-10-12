import { describe, it, expect } from 'vitest';
import {
  XD5Protocol,
  calculateChecksum,
  encodeDpi,
  decodeDpi,
  encodeDpiStage,
  decodeDpiStage,
  VID,
  PID_WIRED,
  PID_WIRELESS,
  REPORT_ID,
  CMD_HANDSHAKE,
  CMD_GET_BATTERY,
  CMD_WRITE_EEPROM,
  CMD_READ_EEPROM,
  CMD_COMMIT_FLASH,
  CMD_DEVICE_EVENT,
  CMD_SET_PROFILE,
  EEPROM_ADDR,
  POLLING_RATES,
  POLLING_CODES,
  LED_MODES,
  SPEED_TABLE,
  BRIGHTNESS_TABLE,
} from '../core/protocol';
import { ProfileManager } from '../core/profiles';

describe('XD5Protocol reverse-engineering verification', () => {
  it('correctly calculates 17-byte packet checksum summing to 0x55 mod 256', () => {
    const proto = new XD5Protocol();
    const packet = proto.buildFeatureReport(0x02, [0, 0, 0, 0, 1]);
    expect(packet.length).toBe(17);
    expect(packet[0]).toBe(0x08);
    expect(packet[1]).toBe(0x02);

    // Checksum verification: sum mod 256 === 0x55
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      sum = (sum + packet[i]) & 0xFF;
    }
    expect(sum).toBe(0x55);
  });

  it('correctly converts low DPI range (<= 10,000) using 50-DPI steps', () => {
    const pm = new ProfileManager();
    const res800 = pm.dpiToRaw(800);
    expect(res800.raw).toBe(15); // (800/50)-1 = 15
    expect(res800.mul).toBe(0);
    expect(pm.rawToDpi(15, 0)).toBe(800);

    const res1600 = pm.dpiToRaw(1600);
    expect(res1600.raw).toBe(31);
    expect(res1600.mul).toBe(0);
    expect(pm.rawToDpi(31, 0)).toBe(1600);
  });

  it('correctly converts high DPI range (> 10,000) using 100-DPI steps', () => {
    const pm = new ProfileManager();
    const res16000 = pm.dpiToRaw(16000);
    expect(res16000.raw).toBe(159); // (16000/100)-1 = 159
    expect(res16000.mul).toBe(2);
    expect(pm.rawToDpi(159, 2)).toBe(16000);
  });

  it('verifies PAW3370 edge cases and clamping in encodeDpi / decodeDpi', () => {
    // 50 DPI min clamp
    const minDpi = encodeDpi(30);
    expect(minDpi.raw).toBe(0); // (50/50)-1 = 0
    expect(minDpi.mul).toBe(0);
    expect(decodeDpi(0, 0)).toBe(50);

    // 10,000 DPI boundary (<= 10000 uses 50-step, mul=0)
    const d10k = encodeDpi(10000);
    expect(d10k.raw).toBe(199); // (10000/50)-1 = 199
    expect(d10k.mul).toBe(0);
    expect(decodeDpi(199, 0)).toBe(10000);

    // 10,100 DPI (> 10000 uses 100-step, mul=2)
    const d10100 = encodeDpi(10100);
    expect(d10100.raw).toBe(100); // (10100/100)-1 = 100
    expect(d10100.mul).toBe(2);
    expect(decodeDpi(100, 2)).toBe(10100);

    // 19,000 DPI max clamp
    const maxDpi = encodeDpi(20000);
    expect(maxDpi.raw).toBe(189); // (19000/100)-1 = 189
    expect(maxDpi.mul).toBe(2);
    expect(decodeDpi(189, 2)).toBe(19000);
  });

  it('correctly encodes 4-byte DPI stage with internal modulo-256 checksum', () => {
    const stageBytes = encodeDpiStage(800, 1600);
    expect(stageBytes.length).toBe(4);

    // xRaw + yRaw + mulByte + checksum == 0x55 (mod 256)
    const sum = (stageBytes[0] + stageBytes[1] + stageBytes[2] + stageBytes[3]) & 0xFF;
    expect(sum).toBe(0x55);

    const decoded = decodeDpiStage(stageBytes);
    expect(decoded.xDpi).toBe(800);
    expect(decoded.yDpi).toBe(1600);
  });

  it('builds write EEPROM feature report packets with 10-byte chunk size constraint', () => {
    const proto = new XD5Protocol();
    const data = [1, 2, 3, 4, 5];
    const packet = proto.buildWriteEEPROM(0x000A, data);

    expect(packet.length).toBe(17);
    expect(packet[0]).toBe(REPORT_ID); // 0x08
    expect(packet[1]).toBe(CMD_WRITE_EEPROM); // 0x07
    expect(packet[2]).toBe(0x00); // addr MSB
    expect(packet[3]).toBe(0x0A); // addr LSB
    expect(packet[4]).toBe(5); // chunkLen
    expect(Array.from(packet.slice(5, 10))).toEqual([1, 2, 3, 4, 5]);

    // Checksum satisfies 0x55 mod 256
    let sum = 0;
    for (let i = 0; i < 17; i++) sum = (sum + packet[i]) & 0xFF;
    expect(sum).toBe(0x55);
  });

  it('exposes accurate protocol constants for hardware identification and layout', () => {
    expect(VID).toBe(0x25A7);
    expect(PID_WIRED).toBe(0xFA7B);
    expect(PID_WIRELESS).toBe(0xFA7C);
    expect(REPORT_ID).toBe(0x08);

    expect(CMD_HANDSHAKE).toBe(0x02);
    expect(CMD_GET_BATTERY).toBe(0x04);
    expect(CMD_WRITE_EEPROM).toBe(0x07);
    expect(CMD_READ_EEPROM).toBe(0x08);
    expect(CMD_COMMIT_FLASH).toBe(0x09);
    expect(CMD_DEVICE_EVENT).toBe(0x0A);
    expect(CMD_SET_PROFILE).toBe(0x10);

    expect(EEPROM_ADDR.POLLING_RATE).toBe(0x00);
    expect(EEPROM_ADDR.ACTIVE_PROFILE).toBe(0x01);
    expect(EEPROM_ADDR.STAGE_COUNT).toBe(0x02);
    expect(EEPROM_ADDR.CURRENT_DPI_IDX).toBe(0x04);
    expect(EEPROM_ADDR.LOD).toBe(0x0A);
    expect(EEPROM_ADDR.DPI_STAGES).toBe(0x0C);
    expect(EEPROM_ADDR.DPI_COLORS).toBe(0x2C);
    expect(EEPROM_ADDR.KEY_MATRIX).toBe(0x60);
    expect(EEPROM_ADDR.LIGHTING).toBe(0xA0);
    expect(EEPROM_ADDR.DEBOUNCE).toBe(0xA9);
    expect(EEPROM_ADDR.SLEEP_MINUTES).toBe(0xAD);
    expect(EEPROM_ADDR.ANGLE_SNAPPING).toBe(0xAF);
    expect(EEPROM_ADDR.RIPPLE_CONTROL).toBe(0xB1);
    expect(EEPROM_ADDR.LIGHT_OFF_MOVE).toBe(0xB3);

    expect(POLLING_RATES[1000]).toBe(0x01);
    expect(POLLING_CODES[0x01]).toBe(1000);
    expect(SPEED_TABLE.length).toBe(10);
    expect(BRIGHTNESS_TABLE.length).toBe(10);
    expect(LED_MODES.STREAMING).toBe(0);
    expect(LED_MODES.OFF).toBe(4);
  });

  it('calculates checksum directly with calcChecksum helper and calculateChecksum', () => {
    const proto = new XD5Protocol();
    const buf = new Uint8Array(17);
    buf[0] = 0x08;
    buf[1] = 0x02;
    buf[16] = proto.calcChecksum(buf);

    let sum = 0;
    for (let i = 0; i < 17; i++) sum = (sum + buf[i]) & 0xFF;
    expect(sum).toBe(0x55);
    expect(calculateChecksum(buf)).toBe(proto.calcChecksum(buf));
  });
});
