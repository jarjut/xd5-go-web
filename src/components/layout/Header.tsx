import React from 'react';
import { Battery, Moon, Sun } from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { useTheme } from '../../context/ThemeContext';

export interface HeaderProps { className?: string; children?: React.ReactNode; }

export const Header: React.FC<HeaderProps> = ({ className = '', children }) => {
  const { transport, battery, disconnect } = useDevice();
  const { theme, setTheme } = useTheme();
  return <header className={`studio-header ${className}`}><div className="header-inner">
    <div className="header-brand">XD5 STUDIO</div>
    <div className="header-actions">
      <span className="ui-muted" role="status">{transport === 'wireless' ? 'Connected · Wireless' : 'Connected · USB'}</span>
      <span className="ui-muted flex items-center gap-2"><Battery size={17} aria-hidden="true" />{battery ? `${battery.power}%${battery.charging ? ' · Charging' : ''}` : 'Battery —'}</span>
      <button className="ui-button flex items-center gap-2" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>{theme === 'dark' ? <Sun size={16} aria-hidden="true"/> : <Moon size={16} aria-hidden="true"/>}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
      <button className="ui-button" onClick={disconnect}>Disconnect</button>
    </div>{children}
  </div></header>;
};
