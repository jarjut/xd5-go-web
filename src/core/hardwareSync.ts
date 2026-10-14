import { XD5Protocol } from './protocol';
import { createDefaultSettings, deserializeSettingsFromEEPROM, serializeSettingsToEEPROM } from './settings';
import type { MouseSettings } from '../types/settings';

/** Owns complete EEPROM transfers, including the flash commit, for one protocol. */
interface RegisterBlock {
  start: number;
  length: number;
}

const REGISTER_BLOCKS: readonly RegisterBlock[] = [
  { start: 0x00, length: 2 }, // Polling Rate
  { start: 0x02, length: 2 }, // DPI Stage Count
  { start: 0x04, length: 2 }, // Current DPI Index
  { start: 0x0a, length: 2 }, // LOD
  // DPI stages 0..7 (4 bytes each: X, Y, Mul, Checksum)
  ...Array.from({ length: 8 }, (_, i) => ({ start: 0x0c + i * 4, length: 4 })),
  // DPI colors 0..7 (4 bytes each: R, G, B, Checksum)
  ...Array.from({ length: 8 }, (_, i) => ({ start: 0x2c + i * 4, length: 4 })),
  // Key matrix 1..6 (4 bytes each: Action LE dword)
  ...Array.from({ length: 6 }, (_, i) => ({ start: 0x60 + i * 4, length: 4 })),
  { start: 0xa0, length: 7 }, // Lighting (Mode, R, G, B, Speed, Brightness, Checksum)
  { start: 0xa9, length: 2 }, // Debounce
  { start: 0xad, length: 2 }, // Sleep Minutes
  { start: 0xaf, length: 2 }, // Angle Snapping (FixLine)
  { start: 0xb1, length: 2 }, // Ripple Control
  { start: 0xb3, length: 2 }, // Light Off on Move
];

export class HardwareSync {
  private tail: Promise<unknown> = Promise.resolve();
  private generation = 0;
  private baselineBytes: Uint8Array | null = null;

  constructor(private readonly protocol: XD5Protocol) {}

  invalidate(): void {
    this.generation++;
    this.baselineBytes = null;
  }

  private transfer<T>(operation: (isCurrent: () => boolean) => Promise<T>): Promise<T> {
    const generation = this.generation;
    const isCurrent = () => generation === this.generation && this.protocol.isConnected;
    const result = this.tail.then(async () => {
      if (!isCurrent()) throw new Error('Mouse connection changed.');
      const value = await operation(isCurrent);
      if (!isCurrent()) throw new Error('Mouse connection changed.');
      return value;
    });
    this.tail = result.catch(() => {});
    return result;
  }

  private async readValidated(isCurrent: () => boolean): Promise<Uint8Array> {
    const bytes = await this.protocol.readEEPROM(0, 181, isCurrent);
    if (bytes.length !== 181) throw new Error(`Incomplete EEPROM read (${bytes.length}/181 bytes).`);
    if (!bytes.some((byte) => byte !== 0)) {
      throw new Error('Mouse EEPROM returned empty (all-zero) data. Hardware communication failed.');
    }
    this.baselineBytes = new Uint8Array(bytes);
    return bytes;
  }

  read(): Promise<MouseSettings> {
    return this.transfer(async (isCurrent) => {
      const bytes = await this.readValidated(isCurrent);
      this.protocol.log(`Read ${bytes.length} bytes from hardware EEPROM.`, 'in');
      return deserializeSettingsFromEEPROM(bytes, createDefaultSettings());
    });
  }

  readBytes(): Promise<Uint8Array> {
    return this.transfer((isCurrent) => this.readValidated(isCurrent));
  }

  write(settings: MouseSettings, commitFlash: boolean = false): Promise<void> {
    const bytes = serializeSettingsToEEPROM(settings, this.baselineBytes || undefined);
    return this.transfer(async (isCurrent) => {
      if (this.baselineBytes && this.baselineBytes.length === 181) {
        const writtenIndices = new Set<number>();
        for (const block of REGISTER_BLOCKS) {
          let hasDiff = false;
          for (let i = block.start; i < block.start + block.length; i++) {
            if (bytes[i] !== this.baselineBytes[i]) {
              hasDiff = true;
              break;
            }
          }
          if (hasDiff) {
            await this.protocol.writeEEPROM(block.start, bytes.subarray(block.start, block.start + block.length), isCurrent);
            for (let i = block.start; i < block.start + block.length; i++) {
              writtenIndices.add(i);
            }
          }
        }

        let sliceStart = -1;
        for (let i = 0; i < 181; i++) {
          if (!writtenIndices.has(i) && bytes[i] !== this.baselineBytes[i]) {
            if (sliceStart === -1) sliceStart = i;
          } else if (sliceStart !== -1) {
            await this.protocol.writeEEPROM(sliceStart, bytes.subarray(sliceStart, i), isCurrent);
            sliceStart = -1;
          }
        }
        if (sliceStart !== -1) {
          await this.protocol.writeEEPROM(sliceStart, bytes.subarray(sliceStart, 181), isCurrent);
        }
      } else {
        await this.protocol.writeEEPROM(0, bytes, isCurrent);
      }
      this.baselineBytes = new Uint8Array(bytes);
      if (!isCurrent()) throw new Error('Mouse connection changed.');
      if (commitFlash) {
        await this.protocol.commitFlash();
        this.protocol.log('Settings successfully applied to hardware and committed to flash.', 'in');
      } else {
        this.protocol.log('Settings successfully applied to hardware SRAM.', 'in');
      }
    });
  }

  commitFlash(): Promise<void> {
    return this.transfer(async (isCurrent) => {
      if (!isCurrent()) throw new Error('Mouse connection changed.');
      await this.protocol.commitFlash();
      this.protocol.log('Settings committed to flash.', 'in');
    });
  }
}
