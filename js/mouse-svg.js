/**
 * Fantech Helios Go XD5 - Vector SVG Mouse Visualizer
 * Completely standalone, responsive, with interactive button nodes and dynamic LED diffuser glow.
 */

export function renderMouseSvg() {
  return `
  <svg class="mouse-preview-svg" viewBox="0 0 320 500" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bodyGrad" x1="160" y1="20" x2="160" y2="480" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#2c303c"/>
        <stop offset="60%" stop-color="#1b1c23"/>
        <stop offset="100%" stop-color="#121318"/>
      </linearGradient>
      <linearGradient id="clickerGrad" x1="160" y1="20" x2="160" y2="230" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#343947"/>
        <stop offset="100%" stop-color="#1e2029"/>
      </linearGradient>
      <filter id="diffuserGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <!-- Main Outer Mouse Body Ergonomic Shape (Ergonomic Right-Handed Shell) -->
    <path d="M160 25 C115 25 80 80 75 160 C70 240 65 340 90 410 C110 460 145 475 160 475 C175 475 210 460 230 410 C255 340 250 240 245 160 C240 80 205 25 160 25 Z" 
          fill="url(#bodyGrad)" stroke="#3e4352" stroke-width="2.5" />

    <!-- Left Click Button -->
    <path id="btnSvg1" d="M157 26 C125 27 92 68 83 150 C100 155 140 156 157 156 Z" 
          fill="url(#clickerGrad)" stroke="#3a3e4e" stroke-width="1.5" style="cursor:pointer; transition:fill 0.2s;" />

    <!-- Right Click Button -->
    <path id="btnSvg2" d="M163 26 C195 27 228 68 237 150 C220 155 180 156 163 156 Z" 
          fill="url(#clickerGrad)" stroke="#3a3e4e" stroke-width="1.5" style="cursor:pointer; transition:fill 0.2s;" />

    <!-- Center Scroll Wheel Well & Button -->
    <rect x="150" y="60" width="20" height="60" rx="10" fill="#0d0e12" stroke="#252833" stroke-width="1.5" />
    <!-- Scroll Wheel (Button 3) -->
    <rect id="btnSvg3" x="153" y="70" width="14" height="40" rx="7" fill="#1b1d24" stroke="var(--profile-color)" stroke-width="2" style="cursor:pointer;" />
    <!-- Scroll Wheel Ribs -->
    <line x1="155" y1="80" x2="165" y2="80" stroke="#444" stroke-width="1.5" />
    <line x1="155" y1="90" x2="165" y2="90" stroke="#444" stroke-width="1.5" />
    <line x1="155" y1="100" x2="165" y2="100" stroke="#444" stroke-width="1.5" />

    <!-- DPI Button (Button 6) -->
    <rect id="btnSvg6" x="154" y="170" width="12" height="24" rx="4" fill="#252833" stroke="#4a5063" stroke-width="1" style="cursor:pointer;" />

    <!-- Left Side Button 4 (Back) -->
    <path id="btnSvg4" d="M72 230 C71 215 71 200 73 185 C67 190 64 210 65 230 Z" 
          fill="#333745" stroke="#4a5063" stroke-width="1" style="cursor:pointer;" />

    <!-- Left Side Button 5 (Forward) -->
    <path id="btnSvg5" d="M72 275 C70 260 70 245 72 235 C65 238 63 255 64 275 Z" 
          fill="#333745" stroke="#4a5063" stroke-width="1" style="cursor:pointer;" />

    <!-- Tail Ergonomic LED Diffuser Strip (Helios Go XD5 Bottom RGB Underglow) -->
    <path id="mouseLedStrip" d="M102 430 C125 460 195 460 218 430 C200 452 120 452 102 430 Z" 
          fill="var(--profile-color)" filter="url(#diffuserGlow)" opacity="0.9" style="transition: fill 0.3s;" />

    <!-- Subtle Fantech Helios Palm Logo -->
    <path d="M160 330 L166 342 L178 343 L169 351 L172 363 L160 356 L148 363 L151 351 L142 343 L154 342 Z" 
          fill="#3a3e4e" opacity="0.6" />
  </svg>
  `;
}
