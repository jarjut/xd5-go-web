import { useEffect, useState } from 'react';
import { DeviceProvider, useDevice } from './context/DeviceContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/layout/Header';
import { ProfileTools } from './components/layout/ProfileTools';
import { SyncBar } from './components/layout/SyncBar';
import { TabNav, type TabId } from './components/layout/TabNav';
import { MouseStage } from './components/stage/MouseStage';
import { DpiPanel } from './components/panels/DpiPanel';
import { LightingPanel } from './components/panels/LightingPanel';
import { KeyRemapPanel } from './components/panels/KeyRemapPanel';
import { SensorPanel } from './components/panels/SensorPanel';
import { DiagnosticsPanel } from './components/panels/DiagnosticsPanel';
import { ConnectionScreen } from './components/layout/ConnectionScreen';

function WorkbenchShell() {
  const [activeTab, setActiveTab] = useState<TabId>('dpi');
  const [focusedButton, setFocusedButton] = useState<number | null>(null);
  const [hoveredButton, setHoveredButton] = useState<number | null>(null);
  const { isReading } = useSettings();
  return <div className="min-h-screen">
    <Header />
    <main className="studio"><div className="studio-workspace">
      <section aria-label="Interactive Mouse Visualizer" className="device-pane"><div className="device-title"><small>Fantech Helios Go</small><h1>XD5</h1></div><MouseStage activeZone={focusedButton} hoveredButton={hoveredButton} onSelectButton={id => { setFocusedButton(id); setActiveTab('remap'); }} onHoverButton={setHoveredButton}/><p className="ui-muted text-center mt-5">Select a button on the mouse to change what it does.</p></section>
      <section aria-label="Configuration Panels" className="settings-pane"><ProfileTools/><TabNav activeTab={activeTab} onTabChange={setActiveTab}/><div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} tabIndex={0}><fieldset disabled={isReading} className="min-w-0 m-0 p-0 border-0" aria-label="Mouse settings">
        {activeTab === 'dpi' && <DpiPanel/>}
        {activeTab === 'remap' && <KeyRemapPanel focusedButton={focusedButton} onHoverButton={setHoveredButton}/>}
        {activeTab === 'lighting' && <LightingPanel/>}
        {activeTab === 'sensor' && <SensorPanel/>}
        {activeTab === 'diagnostics' && <DiagnosticsPanel/>}
      </fieldset></div></section>
    </div><SyncBar/></main>
    <footer className="ui-muted text-center px-5 py-5">Helios Go XD5 · WebHID Studio · PixArt PAW3370</footer>
  </div>;
}

export function AppContent() {
  const { isConnected, isConnecting, connect } = useDevice();
  const { isLoadedFromDevice, isReading, error, readFromDevice } = useSettings();
  const [wasConnected, setWasConnected] = useState(false);
  const supported = typeof navigator !== 'undefined' && Boolean(navigator.hid);

  useEffect(() => {
    if (isConnected) setWasConnected(true);
  }, [isConnected]);

  if (!supported || !isConnected || isConnecting || !isLoadedFromDevice) {
    return <ConnectionScreen supported={supported} isConnected={isConnected}
      isConnecting={isConnecting} isReading={isReading} wasConnected={wasConnected}
      error={isConnected ? error : null} connect={connect} readFromDevice={readFromDevice} />;
  }
  return <WorkbenchShell />;
}
export default function App() {
  return <ThemeProvider><DeviceProvider><SettingsProvider><AppContent/></SettingsProvider></DeviceProvider></ThemeProvider>;
}
