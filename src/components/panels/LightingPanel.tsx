import React, { useState, useEffect } from 'react';
import {
  Waves,
  Activity,
  Sun,
  Sparkles,
  RotateCw,
  Flame,
  PowerOff,
  Palette,
  Check,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import type { LightingSettings } from '../../types/settings';

export interface LightingPanelProps {
  className?: string;
}

export interface LedModeItem {
  id: number;
  name: string;
  description: string;
  supportsColor: boolean;
  Icon: React.ComponentType<{ className?: string }>;
}

export const LED_MODES_CONFIG: readonly LedModeItem[] = [
  {
    id: 0,
    name: 'Streaming',
    description: 'Dynamic rainbow spectrum wave across diffuser strip',
    supportsColor: false,
    Icon: Waves,
  },
  {
    id: 1,
    name: 'Breathing',
    description: 'Smooth pulsing glow with customizable static color',
    supportsColor: true,
    Icon: Activity,
  },
  {
    id: 2,
    name: 'Steady',
    description: 'Solid continuous lighting with user-defined color',
    supportsColor: true,
    Icon: Sun,
  },
  {
    id: 3,
    name: 'Neon',
    description: 'Rapid spectrum cycle transitioning between vivid hues',
    supportsColor: false,
    Icon: Sparkles,
  },
  {
    id: 5,
    name: 'Scrolling',
    description: 'Flowing linear gradient effect across diffuser zones',
    supportsColor: false,
    Icon: RotateCw,
  },
  {
    id: 7,
    name: 'Colorful Breathing',
    description: 'Pulsing multi-color breath effect through spectrum',
    supportsColor: false,
    Icon: Flame,
  },
  {
    id: 4,
    name: 'OFF',
    description: 'Disable diffuser LEDs entirely to preserve battery life',
    supportsColor: false,
    Icon: PowerOff,
  },
] as const;

export const LightingPanel: React.FC<LightingPanelProps> = ({ className = '' }) => {
  const { settings, updateSettings } = useSettings();

  const lighting: LightingSettings = settings?.lighting || {
    mode: 0,
    color: '#00e5ff',
    brightness: 8,
    speed: 5,
  };

  const activeMode =
    LED_MODES_CONFIG.find((m) => m.id === lighting.mode) || LED_MODES_CONFIG[0];

  const [hexInput, setHexInput] = useState(lighting.color || '#00e5ff');

  useEffect(() => {
    setHexInput(lighting.color || '#00e5ff');
  }, [lighting.color]);

  const onSelectMode = (modeId: number) => {
    updateSettings({
      lighting: {
        ...lighting,
        mode: modeId,
      },
    });
  };

  const onColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextColor = e.target.value.toLowerCase();
    setHexInput(nextColor);
    updateSettings({
      lighting: {
        ...lighting,
        color: nextColor,
      },
    });
  };

  const onHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#') && /^[0-9a-fA-F]{1,6}$/.test(val)) {
      val = '#' + val;
    }
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/i.test(val)) {
      updateSettings({
        lighting: {
          ...lighting,
          color: val.toLowerCase(),
        },
      });
    }
  };

  const onSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const speed = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 5));
    updateSettings({
      lighting: {
        ...lighting,
        speed,
      },
    });
  };

  const onBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const brightness = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 5));
    updateSettings({
      lighting: {
        ...lighting,
        brightness,
      },
    });
  };

  const isOff = lighting.mode === 4;

  return (
    <div
      className={`bg-surface border border-subtle rounded-xl p-5 shadow-lg space-y-6 ${className}`}
      data-testid="lighting-panel"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-subtle">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-card border border-subtle text-brand">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-white tracking-wide uppercase">
              Lighting FX
            </h2>
            <p className="text-xs text-slate-400">
              Chassis rear diffuser RGB illumination · 7 hardware EEPROM effects
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-lg bg-card border border-subtle text-xs">
          <span className="text-slate-400">Active:</span>
          <span className="font-semibold text-brand">{activeMode.name}</span>
        </div>
      </div>

      {/* 7 LED Mode Cards */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          LED Mode / Effect
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {LED_MODES_CONFIG.map((m) => {
            const isSelected = lighting.mode === m.id;
            const { Icon } = m;

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMode(m.id)}
                aria-label={m.name}
                aria-pressed={isSelected}
                className={`relative flex flex-col p-4 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-brand bg-brand/10 shadow-[0_0_15px_rgba(255,51,75,0.18)] text-white'
                    : 'border-subtle bg-card/60 hover:bg-card hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className={`p-2 rounded-lg ${
                      isSelected ? 'bg-brand text-white' : 'bg-base text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  {isSelected && (
                    <span className="p-1 rounded-full bg-brand/20 text-brand">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                <div className="font-display font-semibold text-sm text-white mb-1">
                  {m.name}
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {m.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Color Picker Section (Shown for modes supporting custom color) */}
      {activeMode.supportsColor && (
        <div className="p-4 rounded-xl border border-subtle bg-card/70 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold text-sm text-white">
                Custom LED Color
              </h3>
              <p className="text-xs text-slate-400">
                Single-color illumination for {activeMode.name} mode
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            {/* Color Swatch & Native Color Picker */}
            <div className="relative flex items-center">
              <label
                htmlFor="led-color-picker"
                className="w-10 h-10 rounded-xl border-2 border-white/20 shadow-inner cursor-pointer transition-transform hover:scale-105 flex items-center justify-center"
                style={{ backgroundColor: lighting.color || '#00e5ff' }}
                title={`LED Color: ${lighting.color || '#00e5ff'}`}
              >
                <span className="sr-only">LED Color Picker</span>
              </label>
              <input
                id="led-color-picker"
                type="color"
                aria-label="LED Color Picker"
                value={lighting.color || '#00e5ff'}
                onChange={onColorPickerChange}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              />
            </div>

            {/* Hex Code Text Input */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">HEX</span>
              <input
                type="text"
                maxLength={7}
                aria-label="LED Color Hex"
                value={hexInput}
                onChange={onHexInputChange}
                className="w-28 px-3 py-1.5 font-mono text-xs rounded-lg bg-base border border-subtle text-white focus:border-brand outline-none"
                placeholder="#00e5ff"
              />
            </div>
          </div>
        </div>
      )}

      {/* Speed & Brightness Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Speed Slider */}
        <div
          className={`p-4 rounded-xl border border-subtle bg-card/50 space-y-3 ${
            isOff ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <label
              htmlFor="lighting-speed"
              className="text-xs font-semibold uppercase tracking-wider text-slate-300"
            >
              Effect Speed
            </label>
            <span className="font-mono text-xs text-brand font-bold">
              {lighting.speed} / 10
            </span>
          </div>
          <input
            id="lighting-speed"
            type="range"
            min="1"
            max="10"
            step="1"
            disabled={isOff}
            value={lighting.speed}
            onChange={onSpeedChange}
            aria-label="LED Speed"
            className="w-full h-2 bg-base rounded-lg appearance-none cursor-pointer accent-brand disabled:cursor-not-allowed"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>Slow (1)</span>
            <span>Fast (10)</span>
          </div>
        </div>

        {/* Brightness Slider */}
        <div
          className={`p-4 rounded-xl border border-subtle bg-card/50 space-y-3 ${
            isOff ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <label
              htmlFor="lighting-brightness"
              className="text-xs font-semibold uppercase tracking-wider text-slate-300"
            >
              Brightness
            </label>
            <span className="font-mono text-xs text-brand font-bold">
              {lighting.brightness} / 10
            </span>
          </div>
          <input
            id="lighting-brightness"
            type="range"
            min="1"
            max="10"
            step="1"
            disabled={isOff}
            value={lighting.brightness}
            onChange={onBrightnessChange}
            aria-label="LED Brightness"
            className="w-full h-2 bg-base rounded-lg appearance-none cursor-pointer accent-brand disabled:cursor-not-allowed"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>Dim (1)</span>
            <span>Max (10)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
