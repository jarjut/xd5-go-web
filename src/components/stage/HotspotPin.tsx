import React from 'react';

export interface HotspotPinProps {
  id: number;
  label: string;
  sublabel?: string;
  x: number; // percentage X (0 - 100)
  y: number; // percentage Y (0 - 100)
  isActive: boolean;
  accentColor?: string;
  onClick?: (id: number) => void;
  onMouseEnter?: (id: number) => void;
  onMouseLeave?: () => void;
}

export const HotspotPin: React.FC<HotspotPinProps> = ({
  id,
  label,
  sublabel,
  x,
  y,
  isActive,
  accentColor = '#00e5ff',
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <div
      style={{ left: `${x}%`, top: `${y}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group"
    >
      <button
        type="button"
        data-testid={`hotspot-pin-${id}`}
        data-active={isActive ? 'true' : 'false'}
        aria-label={`${id}. ${label}${sublabel ? `: ${sublabel}` : ''}`}
        onClick={() => onClick?.(id)}
        onMouseEnter={() => onMouseEnter?.(id)}
        onMouseLeave={() => onMouseLeave?.()}
        onFocus={() => onMouseEnter?.(id)}
        onBlur={() => onMouseLeave?.()}
        className={`w-7 h-7 rounded-full flex items-center justify-center font-display font-semibold text-xs transition-all duration-200 cursor-pointer shadow-lg select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-base ${
          isActive
            ? 'scale-110 text-white bg-card ring-2'
            : 'text-slate-300 bg-surface/90 border border-slate-700/80 hover:text-white hover:border-slate-500 hover:scale-105'
        }`}
        style={
          isActive
            ? {
                borderColor: accentColor,
                boxShadow: `0 0 14px ${accentColor}80, inset 0 0 6px ${accentColor}33`,
                outlineColor: accentColor,
              }
            : undefined
        }
      >
        <span>{id}</span>
      </button>

      {/* Tooltip on hover / focus */}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-surface/95 border border-subtle/80 backdrop-blur-md shadow-xl text-left whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 z-30"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <span>{id}. {label}</span>
        </div>
        {sublabel && (
          <div className="text-[10px] text-slate-400 font-mono mt-0.5 pl-3">
            {sublabel}
          </div>
        )}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-surface/95" />
      </div>
    </div>
  );
};
