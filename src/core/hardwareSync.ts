import { XD5Protocol } from './protocol';
import { createDefaultSettings, deserializeSettingsFromEEPROM, serializeSettingsToEEPROM } from './settings';
import type { MouseSettings } from '../types/settings';

/** Owns complete EEPROM transfers, including the flash commit, for one protocol. */
export class HardwareSync {
  private tail: Promise<unknown> = Promise.resolve();
  private generation = 0;

  constructor(private readonly protocol: XD5Protocol) {}

  invalidate(): void {
    this.generation++;
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

  write(settings: MouseSettings): Promise<void> {
    const bytes = serializeSettingsToEEPROM(settings);
    return this.transfer(async (isCurrent) => {
      await this.protocol.writeEEPROM(0, bytes, isCurrent);
      if (!isCurrent()) throw new Error('Mouse connection changed.');
      await this.protocol.commitFlash();
      this.protocol.log('Settings successfully applied to hardware and committed to flash.', 'in');
    });
  }
}
