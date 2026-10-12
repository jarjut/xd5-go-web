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

export interface KeyBindings {
  key1: string;
  key2: string;
  key3: string;
  key4: string;
  key5: string;
  key6: string;
  [key: string]: string;
}

export interface MouseSettings {
  pollingRate: number;
  lod: number;
  debounce: number;
  sleepMin: number;
  ripple: boolean;
  angleSnap: boolean;
  turnOffOnMove: boolean;
  activeDpiStage: number;
  separateXY: boolean;
  dpiStages: DpiStage[];
  lighting: LightingSettings;
  keys: KeyBindings;
}
