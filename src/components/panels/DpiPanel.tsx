import React from 'react';
import { Target, Split, Plus, Minus } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import type { DpiStage } from '../../types/settings';

export interface DpiPanelProps {
  className?: string;
}

const DEFAULT_STAGES: DpiStage[] = [
  { enabled: true, x: 800, y: 800, color: '#ff0000' },
  { enabled: true, x: 1600, y: 1600, color: '#0000ff' },
  { enabled: true, x: 2000, y: 2000, color: '#00ff00' },
  { enabled: true, x: 2400, y: 2400, color: '#ff00ff' },
  { enabled: true, x: 3200, y: 3200, color: '#00ffff' },
  { enabled: true, x: 5000, y: 5000, color: '#ff8000' },
  { enabled: true, x: 19000, y: 19000, color: '#ffffff' },
];

/**
 * Snaps DPI to valid PAW3370 sensor steps:
 * 50 DPI steps for <= 10,000 DPI
 * 100 DPI steps for > 10,000 DPI
 * Clamped to [50, 19000]
 */
export function snapDpi(value: number): number {
  const num = Number(value);
  if (isNaN(num) || num < 50) return 50;
  if (num > 19000) return 19000;
  if (num <= 10000) {
    return Math.round(num / 50) * 50;
  }
  return Math.round(num / 100) * 100;
}

export function stepDpiUp(current: number): number {
  const val = snapDpi(current);
  if (val < 10000) {
    return Math.min(10000, val + 50);
  }
  return Math.min(19000, val + 100);
}

export function stepDpiDown(current: number): number {
  const val = snapDpi(current);
  if (val <= 10000) {
    return Math.max(50, val - 50);
  }
  if (val === 10100) {
    return 10000;
  }
  return Math.max(10000, val - 100);
}

export interface DpiNumericInputProps {
  value: number;
  disabled?: boolean;
  onCommit: (val: number) => void;
  'aria-label'?: string;
  className?: string;
}

export const DpiNumericInput: React.FC<DpiNumericInputProps> = ({
  value,
  disabled,
  onCommit,
  'aria-label': ariaLabel,
  className = '',
}) => {
  const [prevValue, setPrevValue] = React.useState(value);
  const [localValue, setLocalValue] = React.useState<string>(String(value));
  const [isFocused, setIsFocused] = React.useState(false);
  const lastCommittedRef = React.useRef<number>(value);

  if (value !== prevValue) {
    setPrevValue(value);
    lastCommittedRef.current = value;
    if (!isFocused) {
      setLocalValue(String(value));
    }
  }

  const commit = () => {
    const trimmed = localValue.trim();
    if (trimmed === '') {
      setLocalValue(String(value));
      return;
    }
    const parsed = parseInt(trimmed, 10);
    const valid = isNaN(parsed) ? value : snapDpi(parsed);
    setLocalValue(String(valid));
    setPrevValue(valid);
    if (valid !== value || valid !== lastCommittedRef.current) {
      lastCommittedRef.current = valid;
      onCommit(valid);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    setLocalValue(String(value));
  };

  const handleBlur = () => {
    setIsFocused(false);
    commit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setLocalValue(String(value));
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="number"
      min="50"
      max="19000"
      step={value >= 10000 ? 100 : 50}
      value={localValue}
      disabled={disabled}
      onFocus={handleFocus}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      className={className}
    />
  );
};

export const DpiPanel: React.FC<DpiPanelProps> = ({ className = '' }) => {
  const { settings, updateSettings } = useSettings();

  // Ensure 7 stages exist
  const stages: DpiStage[] = React.useMemo(() => {
    if (!settings?.dpiStages || settings.dpiStages.length === 0) {
      return DEFAULT_STAGES;
    }
    const current = [...settings.dpiStages];
    while (current.length < 7) {
      current.push(DEFAULT_STAGES[current.length] || {
        enabled: true,
        x: 800,
        y: 800,
        color: '#ff0000',
      });
    }
    return current.slice(0, 7);
  }, [settings?.dpiStages]);

  const activeStageNum = settings?.activeDpiStage || 1;
  const separateXY = Boolean(settings?.separateXY);
  const enabledCount = stages.filter((s) => s.enabled).length;

  const updateStage = (idx: number, updates: Partial<DpiStage>) => {
    const newStages = stages.map((s, i) => (i === idx ? { ...s, ...updates } : s));
    updateSettings({ dpiStages: newStages });
  };

  const handleToggleEnable = (idx: number, nextEnabled: boolean) => {
    if (!nextEnabled && enabledCount <= 1) return;
    const stageNum = idx + 1;
    const newStages = stages.map((s, i) => (i === idx ? { ...s, enabled: nextEnabled } : s));

    let nextActive = activeStageNum;
    if (!nextEnabled && activeStageNum === stageNum) {
      const firstEnabledIdx = newStages.findIndex((s) => s.enabled);
      if (firstEnabledIdx !== -1) {
        nextActive = firstEnabledIdx + 1;
      }
    }

    updateSettings({
      dpiStages: newStages,
      activeDpiStage: nextActive,
    });
  };

  const handleToggleSeparateXY = () => {
    const nextVal = !separateXY;
    if (!nextVal) {
      // Sync Y axis to X axis
      const newStages = stages.map((s) => ({ ...s, y: s.x }));
      updateSettings({ separateXY: false, dpiStages: newStages });
    } else {
      updateSettings({ separateXY: true });
    }
  };

  const handleDpiChange = (idx: number, val: number) => {
    const snapped = snapDpi(val);
    updateStage(idx, { x: snapped, y: snapped });
  };

  const handleXDpiChange = (idx: number, val: number) => {
    updateStage(idx, { x: snapDpi(val) });
  };

  const handleYDpiChange = (idx: number, val: number) => {
    updateStage(idx, { y: snapDpi(val) });
  };

  return (
    <div
      className={`bg-surface border border-subtle rounded-xl p-5 shadow-lg space-y-6 ${className}`}
      data-testid="dpi-panel"
    >
      {/* Header with Title and Separate X/Y Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-subtle">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-card border border-subtle text-brand">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-white tracking-wide uppercase">
              DPI Studio
            </h2>
            <p className="text-xs text-slate-400">
              PAW3370 Optical Sensor · 50 – 19,000 DPI (50-DPI steps ≤ 10K, 100-DPI steps &gt; 10K)
            </p>
          </div>
        </div>

        {/* Separate X & Y DPI Toggle */}
        <label className="inline-flex items-center gap-2.5 cursor-pointer select-none text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-card border border-subtle transition-colors">
          <input
            id="separate-xy-toggle"
            type="checkbox"
            checked={separateXY}
            onChange={handleToggleSeparateXY}
            aria-label="Separate X & Y DPI"
            className="w-4 h-4 rounded border-subtle bg-base accent-brand cursor-pointer"
          />
          <Split className="w-3.5 h-3.5 text-slate-400" />
          <span>Separate X & Y DPI</span>
        </label>
      </div>

      {/* 7 Stage Rows */}
      <div className="space-y-3">
        {stages.map((stage, idx) => {
          const stageNum = idx + 1;
          const isActive = activeStageNum === stageNum;
          const isOnlyEnabled = stage.enabled && enabledCount <= 1;

          return (
            <div
              key={stageNum}
              data-testid={`dpi-stage-row-${stageNum}`}
              className={`p-3.5 rounded-xl border transition-all ${
                isActive
                  ? 'border-brand/70 bg-card/90 shadow-[0_0_15px_rgba(255,51,75,0.12)]'
                  : 'border-subtle bg-card/40 hover:bg-card/70'
              } ${!stage.enabled ? 'opacity-50' : ''}`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Stage Controls: Active Radio, Enable Checkbox, Stage Number & Color Swatch */}
                <div className="flex items-center gap-3">
                  {/* Active Stage Radio */}
                  <div className="flex items-center" title={`Set Stage ${stageNum} as active`}>
                    <input
                      type="radio"
                      id={`active-stage-${stageNum}`}
                      name="activeDpiStage"
                      value={stageNum}
                      checked={isActive}
                      disabled={!stage.enabled}
                      onChange={() => updateSettings({ activeDpiStage: stageNum })}
                      aria-label={`Active Stage ${stageNum}`}
                      className="w-4 h-4 accent-brand cursor-pointer disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Enable Stage Checkbox */}
                  <div
                    className="flex items-center"
                    title={isOnlyEnabled ? 'At least 1 stage must remain enabled' : `Toggle Stage ${stageNum}`}
                  >
                    <input
                      type="checkbox"
                      id={`enable-stage-${stageNum}`}
                      checked={stage.enabled}
                      disabled={isOnlyEnabled}
                      onChange={(e) => handleToggleEnable(idx, e.target.checked)}
                      aria-label={`Enable Stage ${stageNum}`}
                      className="w-4 h-4 rounded border-subtle accent-brand cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Stage Label & Badge */}
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold text-sm text-slate-200">
                      Stage {stageNum}
                    </span>
                    {isActive && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand/20 text-brand border border-brand/40">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Circular Color Swatch / Picker */}
                  <div className="relative flex items-center ml-1">
                    <label
                      htmlFor={`stage-color-${stageNum}`}
                      className="w-5 h-5 rounded-full border border-white/30 shadow cursor-pointer transition-transform hover:scale-110 flex items-center justify-center"
                      style={{ backgroundColor: stage.color }}
                      title={`Stage ${stageNum} Color: ${stage.color}`}
                    />
                    <input
                      id={`stage-color-${stageNum}`}
                      type="color"
                      aria-label={`Stage ${stageNum} Color`}
                      value={stage.color}
                      onChange={(e) => updateStage(idx, { color: e.target.value })}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                  </div>
                </div>

                {/* DPI Sliders and Numeric Controls */}
                <div className="flex-1 max-w-xl">
                  {!separateXY ? (
                    /* Unified X/Y Controls */
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="50"
                        max="19000"
                        step={stage.x >= 10000 ? 100 : 50}
                        value={stage.x}
                        disabled={!stage.enabled}
                        onChange={(e) => handleDpiChange(idx, Number(e.target.value))}
                        aria-label={`Stage ${stageNum} DPI`}
                        className="flex-1 h-2 bg-base rounded-lg appearance-none cursor-pointer accent-brand disabled:cursor-not-allowed"
                      />

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={!stage.enabled || stage.x <= 50}
                          onClick={() => handleDpiChange(idx, stepDpiDown(stage.x))}
                          aria-label={`Decrease Stage ${stageNum} DPI`}
                          className="p-1 rounded bg-base border border-subtle hover:bg-hover text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <DpiNumericInput
                          value={stage.x}
                          disabled={!stage.enabled}
                          onCommit={(val) => handleDpiChange(idx, val)}
                          aria-label={`Stage ${stageNum} DPI Input`}
                          className="w-20 px-2 py-1 text-center font-mono text-xs rounded bg-base border border-subtle text-white focus:border-brand outline-none disabled:opacity-40"
                        />

                        <button
                          type="button"
                          disabled={!stage.enabled || stage.x >= 19000}
                          onClick={() => handleDpiChange(idx, stepDpiUp(stage.x))}
                          aria-label={`Increase Stage ${stageNum} DPI`}
                          className="p-1 rounded bg-base border border-subtle hover:bg-hover text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Separate X & Y Controls */
                    <div className="space-y-2">
                      {/* X Axis */}
                      <div className="flex items-center gap-3">
                        <span className="w-12 text-[11px] font-mono text-slate-400 uppercase">
                          X Axis
                        </span>
                        <input
                          type="range"
                          min="50"
                          max="19000"
                          step={stage.x >= 10000 ? 100 : 50}
                          value={stage.x}
                          disabled={!stage.enabled}
                          onChange={(e) => handleXDpiChange(idx, Number(e.target.value))}
                          aria-label={`Stage ${stageNum} X DPI`}
                          className="flex-1 h-2 bg-base rounded-lg appearance-none cursor-pointer accent-brand disabled:cursor-not-allowed"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={!stage.enabled || stage.x <= 50}
                            onClick={() => handleXDpiChange(idx, stepDpiDown(stage.x))}
                            aria-label={`Decrease Stage ${stageNum} X DPI`}
                            className="p-1 rounded bg-base border border-subtle hover:bg-hover text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <DpiNumericInput
                            value={stage.x}
                            disabled={!stage.enabled}
                            onCommit={(val) => handleXDpiChange(idx, val)}
                            aria-label={`Stage ${stageNum} X DPI Input`}
                            className="w-20 px-2 py-1 text-center font-mono text-xs rounded bg-base border border-subtle text-white focus:border-brand outline-none disabled:opacity-40"
                          />
                          <button
                            type="button"
                            disabled={!stage.enabled || stage.x >= 19000}
                            onClick={() => handleXDpiChange(idx, stepDpiUp(stage.x))}
                            aria-label={`Increase Stage ${stageNum} X DPI`}
                            className="p-1 rounded bg-base border border-subtle hover:bg-hover text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Y Axis */}
                      <div className="flex items-center gap-3">
                        <span className="w-12 text-[11px] font-mono text-slate-400 uppercase">
                          Y Axis
                        </span>
                        <input
                          type="range"
                          min="50"
                          max="19000"
                          step={stage.y >= 10000 ? 100 : 50}
                          value={stage.y}
                          disabled={!stage.enabled}
                          onChange={(e) => handleYDpiChange(idx, Number(e.target.value))}
                          aria-label={`Stage ${stageNum} Y DPI`}
                          className="flex-1 h-2 bg-base rounded-lg appearance-none cursor-pointer accent-brand disabled:cursor-not-allowed"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={!stage.enabled || stage.y <= 50}
                            onClick={() => handleYDpiChange(idx, stepDpiDown(stage.y))}
                            aria-label={`Decrease Stage ${stageNum} Y DPI`}
                            className="p-1 rounded bg-base border border-subtle hover:bg-hover text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <DpiNumericInput
                            value={stage.y}
                            disabled={!stage.enabled}
                            onCommit={(val) => handleYDpiChange(idx, val)}
                            aria-label={`Stage ${stageNum} Y DPI Input`}
                            className="w-20 px-2 py-1 text-center font-mono text-xs rounded bg-base border border-subtle text-white focus:border-brand outline-none disabled:opacity-40"
                          />
                          <button
                            type="button"
                            disabled={!stage.enabled || stage.y >= 19000}
                            onClick={() => handleYDpiChange(idx, stepDpiUp(stage.y))}
                            aria-label={`Increase Stage ${stageNum} Y DPI`}
                            className="p-1 rounded bg-base border border-subtle hover:bg-hover text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
