import { useState } from 'react';
import { useDevice } from '../../context/DeviceContext';
import { useSettings } from '../../context/SettingsContext';

export function SyncBar({ className = '' }: { className?: string }) {
  const { isConnected, isSyncing } = useDevice();
  const { readFromDevice, isLoadedFromDevice } = useSettings();
  const [error, setError] = useState('');
  const [isReading, setIsReading] = useState(false);

  const handleReload = async () => {
    if (!isConnected || isSyncing || isReading) return;
    setIsReading(true);
    setError('');
    try {
      await readFromDevice();
    } catch {
      setError('Could not reload settings from mouse. Check connection.');
    } finally {
      setIsReading(false);
    }
  };

  const busy = isSyncing || isReading;

  return (
    <section className={`sync-bar ${className}`} aria-label="Mouse sync status">
      <div aria-live="polite">
        <div className="sync-title">
          {busy
            ? isReading
              ? 'Reading settings from mouse…'
              : 'Auto-syncing to mouse…'
            : !isConnected
              ? 'Mouse not connected'
              : isLoadedFromDevice
                ? 'In sync with mouse'
                : 'Reading initial settings…'}
        </div>
        <div className="ui-muted">
          {!isConnected
            ? 'Connect your mouse above to read hardware settings. Changes will auto-sync instantly.'
            : isLoadedFromDevice
              ? 'All settings are loaded directly from mouse hardware. Changes auto-sync instantly.'
              : 'Connecting and reading hardware EEPROM settings from mouse…'}
        </div>
        {error && (
          <p className="ui-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="sync-actions">
        <button
          className="ui-button"
          disabled={!isConnected || busy}
          onClick={handleReload}
          title="Reload fresh settings directly from mouse hardware"
        >
          {isReading ? 'Reading…' : 'Reload from mouse'}
        </button>
      </div>
    </section>
  );
}
