import { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { useSettings } from '../../context/SettingsContext';

export function SyncBar({ className = '' }: { className?: string }) {
  const { isConnected, isSyncing } = useDevice();
  const { isDirty, applyToDevice, readFromDevice } = useSettings();
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<'read' | 'save' | null>(null);
  const busy = isSyncing || pending !== null;
  const run = async (action: 'read' | 'save') => {
    if (!isConnected || busy) return;
    setPending(action); setError(''); setResult('');
    try { if (action === 'save') await applyToDevice(); else await readFromDevice(); setResult(action === 'save' ? 'Changes saved to mouse' : 'Settings read from mouse'); }
    catch { setError(action === 'save' ? 'Could not save. Check the connection and try again.' : 'Could not read settings. Check the connection and try again.'); }
    finally { setPending(null); }
  };
  return <section className={`sync-bar ${className}`} aria-label="Save mouse settings"><div aria-live="polite"><div className="sync-title">{busy ? pending === 'read' ? 'Reading settings…' : 'Saving settings…' : isDirty ? 'Unsaved changes' : result || 'Mouse settings'}</div><div className="ui-muted">{isDirty ? 'Your changes are local until you save to the mouse.' : !isConnected ? 'Connect your mouse to read or save settings.' : 'Read settings from your mouse or save your changes.'}</div>{error && <p className="ui-error" role="alert">{error}</p>}</div><div className="sync-actions"><button className="ui-button" disabled={!isConnected || busy} onClick={() => run('read')}>Read from mouse</button><button className="ui-button primary" disabled={!isConnected || busy} onClick={() => run('save')}>Save to mouse</button></div></section>;
}
