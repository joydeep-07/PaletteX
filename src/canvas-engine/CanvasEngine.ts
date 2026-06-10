import { Point } from '../types/vector';
import { ViewportState, DocumentDimensions } from '../types/canvas';

export class CanvasEngine {
  private viewport: ViewportState = { x: 0, y: 0, zoom: 1.0, rotation: 0 };
  private canvasWidth: number = 800;
  private canvasHeight: number = 600;
  private viewportWidth: number = 800;
  private viewportHeight: number = 600;
  
  constructor() {}

  public updateViewport(viewport: ViewportState) {
    this.viewport = { ...viewport };
  }

  public setDimensions(canvasW: number, canvasH: number, viewportW: number, viewportH: number) {
    this.canvasWidth = canvasW;
    this.canvasHeight = canvasH;
    this.viewportWidth = viewportW;
    this.viewportHeight = viewportH;
  }

  /**
   * Returns a DOMMatrix for the current view state:
   * 1. Translates to viewport center.
   * 2. Applies pan offset.
   * 3. Applies zoom.
   * 4. Applies rotation.
   * 5. Translates back by canvas half-dimensions.
   */
  public getTransformMatrix(): DOMMatrix {
    const matrix = new DOMMatrix();
    
    // 1. Center of viewport
    matrix.translateSelf(this.viewportWidth / 2, this.viewportHeight / 2);
    
    // 2. Pan offset
    matrix.translateSelf(this.viewport.x, this.viewport.y);
    
    // 3. Zoom
    matrix.scaleSelf(this.viewport.zoom, this.viewport.zoom);
    
    // 4. Rotation (degrees to radians)
    matrix.rotateSelf(this.viewport.rotation);
    
    // 5. Offset to top-left of canvas
    matrix.translateSelf(-this.canvasWidth / 2, -this.canvasHeight / 2);
    
    return matrix;
  }

  /**
   * Converts a coordinate from screen/viewport space to canvas drawing space.
   */
  public screenToCanvas(screenX: number, screenY: number): Point {
    const matrix = this.getTransformMatrix();
    const inv = matrix.inverse();
    const pt = new DOMPoint(screenX, screenY);
    const canvasPt = pt.matrixTransform(inv);
    return { x: canvasPt.x, y: canvasPt.y };
  }

  /**
   * Converts a coordinate from canvas drawing space to screen/viewport space.
   */
  public canvasToScreen(canvasX: number, canvasY: number): Point {
    const matrix = this.getTransformMatrix();
    const pt = new DOMPoint(canvasX, canvasY);
    const screenPt = pt.matrixTransform(matrix);
    return { x: screenPt.x, y: screenPt.y };
  }

  /**
   * Utility to draw grid lines on a canvas context.
   */
  public drawGrid(ctx: CanvasRenderingContext2D, matrix: DOMMatrix) {
    const zoom = this.viewport.zoom;
    
    // Only render grid when zoomed in (e.g., zoom >= 400% or 4x)
    if (zoom < 4.0) return;
    
    ctx.save();
    
    // Apply canvas viewport transformation matrix
    ctx.setTransform(matrix);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1 / zoom; // keep lines 1 screen-pixel thick
    
    ctx.beginPath();
    
    // Draw vertical lines
    for (let x = 0; x <= this.canvasWidth; x += 10) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvasHeight);
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= this.canvasHeight; y += 10) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvasWidth, y);
    }
    
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw the canvas boundaries and backing shadow.
   */
  public drawCanvasShadow(ctx: CanvasRenderingContext2D, matrix: DOMMatrix) {
    ctx.save();
    ctx.setTransform(matrix);
    
    // Dark grey background backing
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 30 / this.viewport.zoom;
    ctx.shadowOffsetX = 4 / this.viewport.zoom;
    ctx.shadowOffsetY = 8 / this.viewport.zoom;
    
    ctx.fillStyle = '#1e1e1e'; // Default checkerboard backing
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    
    ctx.restore();
  }

  /**
   * Render checkerboard transparency background.
   */
  public drawCheckerboard(ctx: CanvasRenderingContext2D, matrix: DOMMatrix) {
    ctx.save();
    ctx.setTransform(matrix);
    
    const size = 16;
    const cols = Math.ceil(this.canvasWidth / size);
    const rows = Math.ceil(this.canvasHeight / size);
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#181818' : '#222222';
        ctx.fillRect(c * size, r * size, size, size);
      }
    }
    
    ctx.restore();
  }
}

export const engineInstance = new CanvasEngine();
