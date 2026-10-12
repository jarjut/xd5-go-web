import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Cpu,
  Battery,
  Trash2,
  Zap,
  Copy,
  Check,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import type { TimerHandle } from '../../types/protocol';

export interface DiagnosticsPanelProps {
  className?: string;
}

const SPEC_DETAILS = {
  vid: '0x25A7',
  pidWired: '0xFA7B',
  pidWireless: '0xFA7C',
  reportId: '0x08',
  reportLength: '17 Bytes Feature Reports',
  checksumRule: 'sum mod 256 = 0x55 (bytes 1..15 sum inverted)',
  commandProfile: '0x10 (Hardware Profile Selector)',
};

const DEFAULT_BANNER = `Fantech Helios Go XD5 WebHID Protocol Initialized.
Target VID: 0x25A7 | PID: 0xFA7B (Wired) / 0xFA7C (2.4G Wireless)
Packet Spec: 17 Bytes Feature Reports (Report ID: 0x08, Checksum: sum mod 256 = 0x55)
Profile Management: Persistent in LocalStorage & Synchronized with Hardware Command 0x10.`;

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ className = '' }) => {
  const {
    logs = [],
    isConnected = false,
    transport = 'disconnected',
    battery = null,
    isSyncing = false,
    sendHandshake,
    pollBattery,
    clearLogs,
  } = useDevice();

  const [copied, setCopied] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const consoleBottomRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<TimerHandle | undefined>(undefined);

  const handlePingHandshake = async () => {
    if (!sendHandshake) return;
    setIsPinging(true);
    try {
      await sendHandshake(true);
    } catch {
      // errors handled by protocol logger
    } finally {
      setIsPinging(false);
    }
  };

  const handlePollBattery = async () => {
    if (!pollBattery) return;
    setIsPolling(true);
    try {
      await pollBattery();
    } catch {
      // errors handled by protocol logger
    } finally {
      setIsPolling(false);
    }
  };

  const handleClearLogs = () => {
    clearLogs?.();
  };

  const handleCopyLogs = async () => {
    const textToCopy =
      logs.length > 0
        ? logs
            .map((l) => `[${l.timestamp}] [${(l.type || l.direction || 'SYS').toUpperCase()}] ${l.message || l.text}`)
            .join('\n')
        : DEFAULT_BANNER;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // clipboard write failed
    }
  };

  useEffect(() => {
    return () => {
      clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof consoleBottomRef.current?.scrollIntoView === 'function') {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Protocol Action & Console Card */}
      <div className="rounded-xl border border-subtle bg-card/60 overflow-hidden shadow-sm">
        {/* Card Header with Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-b border-subtle bg-surface/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface border border-subtle flex items-center justify-center text-cyan shadow-sm">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-white tracking-wide">
                Live Protocol Console & Evidence Inspector
              </h3>
              <p className="text-xs text-slate-400">
                Bidirectional 17-byte HID Feature Report transaction stream
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePingHandshake}
              disabled={isPinging || isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-subtle bg-card hover:bg-hover hover:border-slate-500 text-slate-200 hover:text-white transition-all text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
            >
              <Zap className={`w-3.5 h-3.5 text-cyan ${isPinging ? 'animate-pulse' : ''}`} />
              <span>Ping Handshake (0x02)</span>
            </button>

            <button
              type="button"
              onClick={handlePollBattery}
              disabled={isPolling || isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-subtle bg-card hover:bg-hover hover:border-slate-500 text-slate-200 hover:text-white transition-all text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
            >
              <Battery className={`w-3.5 h-3.5 text-cyan ${isPolling ? 'animate-pulse' : ''}`} />
              <span>Poll Battery (0x04)</span>
            </button>

            <button
              type="button"
              onClick={handleClearLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-subtle bg-card hover:bg-hover hover:border-slate-500 text-slate-300 hover:text-white transition-all text-xs font-semibold cursor-pointer select-none"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Clear Log</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLogs}
              aria-label="Copy Log"
              className="p-1.5 rounded-lg border border-subtle bg-card hover:bg-hover hover:border-slate-500 text-slate-400 hover:text-white transition-all cursor-pointer select-none"
              title="Copy Console to Clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Monospace Console Viewport */}
        <div
          data-testid="protocol-console-box"
          tabIndex={0}
          aria-label="Live protocol log output"
          className="bg-base p-4 font-mono text-xs text-slate-300 min-h-[220px] max-h-[380px] overflow-y-auto space-y-1.5 select-text focus:outline-none focus:ring-1 focus:ring-cyan/40"
        >
          {/* Default banner header */}
          <div className="text-slate-400 pb-2 border-b border-subtle/50 text-[11px] leading-relaxed whitespace-pre-wrap">
            {DEFAULT_BANNER}
          </div>

          {/* Render Log Entries */}
          {logs.map((entry) => {
            const rawType = (entry.type || entry.direction || 'sys').toLowerCase();
            let badgeBg = 'bg-slate-800 text-slate-300 border-slate-700';
            let badgeText = 'SYS';

            if (rawType === 'out') {
              badgeBg = 'bg-cyan/15 text-cyan border-cyan/40';
              badgeText = 'OUT';
            } else if (rawType === 'in') {
              badgeBg = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';
              badgeText = 'IN';
            } else if (rawType === 'err') {
              badgeBg = 'bg-rose-500/15 text-rose-400 border-rose-500/40';
              badgeText = 'ERR';
            }

            return (
              <div
                key={entry.id}
                className="flex items-start gap-2.5 py-0.5 hover:bg-surface/50 rounded px-1 -mx-1"
              >
                <span className="text-slate-400 text-[10px] shrink-0 pt-0.5 select-none">
                  {entry.timestamp}
                </span>

                <span
                  className={`px-1.5 py-0.5 rounded border text-[10px] font-bold shrink-0 tracking-wider ${badgeBg}`}
                >
                  {badgeText}
                </span>

                <span
                  className={`break-all leading-relaxed ${
                    rawType === 'err'
                      ? 'text-rose-300 font-semibold'
                      : rawType === 'out'
                      ? 'text-cyan/90'
                      : rawType === 'in'
                      ? 'text-emerald-300'
                      : 'text-slate-300'
                  }`}
                >
                  {entry.message || entry.text}
                </span>
              </div>
            );
          })}

          <div ref={consoleBottomRef} />
        </div>
      </div>

      {/* Hardware Specs & Reverse-Engineering Card */}
      <div className="p-5 rounded-xl border border-subtle bg-card/40 space-y-4">
        <div className="flex items-center gap-2.5">
          <Cpu className="w-5 h-5 text-cyan" />
          <h4 className="font-display font-bold text-sm text-white tracking-wide">
            Hardware & Reverse-Engineering Specifications
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Target VID */}
          <div className="p-3 rounded-lg border border-subtle bg-surface">
            <span className="text-slate-400 block text-[11px]">Vendor ID (VID)</span>
            <span className="font-mono text-white font-bold text-sm">{SPEC_DETAILS.vid}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Fantech OEM Controller</span>
          </div>

          {/* Target PID */}
          <div className="p-3 rounded-lg border border-subtle bg-surface">
            <span className="text-slate-400 block text-[11px]">Product IDs (PID)</span>
            <div className="font-mono text-cyan font-bold text-xs space-y-0.5">
              <div>Wired: {SPEC_DETAILS.pidWired}</div>
              <div>Wireless: {SPEC_DETAILS.pidWireless}</div>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Helios Go XD5 Series</span>
          </div>

          {/* Report ID & Length */}
          <div className="p-3 rounded-lg border border-subtle bg-surface">
            <span className="text-slate-400 block text-[11px]">Report ID & Size</span>
            <span className="font-mono text-white font-bold text-sm">{SPEC_DETAILS.reportId}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">{SPEC_DETAILS.reportLength}</span>
          </div>

          {/* Checksum Rule */}
          <div className="p-3 rounded-lg border border-subtle bg-surface">
            <span className="text-slate-400 block text-[11px]">Checksum Algorithm</span>
            <span className="font-mono text-cyan font-bold text-xs">{SPEC_DETAILS.checksumRule}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Byte 16 checksum byte</span>
          </div>
        </div>

        {/* Live Hardware State */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-subtle text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Connection:</span>
              <span
                className={`font-display font-semibold flex items-center gap-1.5 ${
                  isConnected ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                  }`}
                />
                {isConnected ? 'Active' : 'Disconnected'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Transport:</span>
              <span className="font-mono uppercase text-slate-200">
                {transport}
              </span>
            </div>

            {battery && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Battery:</span>
                <span className="font-mono text-cyan font-bold">
                  {battery.power}% {battery.charging ? '(Charging)' : ''}
                </span>
              </div>
            )}
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            Commands: 0x02 Ping | 0x04 Battery | 0x07 Write EEPROM | 0x08 Read EEPROM | 0x09 Commit | 0x10 Profile
          </div>
        </div>
      </div>
    </div>
  );
};
