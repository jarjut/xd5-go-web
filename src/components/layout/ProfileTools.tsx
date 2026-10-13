import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

export function ProfileTools({ className = '' }: { className?: string }) {
  const { exportProfileJson, importProfileJson, isReading } = useSettings();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const handleExport = () => {
    const json = exportProfileJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'xd5_profile.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isReading) return;
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      const success = importProfileJson(String(reader.result));
      if (!success) {
        setError('Could not import this file. Choose a valid profile JSON file.');
      }
    };
    reader.onerror = () => {
      setError('Could not read this file. Try selecting it again.');
    };
    reader.readAsText(file);
  };

  return (
    <div className={className}>
      <div className="profile-tools flex justify-end gap-2 mb-4">
        <button
          className="ui-button flex items-center gap-2"
          onClick={handleExport}
          title="Export profile settings to JSON file"
        >
          <Download className="w-4 h-4" />
          <span>Export Profile</span>
        </button>
        <button
          className="ui-button flex items-center gap-2"
          disabled={isReading}
          onClick={() => fileInput.current?.click()}
          title="Import profile settings from JSON file"
        >
          <Upload className="w-4 h-4" />
          <span>Import Profile</span>
        </button>
        <input
          ref={fileInput}
          className="hidden"
          type="file"
          accept=".json"
          aria-label="Import profile file"
          disabled={isReading}
          onChange={handleFileChange}
        />
      </div>
      {error && (
        <p role="alert" className="ui-error mb-2 text-right">
          {error}
        </p>
      )}
    </div>
  );
}
