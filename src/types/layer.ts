export type LayerType =
  | 'raster'
  | 'vector'
  | 'text'
  | 'group'
  | 'adjustment';

export type BlendMode =
  | 'source-over'    // Normal
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'color-dodge'
  | 'color-burn'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export interface AdjustmentFilter {
  type: 'brightness-contrast' | 'hue-saturation' | 'invert' | 'grayscale' | 'blur' | 'threshold';
  params: {
    brightness?: number; // -100 to 100
    contrast?: number;   // -100 to 100
    hue?: number;        // -180 to 180
    saturation?: number; // -100 to 100
    blur?: number;       // 0 to 50 px
    threshold?: number;  // 0 to 255
  };
}

export interface TextData {
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayerMetadata {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  opacity: number;       // 0 to 1
  blendMode: BlendMode;
  locked: boolean;
  alphaLocked: boolean;
  parentId: string | null; // For hierarchical layer trees
  clipped: boolean;        // true if clipping mask to layer below
  adjustment?: AdjustmentFilter;
  textData?: TextData;
  colorLabel?: string;     // color marker (e.g. 'none', 'red', 'blue')
}
