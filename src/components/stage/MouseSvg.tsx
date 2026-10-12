import React, { useId } from 'react';
import type { LightingSettings } from '../../types/settings';
export interface MouseSvgProps { activeButton: number | null; lighting?: LightingSettings; onSelectButton?: (id:number)=>void; onHoverButton?: (id:number|null)=>void; className?:string; }

export const MouseSvg: React.FC<MouseSvgProps> = ({ activeButton, lighting, onSelectButton, onHoverButton, className = '' }) => {
  const uid = useId().replace(/:/g,'');
  const off = lighting?.mode === 4;
  const mode = lighting?.mode ?? 0;
  const color = lighting?.color ?? '#e64b5e';
  const opacity = off ? 0 : (lighting?.brightness ?? 8) / 10;
  const duration = `${(11 - (lighting?.speed ?? 5)) * .45}s`;
  const multicolor = [0,3,5,7].includes(mode);
  const zones = [
    { id:1, d:'M157 34 C119 31 75 32 58 55 C45 86 49 143 61 202 C90 188 117 184 146 185 L157 145 Z' },
    { id:2, d:'M169 34 C205 34 251 47 264 70 C275 100 261 149 259 213 C232 198 198 189 172 186 L169 145 Z' },
    { id:3, d:'M153 67 Q166 59 179 70 L177 119 Q166 130 154 119 Z' },
    { id:4, d:'M49 151 L55 181 L49 186 L42 157 Z' },
    { id:5, d:'M55 188 L60 215 L53 222 L48 192 Z' },
    { id:6, d:'M161 160 Q167 155 173 160 L173 190 Q166 195 161 190 Z' },
  ];
  return <svg viewBox="0 0 320 500" className={className} aria-label="Fantech Helios Go XD5 mouse" role="img">
    <defs>
      <linearGradient id={`${uid}-body`} x1="0" x2="1" y2=".6"><stop stopColor="#16191d"/><stop offset=".24" stopColor="#41464b"/><stop offset=".5" stopColor="#17191d"/><stop offset=".85" stopColor="#101215"/><stop offset="1" stopColor="#353a40"/></linearGradient>
      <linearGradient id={`${uid}-left`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#747b82"/><stop offset=".55" stopColor="#3a4047"/><stop offset="1" stopColor="#22262c"/></linearGradient>
      <linearGradient id={`${uid}-right`} x1="0" x2="1" y2="1"><stop stopColor="#646b72"/><stop offset="1" stopColor="#24282e"/></linearGradient>
      <linearGradient id={`${uid}-rgb`}><stop stopColor="#e95829"/><stop offset=".25" stopColor="#ec315e"/><stop offset=".55" stopColor="#8457e6"/><stop offset=".8" stopColor="#2fa7e2"/><stop offset="1" stopColor="#2dd492"/></linearGradient>
      <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
    </defs>
    <ellipse cx="163" cy="455" rx="112" ry="20" fill="#000" opacity=".18"/>
    <path d="M56 386 C44 442 94 474 161 477 C225 479 280 448 271 389" fill="none" stroke={multicolor ? `url(#${uid}-rgb)` : color} strokeWidth="15" filter={`url(#${uid}-glow)`} opacity={opacity} data-testid="ambient-glow"/>
    <path d="M57 55 C74 30 126 29 166 33 C204 32 254 44 267 70 C281 104 262 162 264 218 C264 280 281 348 276 397 C274 445 235 472 170 475 C103 479 58 451 51 410 C43 369 63 303 63 255 C62 207 46 156 47 112 C44 86 46 68 57 55 Z" fill={`url(#${uid}-body)`} stroke="#0b0d10" strokeWidth="3"/>
    <path d={zones[0].d} fill={`url(#${uid}-left)`} stroke="#14171a" strokeWidth="2"/>
    <path d={zones[1].d} fill={`url(#${uid}-right)`} stroke="#14171a" strokeWidth="2"/>
    <path d="M157 34 L157 130 Q164 150 173 137 L177 35" fill="#292e34" stroke="#101317" strokeWidth="2"/>
    <rect x="154" y="67" width="24" height="58" rx="12" fill="#090b0d" stroke="#50555a" strokeWidth="2"/>
    {[76,85,94,103,112].map(y => <path key={y} d={`M157 ${y} Q166 ${y-3} 175 ${y}`} fill="none" stroke="#51565c" strokeWidth="3"/>)}
    <path d="M61 202 Q154 165 259 213" fill="none" stroke="#080a0d" strokeWidth="3"/>
    <path d="M259 215 C253 260 244 292 242 326 Q243 348 264 363" fill="none" stroke="#0d1013" strokeWidth="2"/>
    <path d="M55 77 C49 111 56 153 63 178 M58 326 C47 372 51 411 69 433" fill="none" stroke="#b0b7bf" strokeWidth="2" opacity=".15"/>
    <path d={zones[3].d} fill="#33383e" stroke="#080a0c" strokeWidth="2"/>
    <path d={zones[4].d} fill="#33383e" stroke="#080a0c" strokeWidth="2"/>
    <path d={zones[5].d} fill="#1c2025" stroke="#080a0c" strokeWidth="2"/>
    <path d="M63 427 Q91 470 168 471 Q242 469 267 426" fill="none" stroke={off ? '#20252b' : multicolor ? `url(#${uid}-rgb)` : color} strokeWidth="3" opacity={off ? 1 : opacity} data-testid="mouse-led-strip" style={{ animation:off || mode === 2 ? 'none' : mode === 1 || mode === 7 ? `led-breathe ${duration} ease-in-out infinite` : `led-cycle ${duration} linear infinite` }}/>
    <path d="M151 450 L161 450 L161 458 L166 461 L166 450 L177 450 M155 454 L158 457 M172 454 L170 457" stroke="#646a72" strokeWidth="2" fill="none"/>
    {zones.map(zone => <path key={zone.id} data-testid={`mouse-btn-${zone.id}`} d={zone.d} fill={activeButton === zone.id ? color : 'transparent'} opacity={activeButton === zone.id ? .2 : 1} onClick={() => onSelectButton?.(zone.id)} onMouseEnter={() => onHoverButton?.(zone.id)} onMouseLeave={() => onHoverButton?.(null)} style={{cursor:'pointer'}}/>)}
  </svg>;
};
