/**
 * FANTECH Helios Go XD5 - Protocol Types & Interfaces
 */

export interface HIDDeviceFilter {
  vendorId?: number;
  productId?: number;
  usagePage?: number;
  usage?: number;
}

export interface HIDDeviceRequestOptions {
  filters: HIDDeviceFilter[];
}

export interface HIDInputReportEvent extends Event {
  reportId: number;
  data: DataView;
  device: HIDDevice;
}

export interface HIDDevice extends EventTarget {
  opened: boolean;
  vendorId: number;
  productId: number;
  productName?: string;
  open(): Promise<void>;
  close(): Promise<void>;
  sendFeatureReport(reportId: number, data: BufferSource | Uint8Array): Promise<void>;
  receiveFeatureReport(reportId: number): Promise<DataView>;
  sendReport(reportId: number, data: BufferSource | Uint8Array): Promise<void>;
  addEventListener(
    type: 'inputreport',
    listener: (this: HIDDevice, ev: HIDInputReportEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener(
    type: 'inputreport',
    listener: (this: HIDDevice, ev: HIDInputReportEvent) => void,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void;
}

export interface WebHIDApi {
  requestDevice(options: HIDDeviceRequestOptions): Promise<HIDDevice[]>;
  getDevices(): Promise<HIDDevice[]>;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

export type TimerHandle = number | NodeJS.Timeout;

declare global {
  interface Navigator {
    hid?: WebHIDApi;
  }
}

export type TransportType = 'wired' | 'wireless' | 'disconnected';

export interface BatteryStatus {
  power: number; // 0..100 (%)
  charging: boolean;
}

export interface DeviceEvent {
  type: 'dpi_change' | 'profile_change';
  stage?: number;
  profileIndex?: number;
}

export type LogDirection = 'in' | 'out' | 'err' | 'system';

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  text: string;
  type: LogDirection;
  direction?: LogDirection;
}

export interface EncodedDpi {
  raw: number;
  mul: number;
}

export interface DecodedDpiStage {
  xDpi: number;
  yDpi: number;
}
