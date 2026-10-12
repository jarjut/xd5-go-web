import React from 'react';
import {
  SlidersHorizontal,
  Activity,
  LightbulbOff,
  Move,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

export interface SensorPanelProps {
  className?: string;
}

export const POLLING_RATE_OPTIONS = [
  { value: 125, label: '125 Hz', ms: '8.0 ms' },
  { value: 250, label: '250 Hz', ms: '4.0 ms' },
  { value: 500, label: '500 Hz', ms: '2.0 ms' },
  { value: 1000, label: '1000 Hz', ms: '1.0 ms' },
];

export const LOD_OPTIONS = [
  { value: 1, label: '1 mm', description: 'Low lift cutoff' },
  { value: 2, label: '2 mm', description: 'High lift cutoff' },
];

export const SensorPanel: React.FC<SensorPanelProps> = ({ className = '' }) => {
  const { settings, updateSettings } = useSettings();

  const pollingRate = settings?.pollingRate ?? 1000;
  const lod = settings?.lod ?? 1;
  const debounce = settings?.debounce ?? 12;
  const sleepMin = settings?.sleepMin ?? 10;
  const ripple = Boolean(settings?.ripple);
  const angleSnap = Boolean(settings?.angleSnap);
  const turnOffOnMove = Boolean(settings?.turnOffOnMove ?? true);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Banner / Card Title */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-subtle bg-card/60">
        <div className="w-10 h-10 rounded-lg bg-surface border border-subtle flex items-center justify-center text-cyan shadow-sm">
          <SlidersHorizontal className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-display font-bold text-base text-white tracking-wide">
            Sensor
          </h3>
          <p className="text-xs text-slate-400">
            Adjust tracking, click response and power saving.
          </p>
        </div>
      </div>

      {/* Grid of Main Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* USB Polling Rate Card */}
        <div className="p-4 rounded-xl border border-subtle bg-card/40 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-display font-semibold text-sm text-slate-200">
                Polling rate
              </h4>
              <span className="font-mono text-xs text-cyan font-bold">
                Active: {pollingRate} Hz
              </span>
            </div>
            <p className="text-xs text-slate-400">
              USB report frequency in Hertz (response interval: 1ms - 8ms)
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {POLLING_RATE_OPTIONS.map((opt) => {
              const isActive = pollingRate === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  data-active={isActive ? 'true' : 'false'}
                  onClick={() => updateSettings({ pollingRate: opt.value })}
                  aria-label={`${opt.label} Polling Rate`}
                  className={`py-2 px-1 rounded-lg font-display text-xs font-semibold transition-all border cursor-pointer text-center select-none ${
                    isActive
                      ? 'bg-cyan/10 border-cyan text-cyan'
                      : 'bg-surface border-subtle text-slate-300 hover:text-white hover:border-slate-500'
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    {opt.ms}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lift-Off Distance (LOD) Card */}
        <div className="p-4 rounded-xl border border-subtle bg-card/40 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-display font-semibold text-sm text-slate-200">
                Lift-off distance
              </h4>
              <span className="font-mono text-xs text-cyan font-bold">
                {lod === 1 ? 'Low Cutoff' : 'High Cutoff'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Optical sensor tracking cutoff height when lifting mouse
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {LOD_OPTIONS.map((opt) => {
              const isActive = lod === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  data-active={isActive ? 'true' : 'false'}
                  onClick={() => updateSettings({ lod: opt.value })}
                  aria-label={`${opt.label} LOD`}
                  className={`py-2 px-3 rounded-lg font-display text-xs font-semibold transition-all border cursor-pointer text-center select-none ${
                    isActive
                      ? 'bg-cyan/10 border-cyan text-cyan'
                      : 'bg-surface border-subtle text-slate-300 hover:text-white hover:border-slate-500'
                  }`}
                >
                  <div className="text-sm">{opt.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {opt.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Debounce Time Slider Card */}
        <div className="p-4 rounded-xl border border-subtle bg-card/40 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label
                htmlFor="debounce-slider"
                className="font-display font-semibold text-sm text-slate-200 block"
              >
                Debounce time
              </label>
              <p className="text-xs text-slate-400 mt-0.5">
                Filters unwanted extra clicks.
              </p>
            </div>
            <span className="font-mono text-sm text-cyan font-bold px-2 py-0.5 rounded bg-surface border border-subtle shrink-0 ml-3">
              {debounce} ms
            </span>
          </div>

          <div className="space-y-1 pt-1">
            <input
              id="debounce-slider"
              type="range"
              min={4}
              max={20}
              step={1}
              aria-label="Debounce Time"
              value={debounce}
              onChange={(e) => updateSettings({ debounce: Number(e.target.value) })}
              className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-cyan"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Fast (4 ms)</span>
              <span>Default (12 ms)</span>
              <span>Safe (20 ms)</span>
            </div>
          </div>
        </div>

        {/* Auto-Sleep Timer Slider Card */}
        <div className="p-4 rounded-xl border border-subtle bg-card/40 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label
                htmlFor="sleep-slider"
                className="font-display font-semibold text-sm text-slate-200 block"
              >
                Sleep after
              </label>
              <p className="text-xs text-slate-400 mt-0.5">
                Time without movement before the mouse sleeps.
              </p>
            </div>
            <span className="font-mono text-sm text-cyan font-bold px-2 py-0.5 rounded bg-surface border border-subtle shrink-0 ml-3">
              {sleepMin} min
            </span>
          </div>

          <div className="space-y-1 pt-1">
            <input
              id="sleep-slider"
              type="range"
              min={1}
              max={20}
              step={1}
              aria-label="Auto-Sleep Timer"
              value={sleepMin}
              onChange={(e) => updateSettings({ sleepMin: Number(e.target.value) })}
              className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-cyan"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Instant (1 min)</span>
              <span>Default (10 min)</span>
              <span>Extended (20 min)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sensor Advanced Toggles Section */}
      <div className="space-y-3">
        <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-slate-400 px-1">
          Advanced Sensor Features & Battery Optimization
        </h4>

        <div className="space-y-2">
          {/* Ripple Control */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-subtle bg-card/40 hover:bg-card/60 transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface border border-subtle flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                <Activity className="w-4 h-4 text-cyan" />
              </div>
              <div>
                <label
                  htmlFor="sensor-toggle-ripple"
                  className="font-display font-semibold text-sm text-slate-200 cursor-pointer block"
                >
                  Ripple control
                </label>
                <p className="text-xs text-slate-400">
                  Smooths jitter at high DPI (10,000+ DPI)
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer ml-4">
              <input
                id="sensor-toggle-ripple"
                type="checkbox"
                aria-label="Ripple Control"
                checked={ripple}
                onChange={(e) => updateSettings({ ripple: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all border border-subtle peer-checked:bg-cyan peer-checked:border-cyan" />
            </label>
          </div>

          {/* Angle Snapping / FixLine */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-subtle bg-card/40 hover:bg-card/60 transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface border border-subtle flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                <Move className="w-4 h-4 text-cyan" />
              </div>
              <div>
                <label
                  htmlFor="sensor-toggle-anglesnap"
                  className="font-display font-semibold text-sm text-slate-200 cursor-pointer block"
                >
                  Angle snapping
                </label>
                <p className="text-xs text-slate-400">
                  Helps the pointer move in straight lines.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer ml-4">
              <input
                id="sensor-toggle-anglesnap"
                type="checkbox"
                aria-label="Angle Snapping"
                checked={angleSnap}
                onChange={(e) => updateSettings({ angleSnap: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all border border-subtle peer-checked:bg-cyan peer-checked:border-cyan" />
            </label>
          </div>

          {/* Turn OFF Light on Moving */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-subtle bg-card/40 hover:bg-card/60 transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface border border-subtle flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                <LightbulbOff className="w-4 h-4 text-cyan" />
              </div>
              <div>
                <label
                  htmlFor="sensor-toggle-turnoffmove"
                  className="font-display font-semibold text-sm text-slate-200 cursor-pointer block"
                >
                  Lights off while moving
                </label>
                <p className="text-xs text-slate-400">
                  Turn off the lights during movement to save battery.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer ml-4">
              <input
                id="sensor-toggle-turnoffmove"
                type="checkbox"
                aria-label="Turn OFF Light on Moving"
                checked={turnOffOnMove}
                onChange={(e) => updateSettings({ turnOffOnMove: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all border border-subtle peer-checked:bg-cyan peer-checked:border-cyan" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
