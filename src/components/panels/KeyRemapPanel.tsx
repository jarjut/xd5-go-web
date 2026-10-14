import React from 'react';
import {
  Mouse,
  Layers,
  RotateCcw,
  MousePointer,
  Navigation,
  Sliders,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

export interface KeyRemapPanelProps {
  focusedButton?: number | null;
  onHoverButton?: (btnId: number | null) => void;
  className?: string;
}

export interface KeyOption {
  value: string;
  label: string;
}

export interface KeyCategory {
  category: string;
  options: KeyOption[];
}

export const KEY_CATEGORIES: KeyCategory[] = [
  {
    category: 'Standard Clicks',
    options: [
      { value: '0x00000101', label: 'Left Click' },
      { value: '0x00000201', label: 'Right Click' },
      { value: '0x00000401', label: 'Middle Click' },
      { value: '0x00023204', label: 'Double Click' },
      { value: '0x00033204', label: 'Three Click' },
      { value: '0x00003204', label: 'Fire Key (Rapid Fire)' },
    ],
  },
  {
    category: 'Navigation',
    options: [
      { value: '0x00000801', label: 'Back' },
      { value: '0x00001001', label: 'Forward' },
    ],
  },
  {
    category: 'Hardware Loop Functions',
    options: [
      { value: '0x00000102', label: 'DPI Loop' },
      { value: '0x00000202', label: 'DPI +' },
      { value: '0x00000302', label: 'DPI -' },
      { value: '0x00000f0a', label: 'DPI Lock (Sniper)' },
      { value: '0x00000007', label: 'RGB Mode Switch' },
      { value: '0x00000008', label: 'Polling Rate Switch' },
      { value: '0x00000009', label: 'Profile Switch' },
      { value: '0x00000000', label: 'Disable Button' },
    ],
  },
  {
    category: 'Multimedia & Windows',
    options: [
      { value: '0x0000cd05', label: 'Play / Pause' },
      { value: '0x0000b705', label: 'Stop Play' },
      { value: '0x0000b605', label: 'Previous Track' },
      { value: '0x0000b505', label: 'Next Track' },
      { value: '0x0000e905', label: 'Volume Up' },
      { value: '0x0000ea05', label: 'Volume Down' },
      { value: '0x0000e205', label: 'Mute' },
      { value: '0x00022305', label: 'Home Page' },
      { value: '0x00018a05', label: 'Email' },
      { value: '0x00019205', label: 'Calculator' },
      { value: '0x00019405', label: 'File Explorer' },
      { value: '0x00022105', label: 'Search' },
      { value: '0x00022705', label: 'Refresh' },
      { value: '0x00022a05', label: 'Favorites' },
    ],
  },
];

export interface ButtonDefinition {
  id: number;
  label: string;
  keyName: string;
  defaultVal: string;
  eepromAddr: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export const BUTTON_DEFINITIONS: ButtonDefinition[] = [
  {
    id: 1,
    label: '1. Left Click',
    keyName: 'key1',
    defaultVal: '0x00000101',
    eepromAddr: '0x60',
    description: 'Main left button',
    Icon: MousePointer,
  },
  {
    id: 2,
    label: '2. Right Click',
    keyName: 'key2',
    defaultVal: '0x00000201',
    eepromAddr: '0x64',
    description: 'Main right button',
    Icon: MousePointer,
  },
  {
    id: 3,
    label: '3. Middle Button',
    keyName: 'key3',
    defaultVal: '0x00000401',
    eepromAddr: '0x68',
    description: 'Press the scroll wheel',
    Icon: Mouse,
  },
  {
    id: 4,
    label: '4. Back Button',
    keyName: 'key4',
    defaultVal: '0x00000801',
    eepromAddr: '0x6C',
    description: 'Lower side button',
    Icon: Navigation,
  },
  {
    id: 5,
    label: '5. Forward Button',
    keyName: 'key5',
    defaultVal: '0x00001001',
    eepromAddr: '0x70',
    description: 'Upper side button',
    Icon: Navigation,
  },
  {
    id: 6,
    label: '6. DPI Loop Button',
    keyName: 'key6',
    defaultVal: '0x00000102',
    eepromAddr: '0x74',
    description: 'Button behind the scroll wheel',
    Icon: Sliders,
  },
];

const ALL_KEY_OPTIONS_MAP: Record<string, string> = {};
for (const cat of KEY_CATEGORIES) {
  for (const opt of cat.options) {
    ALL_KEY_OPTIONS_MAP[opt.value.toLowerCase()] = opt.label;
  }
}
const LEGACY_KEY_MIGRATION: Record<string, string> = {
  '0x00002001': '0x00023204',
  '0x000000ad': '0x00000f0a',
  '0x00000010': '0x0000cd05',
  '0x00000011': '0x0000b705',
  '0x00000012': '0x0000b605',
  '0x00000013': '0x0000b505',
  '0x00000014': '0x0000e905',
  '0x00000015': '0x0000ea05',
  '0x00000016': '0x0000e205',
  '0x00000020': '0x00022305',
  '0x00000021': '0x00018a05',
  '0x00000022': '0x00019205',
  '0x00000023': '0x00019405',
  '0x00000024': '0x00022105',
  '0x00000025': '0x00022705',
  '0x00000026': '0x00022a05',
};

export const normalizeKeyVal = (val?: string): string => {
  if (!val) return '0x00000101';
  const lower = val.toLowerCase();
  if (LEGACY_KEY_MIGRATION[lower]) return LEGACY_KEY_MIGRATION[lower];
  const num = parseInt(val, 16);
  if (isNaN(num)) return lower;
  const normalized = '0x' + ((num & 0x00ffffff) >>> 0).toString(16).padStart(8, '0');
  return LEGACY_KEY_MIGRATION[normalized] || normalized;
};

export const KeyRemapPanel: React.FC<KeyRemapPanelProps> = ({
  focusedButton,
  onHoverButton,
  className = '',
}) => {
  const { settings, updateSettings } = useSettings();

  const keys = settings?.keys || {
    key1: '0x00000101',
    key2: '0x00000201',
    key3: '0x00000401',
    key4: '0x00000801',
    key5: '0x00001001',
    key6: '0x00000102',
  };

  const handleKeyChange = (keyName: string, newValue: string) => {
    updateSettings({
      keys: {
        ...keys,
        [keyName]: newValue,
      },
    });
  };

  const handleResetDefaults = () => {
    updateSettings({
      keys: {
        key1: '0x00000101',
        key2: '0x00000201',
        key3: '0x00000401',
        key4: '0x00000801',
        key5: '0x00001001',
        key6: '0x00000102',
      },
    });
  };

  const hasLeftClick = Object.values(keys).some(
    (v) => normalizeKeyVal(v) === '0x00000101'
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {!hasLeftClick && (
        <div
          role="alert"
          className="p-3 rounded-xl border border-amber-500/50 bg-amber-950/60 text-amber-200 flex items-center gap-3 text-xs font-semibold shadow-lg"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Warning: At least one button must be configured as &quot;Left Click&quot;!</span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-subtle bg-card/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface border border-subtle flex items-center justify-center text-cyan shadow-sm">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-white tracking-wide">
              Buttons
            </h3>
            <p className="text-xs text-slate-400">
              Choose what each mouse button does.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-subtle bg-surface text-slate-300 hover:text-white hover:border-slate-500 hover:bg-hover transition-all text-xs font-semibold cursor-pointer select-none"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan" />
          <span>Restore button defaults</span>
        </button>
      </div>

      {/* Buttons Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {BUTTON_DEFINITIONS.map((btn) => {
          const currentVal = normalizeKeyVal(keys[btn.keyName] || btn.defaultVal);
          const actionLabel = ALL_KEY_OPTIONS_MAP[currentVal] || currentVal;
          const isFocused = focusedButton === btn.id;
          const Icon = btn.Icon;

          return (
            <div
              key={btn.id}
              data-testid={`key-remap-card-${btn.id}`}
              data-focused={isFocused ? 'true' : 'false'}
              onMouseEnter={() => onHoverButton?.(btn.id)}
              onMouseLeave={() => onHoverButton?.(null)}
              onFocus={() => onHoverButton?.(btn.id)}
              onBlur={() => onHoverButton?.(null)}
              className={`p-4 rounded-xl border transition-all duration-200 relative flex flex-col justify-between gap-3 ${
                isFocused
                  ? 'border-brand ring-1 ring-brand/40 bg-card/90'
                  : 'border-subtle bg-card/40 hover:bg-card/70 hover:border-slate-600'
              }`}
            >
              {/* Header row inside card */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      isFocused ? 'bg-cyan/20 text-cyan' : 'bg-surface text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-display font-semibold text-sm text-slate-200 tracking-wide">
                      {btn.label}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {btn.description}
                    </p>
                  </div>
                </div>

                <span className="ui-muted">{btn.id}</span>
              </div>

              {/* Action selection dropdown */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Action:</span>
                  <span className="font-display text-cyan text-xs font-semibold truncate max-w-[150px]">
                    {actionLabel}
                  </span>
                </div>

                <div className="relative">
                  <select
                    id={`key-select-${btn.id}`}
                    aria-label={btn.label}
                    value={currentVal}
                    onChange={(e) => handleKeyChange(btn.keyName, e.target.value)}
                    className="w-full px-3 py-2 text-xs font-sans rounded-lg bg-surface border border-subtle text-slate-100 hover:border-slate-500 focus:border-cyan focus:ring-1 focus:ring-cyan/40 outline-none transition-colors appearance-none cursor-pointer"
                  >
                    {KEY_CATEGORIES.map((cat) => (
                      <optgroup key={cat.category} label={cat.category}>
                        {cat.options.map((opt) => (
                          <option key={opt.value} value={opt.value.toLowerCase()}>
                            {opt.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                    <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
