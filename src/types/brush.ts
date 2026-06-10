export type BrushType =
  | 'pencil'
  | 'ink'
  | 'marker'
  | 'airbrush'
  | 'watercolor'
  | 'oil'
  | 'chalk'
  | 'charcoal'
  | 'pixel'
  | 'smudge'
  | 'mixer'
  | 'texture'
  | 'eraser';

export type StabilizerType = 'none' | 'basic' | 'lazy-mouse' | 'rope' | 'weighted';

export interface BrushDynamics {
  sizeByPressure: boolean;
  opacityByPressure: boolean;
  flowByPressure: boolean;
  sizeBySpeed: boolean;
  opacityBySpeed: boolean;
  scatter: number; // 0 to 10
  spacing: number; // brush spacing percentage (e.g. 0.05 - 1.0)
  hardness: number; // brush edge hardness (0 to 1)
  textureName?: string; // custom brush texture
}

export interface StabilizerSettings {
  type: StabilizerType;
  value: number; // smoothing strength (0 to 100)
  ropeLength: number; // leash radius in pixels for rope stabilizer
}

export interface BrushPreset {
  id: string;
  name: string;
  type: BrushType;
  size: number;
  opacity: number;
  flow: number;
  dynamics: BrushDynamics;
  stabilizer: StabilizerSettings;
}
