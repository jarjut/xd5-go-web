import { useState } from 'react';
import { AlertTriangle, Cpu } from 'lucide-react';
import { DeviceProvider } from './context/DeviceContext';
import { ProfileProvider } from './context/ProfileContext';
import { Header } from './components/layout/Header';
import { TabNav, type TabId } from './components/layout/TabNav';
import { MouseStage } from './components/stage/MouseStage';
import { DpiPanel } from './components/panels/DpiPanel';
import { LightingPanel } from './components/panels/LightingPanel';
import { KeyRemapPanel } from './components/panels/KeyRemapPanel';
import { SensorPanel } from './components/panels/SensorPanel';
import { DiagnosticsPanel } from './components/panels/DiagnosticsPanel';

function WorkbenchShell() {
  const [activeTab, setActiveTab] = useState<TabId>('dpi');
  const [focusedButton, setFocusedButton] = useState<number | null>(null);
  const [hoveredButton, setHoveredButton] = useState<number | null>(null);

  const isWebHidSupported =
    typeof navigator !== 'undefined' && 'hid' in navigator;

  const handleSelectButton = (btnId: number) => {
    setFocusedButton(btnId);
    setActiveTab('remap');
  };

  const handleHoverButton = (btnId: number | null) => {
    setHoveredButton(btnId);
  };

  return (
    <div className="min-h-screen bg-base text-slate-100 flex flex-col font-sans selection:bg-brand selection:text-white">
      {/* Non-Chromium WebHID Support Warning Banner */}
      {!isWebHidSupported && (
        <div
          role="alert"
          className="bg-amber-950/80 border-b border-amber-500/40 text-amber-200 px-4 py-3 flex items-center justify-center gap-3 text-xs sm:text-sm font-medium shadow-md backdrop-blur-sm"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p>
            <strong className="font-semibold text-amber-300">
              WebHID is not supported in this browser.
            </strong>{' '}
            To configure your mouse hardware, please open this app in Chrome,
            Edge, Opera, or other Chromium-based browsers.
          </p>
        </div>
      )}

      {/* Global Header with integrated Profile Toolbar */}
      <Header showProfileBar={true} />

      {/* Main Studio Workbench (Responsive Dual-Pane) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Pane: Sticky Interactive Vector Mouse Stage (Desktop >= 1024px) */}
        <section
          aria-label="Interactive Mouse Visualizer"
          className="w-full lg:w-[380px] xl:w-[420px] lg:sticky lg:top-6 shrink-0"
        >
          <div className="bg-surface border border-subtle rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col items-center relative overflow-hidden backdrop-blur-sm">
            <MouseStage
              activeZone={focusedButton}
              hoveredButton={hoveredButton}
              onSelectButton={handleSelectButton}
              onHoverButton={handleHoverButton}
              className="w-full"
            />
          </div>
        </section>

        {/* Right Pane: Tab Navigation & Active Configuration Deck */}
        <section
          aria-label="Configuration Panels"
          className="flex-1 w-full min-w-0 flex flex-col gap-6"
        >
          {/* Segmented Tab Navigation Bar */}
          <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Active Configuration Panel Container */}
          <div
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            className="w-full transition-opacity duration-200"
          >
            {activeTab === 'dpi' && <DpiPanel />}
            {activeTab === 'lighting' && <LightingPanel />}
            {activeTab === 'remap' && (
              <KeyRemapPanel
                focusedButton={focusedButton}
                onHoverButton={handleHoverButton}
              />
            )}
            {activeTab === 'sensor' && <SensorPanel />}
            {activeTab === 'diagnostics' && <DiagnosticsPanel />}
          </div>
        </section>
      </main>

      {/* Global Reverse-Engineering Attribution Footer */}
      <footer className="w-full border-t border-subtle bg-surface/60 mt-auto py-6 px-4 text-center text-xs text-slate-500 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-cyan" />
            <span className="font-semibold text-slate-300">
              Helios Go XD5
            </span>
            <span>·</span>
            <span>WebHID Studio</span>
          </div>
          <p className="text-slate-400">
            Reverse-engineered protocol for PixArt PAW3370 & CompX Wireless
            (VID 0x25A7 · PID 0xFA7B wired / 0xFA7C wireless)
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <DeviceProvider>
      <ProfileProvider>
        <WorkbenchShell />
      </ProfileProvider>
    </DeviceProvider>
  );
}
