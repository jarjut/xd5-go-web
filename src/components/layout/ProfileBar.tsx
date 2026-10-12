import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Pencil,
  Palette,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  Check,
  X,
  ChevronDown,
} from 'lucide-react';
import { useProfiles } from '../../context/ProfileContext';

export interface ProfileBarProps {
  className?: string;
}

export const ProfileBar: React.FC<ProfileBarProps> = ({ className = '' }) => {
  const {
    profiles,
    activeProfile,
    activeIndex,
    selectProfile,
    updateActiveProfile,
    addNewProfile,
    renameActiveProfile,
    deleteActiveProfile,
    resetToFactory,
    exportJson,
    importJson,
  } = useProfiles();

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(activeProfile?.name || '');
  const colorInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeColor =
    activeProfile?.profileColor || activeProfile?.accentColor || '#00e5ff';

  // Synchronize CSS custom property --profile-accent with active profile color
  useEffect(() => {
    if (activeColor && typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--profile-accent', activeColor);
    }
  }, [activeColor]);

  // Sync renameValue whenever active profile changes
  useEffect(() => {
    setRenameValue(activeProfile?.name || '');
  }, [activeProfile?.name]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextIndex = Number(e.target.value);
    selectProfile(nextIndex);
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextColor = e.target.value;
    updateActiveProfile({
      profileColor: nextColor,
      accentColor: nextColor,
    });
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--profile-accent', nextColor);
    }
  };

  const handleColorSwatchClick = () => {
    colorInputRef.current?.click();
  };

  const handleColorSyncClick = () => {
    // Synchronize LED lighting color with profile signature accent color
    updateActiveProfile({
      lighting: {
        ...(activeProfile?.lighting ?? { mode: 0, color: activeColor, brightness: 5, speed: 5 }),
        color: activeColor,
      },
    });
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--profile-accent', activeColor);
    }
  };

  const handleRenameClick = () => {
    setIsRenaming((prev) => !prev);
  };
  const handleSaveRename = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (renameValue.trim()) {
      renameActiveProfile(renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleCancelRename = () => {
    setRenameValue(activeProfile?.name || '');
    setIsRenaming(false);
  };

  const handleAddClick = () => {
    addNewProfile();
  };

  const handleResetClick = () => {
    resetToFactory(activeIndex);
  };

  const handleDeleteClick = () => {
    if (profiles.length > 1) {
      deleteActiveProfile(activeIndex);
    }
  };

  const handleExportClick = () => {
    const jsonStr = exportJson(activeIndex);
    if (!jsonStr) return;

    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (activeProfile?.name || `profile_${activeIndex + 1}`)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_');
      a.download = `xd5_${safeName}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback in headless / non-browser test environments
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        importJson(text);
      } catch (err: unknown) {
        console.error('Failed to import profile:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className={`w-full bg-base/80 border-b border-subtle/80 px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      {/* Left: Profile Selector & Signature Color Picker Swatch */}
      <div className="flex items-center gap-3">
        {/* Profile Dropdown or Inline Rename */}
        {isRenaming ? (
          <form onSubmit={handleSaveRename} className="flex items-center gap-1.5">
            <input
              type="text"
              aria-label="Rename Profile Input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancelRename();
                }
              }}
              autoFocus
              className="px-2.5 py-1 text-xs font-medium bg-card border border-brand rounded text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <button
              type="submit"
              aria-label="Confirm Rename"
              className="p-1 rounded bg-card hover:bg-hover border border-subtle text-emerald-400"
              title="Save name"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Cancel Rename"
              onClick={handleCancelRename}
              className="p-1 rounded bg-card hover:bg-hover border border-subtle text-slate-400"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <div className="relative flex items-center">
            <select
              aria-label="Active Profile"
              value={activeIndex}
              onChange={handleProfileChange}
              className="appearance-none bg-card hover:bg-hover border border-subtle text-slate-200 text-xs font-semibold py-1.5 pl-3 pr-8 rounded-md focus:outline-none focus:border-brand cursor-pointer transition-colors"
            >
              {profiles.map((p, idx) => (
                <option key={p.id ?? idx} value={idx} className="bg-card text-slate-200">
                  {`Profile ${idx + 1}: ${p.name}`}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
          </div>
        )}

        {/* Signature Color Swatch */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <input
              ref={colorInputRef}
              type="color"
              aria-label="Signature Color"
              value={activeColor}
              onChange={handleColorChange}
              className="sr-only"
            />
            <button
              type="button"
              onClick={handleColorSwatchClick}
              aria-label="Color Swatch"
              data-testid="signature-color-swatch"
              className="w-6 h-6 rounded-md border-2 border-slate-700 hover:border-slate-400 shadow-sm transition-transform active:scale-95 flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: activeColor }}
              title={`Profile Signature Color: ${activeColor}`}
            />
          </div>
          <span className="text-[11px] font-mono text-slate-400 uppercase hidden sm:inline">
            {activeColor}
          </span>
        </div>
      </div>

      {/* Right: Lucide Action Toolbar */}
      <div className="flex items-center gap-1 bg-card/60 p-0.5 rounded-md border border-subtle">
        {/* Hidden File Input for Import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileSelected}
          className="hidden"
          aria-label="Upload Profile File"
        />

        {/* Add Profile */}
        <button
          type="button"
          onClick={handleAddClick}
          aria-label="Add Profile"
          className="p-1.5 rounded hover:bg-hover text-slate-300 hover:text-white transition-colors"
          title="Add New Profile"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {/* Rename Profile */}
        <button
          type="button"
          onClick={handleRenameClick}
          aria-label="Rename Profile"
          className="p-1.5 rounded hover:bg-hover text-slate-300 hover:text-white transition-colors"
          title="Rename Active Profile"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>

        {/* Color Sync */}
        <button
          type="button"
          onClick={handleColorSyncClick}
          aria-label="Color Sync"
          className="p-1.5 rounded hover:bg-hover text-slate-300 hover:text-white transition-colors"
          title="Sync Lighting with Accent Color"
        >
          <Palette className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-3.5 bg-subtle mx-0.5" />

        {/* Reset Profile */}
        <button
          type="button"
          onClick={handleResetClick}
          aria-label="Reset Profile"
          className="p-1.5 rounded hover:bg-hover text-slate-300 hover:text-white transition-colors"
          title="Reset Active Profile to Factory Defaults"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Export Profile */}
        <button
          type="button"
          onClick={handleExportClick}
          aria-label="Export Profile"
          className="p-1.5 rounded hover:bg-hover text-slate-300 hover:text-white transition-colors"
          title="Export Profile as JSON"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        {/* Import Profile */}
        <button
          type="button"
          onClick={handleImportClick}
          aria-label="Import Profile"
          className="p-1.5 rounded hover:bg-hover text-slate-300 hover:text-white transition-colors"
          title="Import Profile from JSON"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>

        {/* Delete Profile */}
        <button
          type="button"
          onClick={handleDeleteClick}
          disabled={profiles.length <= 1}
          aria-label="Delete Profile"
          className={`p-1.5 rounded transition-colors ${
            profiles.length <= 1
              ? 'opacity-30 cursor-not-allowed text-slate-600'
              : 'hover:bg-hover text-slate-300 hover:text-brand'
          }`}
          title={profiles.length <= 1 ? 'Cannot delete the only profile' : 'Delete Active Profile'}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
