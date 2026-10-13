import { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { useSettings } from '../../context/SettingsContext';

export function SyncBar({ className = '' }: { className?: string }) {
  const { isConnected } = useDevice();
  const { readFromDevice, applyToDevice, isLoadedFromDevice, isDirty, isReading, isSyncing, error } = useSettings();
  const [pending, setPending] = useState<'read' | 'write' | null>(null);
  const busy = isSyncing || isReading || pending !== null;
  const reading = isReading || pending === 'read';
  const failure = error;

  const handleReload = async () => {
    if (!isConnected || busy) return;
    if (isDirty && !window.confirm('Discard pending changes and reload the settings saved on your mouse?')) return;
    setPending('read');
    try {
      await readFromDevice();
    } catch {
      // The settings session publishes the failure and preserves the draft.
    } finally {
      setPending(null);
    }
  };

  const handleRetry = async () => {
    if (!isConnected || busy) return;
    setPending('write');
    try {
      await applyToDevice();
    } catch {
      // The settings session publishes the failure and preserves the draft.
    } finally {
      setPending(null);
    }
  };

  const title = !isConnected ? 'Mouse disconnected'
    : busy ? reading ? 'Reading settings from mouse…' : 'Saving changes to mouse…'
    : failure ? 'Settings could not be synchronized'
    : isDirty ? 'Changes waiting to sync'
    : isLoadedFromDevice ? 'In sync with mouse' : 'Reading initial settings…';
  const description = !isConnected ? 'Reconnect to read the settings saved on your mouse.'
    : busy ? reading ? 'Please wait while the hardware settings are read.' : 'Changes are being written and committed to your mouse.'
    : failure ? isDirty ? 'Your changes remain in this session. Retry sync to save them to the mouse.' : 'Reload from your mouse to try reading its saved settings again.'
    : isDirty ? 'Changes save automatically after a short pause.'
    : 'Settings are loaded from your mouse. New changes save automatically.';

  return <section className={`sync-bar ${className}`} aria-label="Mouse sync status" aria-busy={busy}>
    <div aria-live="polite">
      <div className="sync-title">{title}</div>
      <div className="ui-muted">{description}</div>
      {failure && !busy && <p className="ui-error" role="alert">{failure}</p>}
    </div>
    <div className="sync-actions">
      {failure && isDirty && <button className="ui-button primary" disabled={!isConnected || busy} onClick={handleRetry}>Retry sync</button>}
      <button className="ui-button" disabled={!isConnected || busy} onClick={handleReload} title="Reload settings saved on your mouse">
        {reading ? 'Reading…' : 'Reload from mouse'}
      </button>
    </div>
  </section>;
}
