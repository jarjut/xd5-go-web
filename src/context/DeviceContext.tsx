import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { XD5Protocol } from '../core/protocol';
import { serializeSettingsToEEPROM } from '../core/settings';
import type {
  HIDDevice,
  TransportType,
  BatteryStatus,
  DeviceEvent,
  LogEntry,
} from '../types/protocol';
import type { MouseSettings } from '../types/settings';

export interface DeviceContextType {
  isConnected: boolean;
  device: HIDDevice | null;
  transport: TransportType;
  battery: BatteryStatus | null;
  logs: LogEntry[];
  connect: () => Promise<void>;
  disconnect: () => void;
  sendHandshake: (active?: boolean) => Promise<void>;
  pollBattery: () => Promise<void>;
  applySettingsToHardware: (settings: MouseSettings) => Promise<void>;
  readSettingsFromHardware: () => Promise<Uint8Array>;
  isConnecting: boolean;
  isSyncing: boolean;
  clearLogs: () => void;
  protocol: XD5Protocol;
  lastEvent: DeviceEvent | null;
  subscribeDeviceEvent: (listener: (event: DeviceEvent) => void) => () => void;
}

export const DeviceContext = createContext<DeviceContextType | null>(null);

export interface DeviceProviderProps {
  children: React.ReactNode;
  protocol?: XD5Protocol;
}

export const DeviceProvider: React.FC<DeviceProviderProps> = ({
  children,
  protocol: customProtocol,
}) => {
  const protocol = useMemo(() => customProtocol || new XD5Protocol(), [customProtocol]);

  const [device, setDevice] = useState<HIDDevice | null>(protocol.device);
  const [isConnected, setIsConnected] = useState<boolean>(protocol.isConnected);
  const [transport, setTransport] = useState<TransportType>(protocol.transport);
  const [battery, setBattery] = useState<BatteryStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<DeviceEvent | null>(null);

  const listenersRef = useRef<Set<(event: DeviceEvent) => void>>(new Set());

  useEffect(() => {
    setIsConnected(protocol.isConnected);
    setDevice(protocol.device);
    setTransport(protocol.transport);

    protocol.onLog = (msg: string, type: 'in' | 'out' | 'err') => {
      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date().toLocaleTimeString(),
        message: msg,
        text: msg,
        type,
        direction: type,
      };
      setLogs((prev) => [...prev, entry].slice(-200));
    };

    protocol.onBatteryUpdate = (status: BatteryStatus) => {
      setBattery(status);
    };

    protocol.onDeviceEvent = (event: DeviceEvent) => {
      setLastEvent(event);
      for (const listener of listenersRef.current) {
        listener(event);
      }
    };

    const handleDisconnect = (e: Event) => {
      const hidEvt = e as { device?: HIDDevice };
      if (hidEvt.device === protocol.device) {
        protocol.close();
        setDevice(null);
        setIsConnected(false);
        setTransport('disconnected');
        setBattery(null);
      }
    };

    if (typeof navigator !== 'undefined' && navigator.hid) {
      navigator.hid.addEventListener('disconnect', handleDisconnect);
    }

    return () => {
      protocol.onLog = null;
      protocol.onBatteryUpdate = null;
      protocol.onDeviceEvent = null;
      if (typeof navigator !== 'undefined' && navigator.hid) {
        navigator.hid.removeEventListener('disconnect', handleDisconnect);
      }
    };
  }, [protocol]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const openedDevice = await protocol.requestAndOpen();
      if (openedDevice) {
        setDevice(openedDevice);
        setIsConnected(protocol.isConnected);
        setTransport(protocol.transport);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      protocol.log(`Connection error: ${msg}`, 'err');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [protocol]);

  const disconnect = useCallback(() => {
    protocol.close();
    setDevice(null);
    setIsConnected(false);
    setTransport('disconnected');
    setBattery(null);
  }, [protocol]);

  const sendHandshake = useCallback(
    async (active: boolean = true) => {
      await protocol.sendHandshake(active);
    },
    [protocol]
  );

  const pollBattery = useCallback(async () => {
    await protocol.queryBattery();
  }, [protocol]);

  const applySettingsToHardware = useCallback(
    async (settings: MouseSettings) => {
      if (!protocol.isConnected) {
        throw new Error('Mouse is not connected.');
      }
      setIsSyncing(true);
      try {
        const bytes = serializeSettingsToEEPROM(settings);
        await protocol.writeEEPROM(0x00, bytes);
        await protocol.commitFlash();
        protocol.log('Settings successfully applied to hardware and committed to flash.', 'in');
      } finally {
        setIsSyncing(false);
      }
    },
    [protocol]
  );

  const readSettingsFromHardware = useCallback(async (): Promise<Uint8Array> => {
    if (!protocol.isConnected) {
      throw new Error('Mouse is not connected.');
    }
    setIsSyncing(true);
    try {
      const bytes = await protocol.readEEPROM(0x00, 181);
      protocol.log(`Read ${bytes.length} bytes from hardware EEPROM.`, 'in');
      return bytes;
    } finally {
      setIsSyncing(false);
    }
  }, [protocol]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const subscribeDeviceEvent = useCallback((listener: (event: DeviceEvent) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value: DeviceContextType = useMemo(
    () => ({
      isConnected,
      device,
      transport,
      battery,
      logs,
      connect,
      disconnect,
      sendHandshake,
      pollBattery,
      applySettingsToHardware,
      readSettingsFromHardware,
      isConnecting,
      isSyncing,
      clearLogs,
      protocol,
      lastEvent,
      subscribeDeviceEvent,
    }),
    [
      isConnected,
      device,
      transport,
      battery,
      logs,
      connect,
      disconnect,
      applySettingsToHardware,
      readSettingsFromHardware,
      isConnecting,
      isSyncing,
      clearLogs,
      protocol,
      lastEvent,
      subscribeDeviceEvent,
    ]
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
};

export function useDevice(): DeviceContextType {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
}
