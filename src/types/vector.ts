export type ShapeType =
  | 'line'
  | 'rectangle'
  | 'square'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'rhombus'
  | 'polygon'
  | 'star'
  | 'arrow';

export interface Point {
  x: number;
  y: number;
}

export interface AnchorPoint {
  id: string;
  point: Point;
  handleIn: Point | null; // control handle inward
  handleOut: Point | null; // control handle outward
  type: 'corner' | 'smooth' | 'symmetric';
}

export interface VectorPath {
  id: string;
  anchors: AnchorPoint[];
  closed: boolean;
  stroke: string;
  strokeWidth: number;
  fill: string | null;
}

export interface VectorShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  fill: string | null;
  points?: number; // for polygon/star (e.g. 5-point star)
  cornerRadius?: number; // for rounded rect
}

export interface VectorElement {
  id: string;
  type: 'path' | 'shape';
  path?: VectorPath;
  shape?: VectorShape;
}
