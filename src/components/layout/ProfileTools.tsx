import { useRef, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';

export function ProfileTools({ className = '' }: { className?: string }) {
  const { settings, switchProfile, exportProfileJson, importProfileJson } = useSettings();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  return <div className={className}><div className="profile-tools"><div className="profile-modes" role="group" aria-label="Mouse profile">{[0,1,2].map(index => <button key={index} className={`ui-button ${settings.profile === index ? 'selected' : ''}`} aria-pressed={settings.profile === index} onClick={() => switchProfile(index)}>Profile {index + 1}</button>)}</div><div className="flex gap-2">
    <button className="ui-button" onClick={() => { const url = URL.createObjectURL(new Blob([exportProfileJson()], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `xd5_profile_${settings.profile + 1}.json`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); }}>Export</button>
    <button className="ui-button" onClick={() => fileInput.current?.click()}>Import</button>
    <input ref={fileInput} className="hidden" type="file" accept=".json" aria-label="Import profile file" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setError(''); const reader = new FileReader(); reader.onload = () => { if (!importProfileJson(String(reader.result))) setError('Could not import this file. Choose a valid profile JSON file.'); }; reader.onerror = () => setError('Could not read this file. Try selecting it again.'); reader.readAsText(file); }}/>
  </div></div>{error && <p role="alert" className="ui-error">{error}</p>}</div>;
}
