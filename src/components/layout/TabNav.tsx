import React from 'react';
import {
  Target,
  Sun,
  Mouse,
  SlidersHorizontal,
  Terminal,
} from 'lucide-react';

export type TabId = 'dpi' | 'lighting' | 'remap' | 'sensor' | 'diagnostics';

export interface TabItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const TABS: TabItem[] = [
  { id: 'dpi', label: 'DPI Settings', icon: Target },
  { id: 'lighting', label: 'Lighting (RGB)', icon: Sun },
  { id: 'remap', label: 'Key Remapping', icon: Mouse },
  { id: 'sensor', label: 'Sensor & Performance', icon: SlidersHorizontal },
  { id: 'diagnostics', label: 'Protocol & Diagnostics', icon: Terminal },
];

export interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  className?: string;
}

export const TabNav: React.FC<TabNavProps> = ({
  activeTab,
  onTabChange,
  className = '',
}) => {
  return (
    <nav
      aria-label="Configuration Sections"
      className={`w-full overflow-x-auto scrollbar-none pb-1 ${className}`}
    >
      <div
        role="tablist"
        aria-label="Mouse configuration tabs"
        className="flex items-center gap-1.5 p-1.5 bg-surface/90 border border-subtle rounded-xl shadow-lg backdrop-blur-sm min-w-max"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              data-active={isActive ? 'true' : 'false'}
              onClick={() => onTabChange(tab.id)}
              className={`group relative flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer select-none ${
                isActive
                  ? 'bg-card text-white border border-subtle shadow-md shadow-black/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-hover/70 border border-transparent'
              }`}
            >
              <Icon
                className={`w-4 h-4 transition-colors ${
                  isActive
                    ? 'text-brand'
                    : 'text-slate-500 group-hover:text-slate-300'
                }`}
              />
              <span>{tab.label}</span>

              {/* Bottom active indicator line */}
              {isActive && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-brand rounded-full shadow-[0_0_8px_rgba(255,51,75,0.8)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
