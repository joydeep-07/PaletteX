export type CanvasTool =
  | 'brush'
  | 'eraser'
  | 'move'
  | 'marquee'
  | 'lasso'
  | 'magic-wand'
  | 'pen'
  | 'text'
  | 'shape'
  | 'transform'
  | 'eyedropper'
  | 'fill'
  | 'hand'
  | 'zoom';

export interface ViewportState {
  x: number;      // pan offset X
  y: number;      // pan offset Y
  zoom: number;   // zoom ratio (1 = 100%, ranges from 0.01 to 64.0)
  rotation: number; // angle in degrees (0 to 360)
}

export interface DocumentDimensions {
  width: number;
  height: number;
}

export interface SelectionState {
  type: 'none' | 'rectangle' | 'ellipse' | 'lasso' | 'polygon' | 'magic-wand';
  path: { x: number; y: number }[]; // coordinates of selection boundary
  maskData?: Uint8ClampedArray;     // pixel mask for complex wand/color-range select
  feather: number;
  isActive: boolean;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
}
