import React from 'react';
import type { LightingSettings } from '../../types/profile';

export interface MouseSvgProps {
  activeButton: number | null;
  lighting?: LightingSettings;
  profileColor?: string;
  onSelectButton?: (id: number) => void;
  onHoverButton?: (id: number | null) => void;
  className?: string;
}

export const MouseSvg: React.FC<MouseSvgProps> = ({
  activeButton,
  lighting,
  profileColor = '#00e5ff',
  onSelectButton,
  onHoverButton,
  className = 'w-full h-auto',
}) => {
  const accentColor = profileColor || '#00e5ff';
  const isOff = lighting?.mode === 4;
  const color = lighting?.color || accentColor;
  const brightness = typeof lighting?.brightness === 'number' ? lighting.brightness : 8;
  const speed = typeof lighting?.speed === 'number' ? lighting.speed : 5;

  const briRatio = Math.max(0, Math.min(10, brightness)) / 10;
  const targetOpacity = isOff ? 0.08 : Math.max(0.2, briRatio * 0.95);
  const duration = Math.max(0.6, (11 - Math.max(1, Math.min(10, speed))) * 0.45);

  // Compute LED strip inline styles & animation based on active lighting mode
  const getLedStripStyle = (): React.CSSProperties => {
    if (isOff) {
      return {
        fill: '#1a1c23',
        opacity: 0.08,
        filter: 'none',
        transition: 'fill 0.3s, opacity 0.3s',
      };
    }

    switch (lighting?.mode) {
      case 0: // Streaming (RGB Spectrum Wave)
        return {
          fill: 'url(#spectrumWaveGrad)',
          opacity: targetOpacity,
          animation: `led-hue-cycle ${duration}s linear infinite`,
          filter: 'url(#diffuserGlow)',
        };
      case 1: // Breathing (Single Color Pulse)
        return {
          fill: color,
          animation: `led-breathing ${duration}s ease-in-out infinite`,
          filter: 'url(#diffuserGlow)',
        };
      case 2: // Steady (Static Color)
        return {
          fill: color,
          opacity: targetOpacity,
          filter: 'url(#diffuserGlow)',
          transition: 'fill 0.3s, opacity 0.3s',
        };
      case 3: // Neon (Color Cycle)
        return {
          fill: color,
          opacity: targetOpacity,
          animation: `led-hue-cycle ${duration}s linear infinite`,
          filter: 'url(#diffuserGlow)',
        };
      case 5: // Scrolling
        return {
          fill: 'url(#spectrumWaveGrad)',
          opacity: targetOpacity,
          animation: `led-scrolling ${duration}s ease-in-out infinite`,
          filter: 'url(#diffuserGlow)',
        };
      case 7: // Colorful Breathing
        return {
          fill: 'url(#spectrumWaveGrad)',
          animation: `led-colorful-breathing ${duration}s ease-in-out infinite`,
          filter: 'url(#diffuserGlow)',
        };
      default:
        return {
          fill: color,
          opacity: targetOpacity,
          filter: 'url(#diffuserGlow)',
        };
    }
  };

  const isBtn1Active = activeButton === 1;
  const isBtn2Active = activeButton === 2;
  const isBtn3Active = activeButton === 3;
  const isBtn4Active = activeButton === 4;
  const isBtn5Active = activeButton === 5;
  const isBtn6Active = activeButton === 6;

  return (
    <svg
      className={className}
      viewBox="0 0 320 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Fantech Helios Go XD5 Mouse Chassis"
    >
      <defs>
        <linearGradient id="bodyGrad" x1="160" y1="20" x2="160" y2="480" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2c303c" />
          <stop offset="60%" stopColor="#1b1c23" />
          <stop offset="100%" stopColor="#121318" />
        </linearGradient>

        <linearGradient id="clickerGrad" x1="160" y1="20" x2="160" y2="230" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#343947" />
          <stop offset="100%" stopColor="#1e2029" />
        </linearGradient>

        <linearGradient id="clickerGradActive" x1="160" y1="20" x2="160" y2="230" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#464d60" />
          <stop offset="100%" stopColor="#282b37" />
        </linearGradient>

        <linearGradient id="spectrumWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff0055" />
          <stop offset="20%" stopColor="#ff9900" />
          <stop offset="40%" stopColor="#ffe600" />
          <stop offset="60%" stopColor="#00e5ff" />
          <stop offset="80%" stopColor="#7b2cbf" />
          <stop offset="100%" stopColor="#ff0055" />
        </linearGradient>

        <filter id="diffuserGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <style>{`
        @keyframes led-breathing {
          0%, 100% { opacity: 0.15; }
          50% { opacity: ${targetOpacity}; }
        }
        @keyframes led-hue-cycle {
          0% { filter: url(#diffuserGlow) hue-rotate(0deg); }
          100% { filter: url(#diffuserGlow) hue-rotate(360deg); }
        }
        @keyframes led-scrolling {
          0% { opacity: 0.3; transform-origin: 160px 440px; transform: scaleX(0.85); }
          50% { opacity: ${targetOpacity}; transform-origin: 160px 440px; transform: scaleX(1); }
          100% { opacity: 0.3; transform-origin: 160px 440px; transform: scaleX(0.85); }
        }
        @keyframes led-colorful-breathing {
          0%, 100% { opacity: 0.15; filter: url(#diffuserGlow) hue-rotate(0deg); }
          50% { opacity: ${targetOpacity}; filter: url(#diffuserGlow) hue-rotate(180deg); }
        }
      `}</style>

      {/* Main Outer Mouse Body Ergonomic Shape */}
      <path
        d="M160 25 C115 25 80 80 75 160 C70 240 65 340 90 410 C110 460 145 475 160 475 C175 475 210 460 230 410 C255 340 250 240 245 160 C240 80 205 25 160 25 Z"
        fill="url(#bodyGrad)"
        stroke="#3e4352"
        strokeWidth="2.5"
      />

      {/* Button 1: Left Click */}
      <path
        id="btnSvg1"
        data-testid="mouse-btn-1"
        d="M157 26 C125 27 92 68 83 150 C100 155 140 156 157 156 Z"
        fill={isBtn1Active ? 'url(#clickerGradActive)' : 'url(#clickerGrad)'}
        stroke={isBtn1Active ? accentColor : '#3a3e4e'}
        strokeWidth={isBtn1Active ? 2.5 : 1.5}
        onClick={() => onSelectButton?.(1)}
        onMouseEnter={() => onHoverButton?.(1)}
        onMouseLeave={() => onHoverButton?.(null)}
        style={{
          cursor: 'pointer',
          transition: 'fill 0.2s, stroke 0.2s',
          filter: isBtn1Active ? `drop-shadow(0 0 6px ${accentColor}80)` : undefined,
        }}
      />

      {/* Button 2: Right Click */}
      <path
        id="btnSvg2"
        data-testid="mouse-btn-2"
        d="M163 26 C195 27 228 68 237 150 C220 155 180 156 163 156 Z"
        fill={isBtn2Active ? 'url(#clickerGradActive)' : 'url(#clickerGrad)'}
        stroke={isBtn2Active ? accentColor : '#3a3e4e'}
        strokeWidth={isBtn2Active ? 2.5 : 1.5}
        onClick={() => onSelectButton?.(2)}
        onMouseEnter={() => onHoverButton?.(2)}
        onMouseLeave={() => onHoverButton?.(null)}
        style={{
          cursor: 'pointer',
          transition: 'fill 0.2s, stroke 0.2s',
          filter: isBtn2Active ? `drop-shadow(0 0 6px ${accentColor}80)` : undefined,
        }}
      />

      {/* Center Scroll Wheel Well */}
      <rect
        x="150"
        y="60"
        width="20"
        height="60"
        rx="10"
        fill="#0d0e12"
        stroke="#252833"
        strokeWidth="1.5"
      />

      {/* Button 3: Scroll Wheel */}
      <rect
        id="btnSvg3"
        data-testid="mouse-btn-3"
        x="153"
        y="70"
        width="14"
        height="40"
        rx="7"
        fill={isBtn3Active ? accentColor : '#1b1d24'}
        stroke={isBtn3Active ? '#ffffff' : accentColor}
        strokeWidth={isBtn3Active ? 2.5 : 2}
        onClick={() => onSelectButton?.(3)}
        onMouseEnter={() => onHoverButton?.(3)}
        onMouseLeave={() => onHoverButton?.(null)}
        style={{
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          filter: isBtn3Active ? `drop-shadow(0 0 8px ${accentColor})` : undefined,
        }}
      />

      {/* Scroll Wheel Ribs */}
      <line x1="155" y1="80" x2="165" y2="80" stroke={isBtn3Active ? '#ffffff' : '#444'} strokeWidth="1.5" />
      <line x1="155" y1="90" x2="165" y2="90" stroke={isBtn3Active ? '#ffffff' : '#444'} strokeWidth="1.5" />
      <line x1="155" y1="100" x2="165" y2="100" stroke={isBtn3Active ? '#ffffff' : '#444'} strokeWidth="1.5" />

      {/* Button 6: DPI Switch */}
      <rect
        id="btnSvg6"
        data-testid="mouse-btn-6"
        x="154"
        y="170"
        width="12"
        height="24"
        rx="4"
        fill={isBtn6Active ? accentColor : '#252833'}
        stroke={isBtn6Active ? '#ffffff' : '#4a5063'}
        strokeWidth={isBtn6Active ? 2 : 1}
        onClick={() => onSelectButton?.(6)}
        onMouseEnter={() => onHoverButton?.(6)}
        onMouseLeave={() => onHoverButton?.(null)}
        style={{
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          filter: isBtn6Active ? `drop-shadow(0 0 8px ${accentColor})` : undefined,
        }}
      />

      {/* Button 4: Left Side (Back) */}
      <path
        id="btnSvg4"
        data-testid="mouse-btn-4"
        d="M72 230 C71 215 71 200 73 185 C67 190 64 210 65 230 Z"
        fill={isBtn4Active ? accentColor : '#333745'}
        stroke={isBtn4Active ? '#ffffff' : '#4a5063'}
        strokeWidth={isBtn4Active ? 2 : 1}
        onClick={() => onSelectButton?.(4)}
        onMouseEnter={() => onHoverButton?.(4)}
        onMouseLeave={() => onHoverButton?.(null)}
        style={{
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          filter: isBtn4Active ? `drop-shadow(0 0 8px ${accentColor})` : undefined,
        }}
      />

      {/* Button 5: Left Side (Forward) */}
      <path
        id="btnSvg5"
        data-testid="mouse-btn-5"
        d="M72 275 C70 260 70 245 72 235 C65 238 63 255 64 275 Z"
        fill={isBtn5Active ? accentColor : '#333745'}
        stroke={isBtn5Active ? '#ffffff' : '#4a5063'}
        strokeWidth={isBtn5Active ? 2 : 1}
        onClick={() => onSelectButton?.(5)}
        onMouseEnter={() => onHoverButton?.(5)}
        onMouseLeave={() => onHoverButton?.(null)}
        style={{
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          filter: isBtn5Active ? `drop-shadow(0 0 8px ${accentColor})` : undefined,
        }}
      />

      {/* Tail Ergonomic LED Diffuser Strip */}
      <path
        id="mouseLedStrip"
        data-testid="mouse-led-strip"
        d="M102 430 C125 460 195 460 218 430 C200 452 120 452 102 430 Z"
        style={getLedStripStyle()}
      />

      {/* Subtle Fantech Helios Palm Logo */}
      <path
        d="M160 330 L166 342 L178 343 L169 351 L172 363 L160 356 L148 363 L151 351 L142 343 L154 342 Z"
        fill="#3a3e4e"
        opacity="0.6"
      />
    </svg>
  );
};
