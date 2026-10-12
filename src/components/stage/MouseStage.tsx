import React, { useContext, useState } from 'react';
import { Gauge } from 'lucide-react';
import { ProfileContext } from '../../context/ProfileContext';
import { DeviceContext } from '../../context/DeviceContext';
import { MouseSvg } from './MouseSvg';
import { HotspotPin } from './HotspotPin';
import type { Profile } from '../../types/profile';

export interface MouseStageProps {
  activeZone?: number | null;
  hoveredButton?: number | null;
  onSelectButton?: (btnId: number) => void;
  onHoverButton?: (btnId: number | null) => void;
  className?: string;
}

const FALLBACK_PROFILE: Profile = {
  id: 1,
  name: 'Default Profile',
  profileColor: '#00e5ff',
  pollingRate: 1000,
  lod: 1,
  debounce: 12,
  sleepMin: 10,
  ripple: false,
  angleSnap: false,
  turnOffOnMove: true,
  activeDpiStage: 1,
  separateXY: false,
  dpiStages: [
    { enabled: true, x: 800, y: 800, color: '#ff334b' },
    { enabled: true, x: 1600, y: 1600, color: '#00e5ff' },
    { enabled: true, x: 3200, y: 3200, color: '#00ff66' },
    { enabled: true, x: 6400, y: 6400, color: '#ffff00' },
  ],
  lighting: {
    mode: 0,
    color: '#00e5ff',
    brightness: 8,
    speed: 5,
  },
  keys: {
    key1: 'Left Click',
    key2: 'Right Click',
    key3: 'Middle Click',
    key4: 'Backward',
    key5: 'Forward',
    key6: 'DPI Loop',
  },
};

const BUTTON_CONFIG = [
  { id: 1, label: 'Left Click', defaultAction: 'Left Click', x: 37.5, y: 18.0 },
  { id: 2, label: 'Right Click', defaultAction: 'Right Click', x: 62.5, y: 18.0 },
  { id: 3, label: 'Scroll Click', defaultAction: 'Middle Click', x: 50.0, y: 9.0 },
  { id: 4, label: 'Back Button', defaultAction: 'Backward', x: 14.4, y: 41.4 },
  { id: 5, label: 'Forward Button', defaultAction: 'Forward', x: 14.4, y: 51.0 },
  { id: 6, label: 'DPI Switch', defaultAction: 'DPI Loop', x: 50.0, y: 36.4 },
];

export const MouseStage: React.FC<MouseStageProps> = ({
  activeZone,
  hoveredButton,
  onSelectButton,
  onHoverButton,
  className = '',
}) => {
  const profileCtx = useContext(ProfileContext);
  const deviceCtx = useContext(DeviceContext);

  const [localHovered, setLocalHovered] = useState<number | null>(null);

  const activeProfile = profileCtx?.activeProfile ?? FALLBACK_PROFILE;
  const currentActive = activeZone ?? hoveredButton ?? localHovered ?? null;
  const accentColor = activeProfile.profileColor || '#00e5ff';

  const handleHover = (id: number | null) => {
    setLocalHovered(id);
    onHoverButton?.(id);
  };

  // Compute ambient glow properties
  const isLightingOff = activeProfile.lighting?.mode === 4;
  const lightingMode = activeProfile.lighting?.mode ?? 0;
  const brightness = typeof activeProfile.lighting?.brightness === 'number'
    ? activeProfile.lighting.brightness
    : 8;
  const briRatio = Math.max(0, Math.min(10, brightness)) / 10;
  const glowOpacity = isLightingOff ? 0 : Math.max(0.1, briRatio * 0.45);
  const glowColor = activeProfile.lighting?.color || accentColor;

  const ambientGlowBackground = isLightingOff
    ? 'transparent'
    : lightingMode === 0 || lightingMode === 3 || lightingMode === 7
    ? 'radial-gradient(circle, rgba(0,229,255,0.7) 0%, rgba(255,0,85,0.5) 45%, rgba(123,44,191,0.3) 70%, transparent 100%)'
    : `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`;

  // Compute active DPI stage readout info
  const activeStageIdx = activeProfile.activeDpiStage || 1;
  const currentDpiStage =
    activeProfile.dpiStages?.[activeStageIdx - 1] ??
    activeProfile.dpiStages?.[0] ??
    FALLBACK_PROFILE.dpiStages[0];

  const dpiText = activeProfile.separateXY
    ? `${currentDpiStage.x} × ${currentDpiStage.y} DPI`
    : `${currentDpiStage.x} DPI`;

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-6 select-none ${className}`}
      data-testid="mouse-stage"
    >
      {/* Ambient background glow */}
      <div
        data-testid="ambient-glow"
        className="pointer-events-none absolute bottom-16 w-80 h-80 rounded-full blur-3xl -z-10 transition-all duration-500"
        style={{
          opacity: glowOpacity,
          background: ambientGlowBackground,
        }}
      />

      {/* Mouse Stage Chassis and Hotspots Wrapper */}
      <div className="relative w-full max-w-[320px] aspect-[320/500] flex items-center justify-center">
        {/* Vector SVG Mouse Chassis */}
        <MouseSvg
          activeButton={currentActive}
          lighting={activeProfile.lighting}
          profileColor={accentColor}
          onSelectButton={onSelectButton}
          onHoverButton={handleHover}
          className="w-full h-full drop-shadow-[0_10px_25px_rgba(0,0,0,0.6)]"
        />

        {/* 6 Interactive Hotspot Pins */}
        {BUTTON_CONFIG.map((btn) => {
          const sublabel = activeProfile.keys?.[`key${btn.id}`] || btn.defaultAction;
          return (
            <HotspotPin
              key={btn.id}
              id={btn.id}
              label={btn.label}
              sublabel={sublabel}
              x={btn.x}
              y={btn.y}
              isActive={currentActive === btn.id}
              accentColor={accentColor}
              onClick={onSelectButton}
              onMouseEnter={handleHover}
              onMouseLeave={() => handleHover(null)}
            />
          );
        })}
      </div>

      {/* Active DPI Stage Readout Badge */}
      <div
        data-testid="dpi-stage-readout"
        className="mt-4 flex items-center gap-3 px-4 py-2 rounded-xl bg-surface/85 border border-subtle/80 shadow-lg backdrop-blur-md transition-all group"
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full ring-2 ring-white/10 transition-colors"
            style={{
              backgroundColor: currentDpiStage.color,
              boxShadow: `0 0 10px ${currentDpiStage.color}`,
            }}
          />
          <span className="font-display font-semibold text-xs uppercase tracking-wider text-slate-400">
            Stage {activeStageIdx}
          </span>
        </div>

        <div className="h-3 w-[1px] bg-subtle/80" />

        <div className="flex items-center gap-1.5 font-mono font-bold text-sm text-white">
          <Gauge className="w-3.5 h-3.5 text-cyan" />
          <span>{dpiText}</span>
          {deviceCtx?.isConnected && (
            <span
              data-testid="device-connected-indicator"
              className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1"
              title="Device connected"
            />
          )}
        </div>
      </div>
    </div>
  );
};
