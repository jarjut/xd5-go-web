import { useState, type ReactNode } from 'react';
import { SettingsProvider } from '../context/SettingsContext';
import { SettingsSession } from '../core/settingsSession';
import { createDefaultSettings } from '../core/settings';

/** Isolated panel tests explicitly opt into a loaded, in-memory mouse session. */
export function ReadySettingsProvider({ children, session }: { children: ReactNode; session?: SettingsSession }) {
  const [fallback] = useState(() => new SettingsSession({ settings: createDefaultSettings() }));
  return <SettingsProvider session={session || fallback}>{children}</SettingsProvider>;
}
