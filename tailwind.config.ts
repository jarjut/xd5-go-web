import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: 'rgb(var(--base) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        hover: 'rgb(var(--hover) / <alpha-value>)',
        subtle: 'rgb(var(--border) / <alpha-value>)',
        brand: 'rgb(var(--accent) / <alpha-value>)',
        cyan: 'rgb(var(--accent) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
