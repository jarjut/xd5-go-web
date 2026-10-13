import { useEffect, useState } from 'react';
import { ArrowRight, CircleAlert, LoaderCircle, ShieldCheck, Usb } from 'lucide-react';
import { MouseSvg } from '../stage/MouseSvg';

interface ConnectionScreenProps {
  supported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  isReading: boolean;
  wasConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  readFromDevice: () => Promise<void>;
}

export function ConnectionScreen({
  supported, isConnected, isConnecting, isReading, wasConnected, error, connect, readFromDevice,
}: ConnectionScreenProps) {
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    setAttemptError(null);
    setCancelled(false);
  }, [isConnected]);

  const failure = error || attemptError;
  const reading = isConnected && (isReading || (!failure && !isConnecting));
  const busy = pending || isConnecting || isReading || reading;

  const handleConnect = async () => {
    if (busy || !supported) return;
    setAttemptError(null);
    setCancelled(false);
    setPending(true);
    try {
      if (isConnected) await readFromDevice();
      else {
        await connect();
        // A dismissed picker resolves without a device; connected state takes precedence.
        setCancelled(true);
      }
    } catch (cause) {
      const name = typeof cause === 'object' && cause !== null && 'name' in cause ? cause.name : null;
      if (name === 'NotFoundError' || name === 'AbortError') {
        setCancelled(true);
      } else {
        setAttemptError(cause instanceof Error ? cause.message : 'Could not connect to your mouse. Please try again.');
      }
    } finally {
      setPending(false);
    }
  };

  const status = !supported ? 'A compatible browser is needed'
    : isConnecting || (pending && !isConnected) ? 'Waiting for your mouse'
    : isReading || reading ? 'Reading your mouse settings'
    : failure ? isConnected ? 'Settings could not be read' : 'Connection could not be completed'
    : cancelled ? 'No mouse selected'
    : wasConnected ? 'Mouse disconnected' : 'Ready when you are';
  const description = !supported ? 'Open this page in desktop Chrome or Edge. WebHID is required to connect to your XD5.'
    : isConnecting || (pending && !isConnected) ? 'Choose your Fantech XD5 in the browser device picker to continue.'
    : isReading || reading ? 'Your configuration is being read directly from the mouse. The workspace will open when it is ready.'
    : failure ? isConnected ? 'Your mouse is connected, but its settings are not ready. Retry the read to open your workspace.' : 'Check the USB cable or wireless receiver, then try connecting again.'
    : cancelled ? 'Nothing has changed. Select your XD5 when you are ready to configure it.'
    : wasConnected ? 'Reconnect to start a fresh session. Settings will be read from your mouse again; previous drafts are not restored.'
    : 'Connect your XD5 by USB or its wireless receiver. Your current settings will be read before you make any changes.';
  const buttonLabel = isConnecting || (pending && !isConnected) ? 'Connecting…'
    : isReading || reading || pending ? 'Reading settings…'
    : isConnected ? 'Retry reading settings'
    : failure ? 'Try connecting again' : 'Connect mouse';

  return <main className="connection-screen" aria-labelledby="connection-heading">
    <div className="connection-brand"><span className="connection-brand-mark" aria-hidden="true" />XD5 STUDIO<span className="connection-brand-caption">DEVICE WORKSPACE</span></div>
    <div className="connection-layout">
      <div className="connection-art">
        <div className="connection-art-orbit" aria-hidden="true" />
        <span className="connection-art-label" aria-hidden="true">HELIOS GO</span>
        <MouseSvg activeButton={null} className="connection-mouse" />
        <div className="connection-device-caption"><span>FANTECH HELIOS GO</span><strong>XD5</strong><span>PixArt PAW3370 · Wireless / USB</span></div>
      </div>
      <section className="connection-copy">
        <p className="connection-eyebrow">YOUR MOUSE. YOUR SETTINGS.</p>
        <h1 id="connection-heading">Make it<br /><span>feel like you.</span></h1>
        <p className="connection-intro">One workspace for precision, lighting, and every click. Start with the settings already on your mouse.</p>
        <div className={`connection-status${failure && !busy ? ' has-error' : ''}`} aria-busy={busy}>
          <div className="connection-status-title" role="status" aria-live="polite">
            {busy ? <LoaderCircle size={18} className="connection-spinner" aria-hidden="true" /> : failure || !supported ? <CircleAlert size={18} aria-hidden="true" /> : <Usb size={18} aria-hidden="true" />}
            <h2>{status}</h2>
          </div>
          <p {...(!supported ? { role: 'alert' } : {})}>{description}</p>
          {supported && failure && !busy && <p className="ui-error" role="alert">{failure}</p>}
          {supported && <button className="ui-button primary connection-action" disabled={busy} onClick={handleConnect}>
            {busy ? <LoaderCircle size={18} className="connection-spinner" aria-hidden="true" /> : <Usb size={18} aria-hidden="true" />}
            <span>{buttonLabel}</span>{!busy && <ArrowRight size={18} aria-hidden="true" />}
          </button>}
        </div>
        <div className="connection-trust"><ShieldCheck size={18} aria-hidden="true" /><p>Direct to your mouse. No account, no cloud, no saved browser drafts.</p></div>
      </section>
    </div>
    <div className="connection-footer"><span>FANTECH · HELIOS GO XD5</span><span>Designed for your next move.</span></div>
  </main>;
}
