/**
 * FANTECH Helios Go XD5 - Profile & Hardware Models
 */

export interface DpiStage {
  enabled: boolean;
  x: number;
  y: number;
  color: string;
}

export interface LightingSettings {
  mode: number;
  color: string;
  brightness: number;
  speed: number;
}

export interface KeyMatrix {
  key1: string;
  key2: string;
  key3: string;
  key4: string;
  key5: string;
  key6: string;
  [key: string]: string;
}

export interface Profile {
  id: number;
  name: string;
  profileColor: string;
  accentColor?: string;
  pollingRate: number;
  lod: number;
  debounce: number;
  debounceTime?: number;
  sleepMin: number;
  sleepMinutes?: number;
  ripple: boolean;
  angleSnap: boolean;
  turnOffOnMove: boolean;
  activeDpiStage: number;
  separateXY: boolean;
  dpiStages: DpiStage[];
  lighting: LightingSettings;
  keys: KeyMatrix;
  hwProfileId?: number;
}

export interface ProfileExportPayload {
  app: string;
  version: string;
  exportDate: string;
  profile: Profile;
}
