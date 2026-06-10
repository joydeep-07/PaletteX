import { Point } from '../types/vector';
import { SelectionState } from '../types/canvas';

export class SelectionSystem {
  private marqueeOffset: number = 0;
  private animFrameId: number | null = null;

  constructor() {}

  /**
   * Performs a flood fill (Magic Wand) on ImageData from a clicked coordinate.
   * Returns a 1D alpha mask (Uint8ClampedArray of size width * height).
   */
  public floodFill(
    imageData: ImageData,
    startX: number,
    startY: number,
    tolerance: number = 32
  ): Uint8ClampedArray {
    const { width, height } = imageData;
    const data = imageData.data;
    const mask = new Uint8ClampedArray(width * height);
    
    const startIdx = (startY * width + startX) * 4;
    const sr = data[startIdx];
    const sg = data[startIdx + 1];
    const sb = data[startIdx + 2];
    const sa = data[startIdx + 3];

    const visited = new Uint8Array(width * height);
    const queue: [number, number][] = [[startX, startY]];
    
    visited[startY * width + startX] = 1;

    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      const idx = (cy * width + cx) * 4;
      const maskIdx = cy * width + cx;

      mask[maskIdx] = 255; // selected

      // 4-directional search
      const dirs = [
        [0, 1], [0, -1], [1, 0], [-1, 0]
      ];

      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (visited[nIdx] === 0) {
            visited[nIdx] = 1;

            const pixelIdx = nIdx * 4;
            const nr = data[pixelIdx];
            const ng = data[pixelIdx + 1];
            const nb = data[pixelIdx + 2];
            const na = data[pixelIdx + 3];

            // Color similarity check
            const colorDist = Math.hypot(nr - sr, ng - sg, nb - sb, na - sa);
            if (colorDist <= tolerance) {
              queue.push([nx, ny]);
            }
          }
        }
      }
    }

    return mask;
  }

  /**
   * Sets up selection clipping mask on the drawing context.
   */
  public applySelectionClip(ctx: CanvasRenderingContext2D, selection: SelectionState) {
    if (!selection.isActive || selection.type === 'none') return;

    if (selection.type === 'magic-wand' && selection.maskData) {
      // For pixel-mask, we will apply composite logic at layer compositing time
      return;
    }

    if (selection.path.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(selection.path[0].x, selection.path[0].y);
    for (let i = 1; i < selection.path.length; i++) {
      ctx.lineTo(selection.path[i].x, selection.path[i].y);
    }
    ctx.closePath();
    ctx.clip();
  }

  /**
   * Draws the animating "marching ants" dashed line selection border.
   */
  public drawMarquee(
    ctx: CanvasRenderingContext2D,
    selection: SelectionState,
    matrix: DOMMatrix
  ) {
    if (!selection.isActive || selection.type === 'none' || selection.path.length < 2) return;

    ctx.save();
    ctx.setTransform(matrix);

    // Increment offset for animation
    this.marqueeOffset = (this.marqueeOffset + 0.25) % 8;

    ctx.beginPath();
    ctx.moveTo(selection.path[0].x, selection.path[0].y);
    for (let i = 1; i < selection.path.length; i++) {
      ctx.lineTo(selection.path[i].x, selection.path[i].y);
    }
    ctx.closePath();

    // 1st stroke: black dashes
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 / matrix.a; // constant screen-space width
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = this.marqueeOffset;
    ctx.stroke();

    // 2nd stroke: white dashes shifted by 4px
    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = this.marqueeOffset + 4;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Returns a bounding rectangle of a path.
   */
  public getSelectionBounds(path: Point[]) {
    if (path.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pt of path) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}

export const selectionSystemInstance = new SelectionSystem();
