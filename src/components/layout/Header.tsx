import React, { useState } from 'react';
import { Battery, Moon, Sun } from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { useTheme } from '../../context/ThemeContext';

export interface HeaderProps { className?: string; children?: React.ReactNode; }

export const Header: React.FC<HeaderProps> = ({ className = '', children }) => {
  const { isConnected, isConnecting, transport, battery, connect, disconnect } = useDevice();
  const { theme, setTheme } = useTheme();
  const [error, setError] = useState('');
  return <header className={`studio-header ${className}`}><div className="header-inner">
    <div className="header-brand">XD5 STUDIO</div>
    <div className="header-actions">
      <span className="ui-muted" role="status">{isConnecting ? 'Connecting…' : isConnected ? transport === 'wireless' ? 'Connected · Wireless' : 'Connected · USB' : 'Not connected'}</span>
      <span className="ui-muted flex items-center gap-2"><Battery size={17} aria-hidden="true" />{battery ? `${battery.power}%${battery.charging ? ' · Charging' : ''}` : 'Battery —'}</span>
      <button className="ui-button flex items-center gap-2" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>{theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
      <button className="ui-button" disabled={isConnecting} onClick={async () => { setError(''); try { if (isConnected) disconnect(); else await connect(); } catch { setError('Could not connect. Check your mouse and try again.'); } }}>{isConnecting ? 'Connecting…' : isConnected ? 'Disconnect' : 'Connect mouse'}</button>
    </div>{children}
    {error && <p className="ui-error" role="alert">{error}</p>}
  </div></header>;
};
