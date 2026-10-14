import { VID, PID_WIRED } from '../core/protocol';
import type { HIDDevice, HIDInputReportEvent } from '../types/protocol';

/** A device-side EEPROM model; all host commands still cross real XD5Protocol. */
export class SimulatedHid extends EventTarget implements HIDDevice {
  override addEventListener: HIDDevice['addEventListener'] = super.addEventListener.bind(this) as HIDDevice['addEventListener'];
  override removeEventListener: HIDDevice['removeEventListener'] = super.removeEventListener.bind(this) as HIDDevice['removeEventListener'];
  opened = true;
  readonly vendorId = VID;
  readonly productId = PID_WIRED;
  readonly productName = 'Simulated XD5';
  readonly collections = [{ featureReports: [{ reportId: 4 }] }];
  readonly reports: Uint8Array[] = [];
  readonly eeprom: Uint8Array;
  flash: Uint8Array;
  commits = 0;
  failCommit = false;

  constructor(initial: Uint8Array) {
    super();
    this.eeprom = initial.slice();
    this.flash = initial.slice();
  }

  async open() { this.opened = true; }
  async close() { this.opened = false; }
  async sendReport() {}
  async receiveFeatureReport() { return new DataView(new ArrayBuffer(17)); }

  async sendFeatureReport(reportId: number, data: BufferSource | Uint8Array) {
    if (!this.opened) throw new Error('Simulated mouse disconnected.');
    const source = ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);
    const packet = new Uint8Array(17);
    packet[0] = reportId;
    packet.set(source, 1);
    this.reports.push(packet);
    const addr = (packet[3] << 8) | packet[4];
    const length = packet[5];
    if (packet[1] === 0x08) {
      const response = new Uint8Array(5 + length);
      response.set([0x08, 0, packet[3], packet[4], length]);
      response.set(this.eeprom.subarray(addr, addr + length), 5);
      const event = new Event('inputreport') as HIDInputReportEvent;
      Object.assign(event, { reportId: 8, data: new DataView(response.buffer), device: this });
      this.dispatchEvent(event);
    } else if (packet[1] === 0x07) {
      this.eeprom.set(packet.subarray(6, 6 + length), addr);
    } else if (packet[1] === 0x09) {
      if (this.failCommit) throw new Error('Simulated flash failure.');
      this.flash = this.eeprom.slice();
      this.commits++;
    } else if (packet[1] === 0x03) {
      const response = new Uint8Array(16);
      response[0] = 0x03;
      response[1] = 0x00;
      const event = new Event('inputreport') as HIDInputReportEvent;
      Object.assign(event, { reportId: 8, data: new DataView(response.buffer), device: this });
      this.dispatchEvent(event);
    }
  }
}
