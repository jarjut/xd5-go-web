import { HardwareSync } from './hardwareSync';
import { createDefaultSettings, exportSettingsToJson, importSettingsFromJson, normalizeKeyBindings } from './settings';
import type { MouseSettings } from '../types/settings';
import type { TimerHandle } from '../types/protocol';

export interface SettingsSnapshot {
  settings: MouseSettings;
  isDirty: boolean;
  isLoadedFromDevice: boolean;
  isReading: boolean;
  isSyncing: boolean;
  error: string | null;
}

/** One connection's draft; revisions never outlive the connection that read them. */
export class SettingsSession {
  private snapshot: SettingsSnapshot;
  private readonly listeners = new Set<() => void>();
  private hardware: HardwareSync | null = null;
  private generation = 0;
  private revision = 0;
  private timer: TimerHandle | undefined;
  private pendingCommitFlash = false;
  private writing: Promise<void> | null = null;
  private writeRequested = false;
  constructor(options?: { settings: MouseSettings }) {
    this.snapshot = {
      settings: options ? importSettingsFromJson(exportSettingsToJson(options.settings)) : createDefaultSettings(),
      isDirty: false,
      isLoadedFromDevice: Boolean(options),
      isReading: false,
      isSyncing: false,
      error: null,
    };
  }

  getSnapshot = (): SettingsSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(updates: Partial<SettingsSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...updates };
    for (const listener of this.listeners) listener();
  }
  private cancelDebounce(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  disconnect = (): void => {
    this.generation++;
    this.hardware?.invalidate();
    this.hardware = null;
    this.cancelDebounce();
    this.writing = null;
    this.writeRequested = false;
    this.revision = 0;
    this.publish({ settings: createDefaultSettings(), isDirty: false, isLoadedFromDevice: false, isReading: false, isSyncing: false, error: null });
  };

  connect = async (hardware: HardwareSync): Promise<void> => {
    this.disconnect();
    this.hardware = hardware;
    await this.readFromDevice();
  };

  readFromDevice = async (): Promise<void> => {
    if (!this.hardware) throw new Error('Mouse is not connected.');
    if (this.snapshot.isReading) return;
    const generation = this.generation;
    const hardware = this.hardware;
    this.cancelDebounce();
    this.writeRequested = false;
    this.publish({ isReading: true, error: null });
    try {
      const settings = await hardware.read();
      if (generation !== this.generation) return;
      this.revision++;
      this.publish({ settings, isDirty: false, isLoadedFromDevice: true, error: null });
    } catch (error) {
      if (generation !== this.generation) return;
      this.publish({ error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      if (generation === this.generation) this.publish({ isReading: false });
    }
  };

  updateSettings = (updates: Partial<MouseSettings>): void => {
    if (!this.snapshot.isLoadedFromDevice || this.snapshot.isReading) return;
    const previous = this.snapshot.settings;
    const settings = {
      ...previous,
      ...updates,
      dpiStages: updates.dpiStages ? updates.dpiStages.map((stage) => ({ ...stage })) : previous.dpiStages,
      lighting: updates.lighting ? { ...previous.lighting, ...updates.lighting } : previous.lighting,
      keys: updates.keys ? normalizeKeyBindings({ ...previous.keys, ...updates.keys }) : previous.keys,
    };
    this.revision++;
    this.publish({ settings, isDirty: true, error: null });
    this.cancelDebounce();
    if (this.hardware) {
      this.timer = setTimeout(() => {
        this.timer = undefined;
        void this.applyToDevice().catch(() => {});
      }, 150);
    }
  };

  resetToDefaults = (): void => {
    if (!this.snapshot.isLoadedFromDevice || this.snapshot.isReading) return;
    this.pendingCommitFlash = true;
    this.updateSettings(createDefaultSettings());
  };

  applyToDevice = (): Promise<void> => {
    if (!this.hardware || !this.snapshot.isLoadedFromDevice || this.snapshot.isReading) {
      return Promise.reject(new Error('Connect and read the mouse before applying settings.'));
    }
    this.cancelDebounce();
    if (!this.snapshot.isDirty) return Promise.resolve();
    this.writeRequested = true;
    if (this.writing) return this.writing;
    const generation = this.generation;
    const hardware = this.hardware;
    this.publish({ isSyncing: true, error: null });
    const writing = (async () => {
      try {
        while (this.writeRequested && generation === this.generation && this.snapshot.isLoadedFromDevice && this.snapshot.isDirty) {
          this.writeRequested = false;
          const revision = this.revision;
          const settings = this.snapshot.settings;
          const shouldCommit = this.pendingCommitFlash;
          this.pendingCommitFlash = false;
          await hardware.write(settings, shouldCommit);
          // Only the exact committed revision becomes clean.
          if (revision === this.revision) this.publish({ isDirty: false, error: null });
        }
      } catch (error) {
        if (generation !== this.generation) return;
        this.writeRequested = false;
        this.publish({ error: error instanceof Error ? error.message : String(error) });
        throw error;
      } finally {
        if (generation === this.generation) {
          this.writing = null;
          this.publish({ isSyncing: false });
        }
      }
    })();
    this.writing = writing;
    return writing;
  };

  receiveDpiStage = (stage: number): void => {
    if (!this.snapshot.isLoadedFromDevice || !Number.isInteger(stage) || stage < 1 || stage > 7) return;
    if (this.snapshot.settings.activeDpiStage === stage) return;
    // Hardware-originated updates do not create a write or clear other draft edits.
    this.publish({ settings: { ...this.snapshot.settings, activeDpiStage: stage } });
  };

  exportProfileJson = (): string => {
    if (!this.snapshot.isLoadedFromDevice) throw new Error('Connect and read the mouse before exporting settings.');
    return exportSettingsToJson(this.snapshot.settings);
  };

  importProfileJson = (json: string): boolean => {
    if (!this.snapshot.isLoadedFromDevice || this.snapshot.isReading) return false;
    try {
      this.pendingCommitFlash = true;
      this.updateSettings(importSettingsFromJson(json));
      return true;
    } catch {
      return false;
    }
  };

  markClean = (): void => {
    // Hardware drafts become clean exclusively after their revision commits.
    if (!this.hardware && this.snapshot.isLoadedFromDevice) this.publish({ isDirty: false });
  };
}
