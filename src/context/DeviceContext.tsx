import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { XD5Protocol } from '../core/protocol';
import { HardwareSync } from '../core/hardwareSync';
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
  hardwareSync?: HardwareSync;
  connectionId?: number;
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
  const hardwareSync = useMemo(() => new HardwareSync(protocol), [protocol]);
  const connectionGeneration = useRef(0);
  const syncCount = useRef(0);
  const [connectionId, setConnectionId] = useState(0);

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
        connectionGeneration.current++;
        setConnectionId(connectionGeneration.current);
        syncCount.current = 0;
        hardwareSync.invalidate();
        setIsConnecting(false);
        setIsSyncing(false);
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
  }, [protocol, hardwareSync]);

  const connect = useCallback(async () => {
    const generation = ++connectionGeneration.current;
    setConnectionId(generation);
    syncCount.current = 0;
    hardwareSync.invalidate();
    protocol.close();
    setDevice(null);
    setIsConnected(false);
    setTransport('disconnected');
    setBattery(null);
    setIsConnecting(true);
    try {
      const openedDevice = await protocol.requestAndOpen();
      if (generation !== connectionGeneration.current) return;
      if (openedDevice) {
        setDevice(openedDevice);
        setIsConnected(protocol.isConnected);
        setTransport(protocol.transport);
      }
    } catch (err: unknown) {
      if (generation !== connectionGeneration.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      protocol.log(`Connection error: ${msg}`, 'err');
      throw err;
    } finally {
      if (generation === connectionGeneration.current) setIsConnecting(false);
    }
  }, [protocol, hardwareSync]);

  const disconnect = useCallback(() => {
    connectionGeneration.current++;
    setConnectionId(connectionGeneration.current);
    syncCount.current = 0;
    hardwareSync.invalidate();
    setIsConnecting(false);
    setIsSyncing(false);
    protocol.close();
    setDevice(null);
    setIsConnected(false);
    setTransport('disconnected');
    setBattery(null);
  }, [protocol, hardwareSync]);

  const sendHandshake = useCallback(
    async (active: boolean = true) => {
      await protocol.sendHandshake(active);
    },
    [protocol]
  );

  const pollBattery = useCallback(async () => {
    await protocol.queryBattery();
  }, [protocol]);

  const applySettingsToHardware = useCallback(async (settings: MouseSettings) => {
    const generation = connectionGeneration.current;
    syncCount.current++;
    setIsSyncing(true);
    try {
      await hardwareSync.write(settings);
    } finally {
      if (generation === connectionGeneration.current) {
        syncCount.current--;
        setIsSyncing(syncCount.current > 0);
      }
    }
  }, [hardwareSync]);

  const readSettingsFromHardware = useCallback(async (): Promise<Uint8Array> => {
    const generation = connectionGeneration.current;
    syncCount.current++;
    setIsSyncing(true);
    try {
      return await hardwareSync.readBytes();
    } finally {
      if (generation === connectionGeneration.current) {
        syncCount.current--;
        setIsSyncing(syncCount.current > 0);
      }
    }
  }, [hardwareSync]);

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
      hardwareSync,
      connectionId,
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
      hardwareSync,
      connectionId,
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
