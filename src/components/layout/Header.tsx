import React from 'react';
import {
  Zap,
  Battery,
  Power,
  Unplug,
  RefreshCw,
  Check,
  Usb,
  Wifi,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { useSettings } from '../../context/SettingsContext';

export interface HeaderProps {
  className?: string;
  children?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  className = '',
  children,
}) => {
  const {
    isConnected,
    isConnecting,
    transport,
    battery,
    connect,
    disconnect,
    isSyncing,
  } = useDevice();

  const { isDirty, applyToDevice, readFromDevice } = useSettings();

  const handleConnectToggle = async () => {
    if (isConnected) {
      disconnect();
    } else {
      try {
        await connect();
      } catch (err: unknown) {
        console.error('Failed to connect device:', err);
      }
    }
  };

  const handleRead = async () => {
    if (!isConnected || isSyncing) return;
    try {
      await readFromDevice();
    } catch (err: unknown) {
      console.error('Failed to read device settings:', err);
    }
  };

  const handleApply = async () => {
    if (!isConnected || isSyncing) return;
    try {
      await applyToDevice();
    } catch (err: unknown) {
      console.error('Failed to apply settings:', err);
    }
  };

  const batteryLevel = battery && typeof battery.power === 'number' ? battery.power : null;
  const isCharging = battery && typeof battery.charging === 'boolean' ? battery.charging : false;

  return (
    <header className={`w-full bg-surface border-b border-subtle flex flex-col ${className}`}>
      <div className="flex flex-wrap items-center justify-between px-4 lg:px-6 py-3 gap-3">
        {/* Brand Logo & Geometric Badge */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 bg-base rounded-md border border-subtle shadow-inner group">
            {/* Fantech Geometric Badge SVG */}
            <svg
              className="w-5 h-5 text-brand drop-shadow-[0_0_8px_rgba(255,51,75,0.6)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-label="Fantech Badge"
            >
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
              <polyline points="12 2 12 22" />
              <line x1="2" y1="8.5" x2="22" y2="8.5" />
            </svg>
            <div className="absolute inset-0 rounded-md ring-1 ring-brand/30 pointer-events-none" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display text-base md:text-lg font-bold tracking-wider text-slate-100">
                HELIOS GO XD5
              </span>
              <span className="text-[10px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded bg-base text-slate-400 border border-subtle">
                PAW3370
              </span>
            </div>
            <span className="text-[11px] font-sans text-slate-400 hidden sm:inline">
              Ultra-light Wireless Ergonomic Gaming Mouse
            </span>
          </div>
        </div>

        {/* Center / Status HUD: Battery & Transport */}
        <div className="flex items-center gap-3 sm:gap-4 bg-base/70 px-3 py-1.5 rounded-lg border border-subtle">
          {/* Transport status badge */}
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                isConnected
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : isConnecting
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-slate-600'
              }`}
              title={isConnected ? 'Connected' : isConnecting ? 'Connecting' : 'Disconnected'}
            />

            <div className="flex items-center gap-1.5 text-xs font-mono">
              {isConnected ? (
                transport === 'wired' ? (
                  <>
                    <Usb className="w-3.5 h-3.5 text-cyan" />
                    <span className="text-slate-200">USB WIRED</span>
                  </>
                ) : transport === 'wireless' ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-cyan" />
                    <span className="text-slate-200">2.4G WIRELESS</span>
                  </>
                ) : (
                  <span className="text-slate-200">CONNECTED</span>
                )
              ) : isConnecting ? (
                <span className="text-amber-400">CONNECTING...</span>
              ) : (
                <span className="text-slate-500">DISCONNECTED</span>
              )}
            </div>
          </div>

          <div className="h-4 w-px bg-subtle" />

          {/* Battery HUD */}
          <div className="flex items-center gap-2 text-xs font-mono">
            {isCharging ? (
              <span title="Charging" className="flex items-center">
                <Zap
                  data-testid="battery-charging-icon"
                  className="w-4 h-4 text-amber-400 animate-pulse"
                />
              </span>
            ) : batteryLevel !== null && batteryLevel <= 20 ? (
              <Battery className="w-4 h-4 text-brand" />
            ) : (
              <Battery className="w-4 h-4 text-slate-400" />
            )}

            {/* Battery bar meter */}
            <div className="w-12 h-2.5 bg-slate-900 rounded-sm overflow-hidden border border-subtle p-0.5 flex items-center">
              <div
                className={`h-full rounded-sm transition-all duration-300 ${
                  isCharging
                    ? 'bg-amber-400 animate-pulse'
                    : (batteryLevel ?? 0) > 50
                    ? 'bg-emerald-400'
                    : (batteryLevel ?? 0) > 20
                    ? 'bg-amber-400'
                    : 'bg-brand'
                }`}
                style={{ width: `${batteryLevel !== null ? Math.min(100, Math.max(0, batteryLevel)) : 0}%` }}
              />
            </div>

            <span className="text-slate-300 min-w-[32px] text-right">
              {batteryLevel !== null ? `${batteryLevel}%` : '--%'}
            </span>
          </div>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-2">
          {/* Read from Hardware */}
          <button
            type="button"
            onClick={handleRead}
            disabled={!isConnected || isSyncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              !isConnected || isSyncing
                ? 'opacity-40 cursor-not-allowed bg-card border-subtle text-slate-500'
                : 'bg-card hover:bg-hover border-subtle text-slate-200 hover:text-white'
            }`}
            title="Read configuration from mouse hardware"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Read Device</span>
            <span className="sm:hidden">Read</span>
          </button>

          {/* Apply to Hardware */}
          <button
            type="button"
            onClick={handleApply}
            disabled={!isConnected || isSyncing}
            data-dirty={isDirty ? 'true' : 'false'}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all duration-200 ${
              !isConnected || isSyncing
                ? 'opacity-40 cursor-not-allowed bg-card border-subtle text-slate-500'
                : isDirty
                ? 'bg-brand hover:bg-brand/90 text-white border-brand shadow-[0_0_15px_rgba(255,51,75,0.5)] ring-1 ring-brand animate-pulse'
                : 'bg-card hover:bg-hover border-subtle text-slate-300 hover:text-white'
            }`}
            title={isDirty ? 'Unsaved changes ready to apply' : 'All settings synced to hardware'}
          >
            {isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping mr-0.5" />
            )}
            <Check className="w-3.5 h-3.5" />
            <span>Apply Settings</span>
          </button>

          {/* Connect / Disconnect Button */}
          <button
            type="button"
            onClick={handleConnectToggle}
            disabled={isConnecting}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold border transition-all duration-200 ${
              isConnected
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-brand/20 hover:bg-brand/30 text-brand border-brand/50 shadow-[0_0_10px_rgba(255,51,75,0.2)]'
            }`}
          >
            {isConnected ? (
              <>
                <Unplug className="w-3.5 h-3.5 text-slate-400" />
                <span>Disconnect</span>
              </>
            ) : (
              <>
                <Power className="w-3.5 h-3.5 text-brand" />
                <span>Connect Mouse</span>
              </>
            )}
          </button>
        </div>
      </div>

      {children}
    </header>
  );
};
