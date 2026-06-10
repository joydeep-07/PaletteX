import { Point, AnchorPoint, VectorPath, VectorShape, VectorElement } from '../types/vector';

export class VectorSystem {
  constructor() {}

  /**
   * Draws a complete VectorElement (either Path or Shape) onto a canvas context.
   */
  public drawElement(ctx: CanvasRenderingContext2D, element: VectorElement) {
    ctx.save();
    
    if (element.type === 'path' && element.path) {
      this.drawPath(ctx, element.path);
    } else if (element.type === 'shape' && element.shape) {
      this.drawShape(ctx, element.shape);
    }
    
    ctx.restore();
  }

  /**
   * Draws a pen bezier path.
   */
  private drawPath(ctx: CanvasRenderingContext2D, path: VectorPath) {
    if (path.anchors.length === 0) return;

    ctx.beginPath();
    const start = path.anchors[0];
    ctx.moveTo(start.point.x, start.point.y);

    for (let i = 0; i < path.anchors.length - 1; i++) {
      const current = path.anchors[i];
      const next = path.anchors[i + 1];
      
      const cp1 = current.handleOut || current.point;
      const cp2 = next.handleIn || next.point;
      
      ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, next.point.x, next.point.y);
    }

    if (path.closed && path.anchors.length > 2) {
      const last = path.anchors[path.anchors.length - 1];
      const cp1 = last.handleOut || last.point;
      const cp2 = start.handleIn || start.point;
      ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, start.point.x, start.point.y);
      ctx.closePath();
    }

    // Apply fill and stroke properties
    if (path.fill) {
      ctx.fillStyle = path.fill;
      ctx.fill();
    }
    ctx.strokeStyle = path.stroke;
    ctx.lineWidth = path.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  /**
   * Draws vector shapes like polygon, stars, arrows, rounded rects.
   */
  private drawShape(ctx: CanvasRenderingContext2D, shape: VectorShape) {
    const { x, y, width, height, stroke, strokeWidth, fill, type, points, cornerRadius } = shape;
    
    ctx.beginPath();
    
    if (type === 'rectangle') {
      const radius = cornerRadius || 0;
      if (radius > 0) {
        ctx.roundRect(x, y, width, height, radius);
      } else {
        ctx.rect(x, y, width, height);
      }
    } else if (type === 'circle' || type === 'ellipse') {
      const rx = Math.abs(width / 2);
      const ry = Math.abs(height / 2);
      ctx.ellipse(x + rx, y + ry, rx, ry, 0, 0, Math.PI * 2);
    } else if (type === 'polygon') {
      const numPts = points || 5;
      const rx = width / 2;
      const ry = height / 2;
      const cx = x + rx;
      const cy = y + ry;
      
      for (let i = 0; i < numPts; i++) {
        const angle = (i * Math.PI * 2) / numPts - Math.PI / 2;
        const px = cx + Math.cos(angle) * rx;
        const py = cy + Math.sin(angle) * ry;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (type === 'star') {
      const numSpikes = points || 5;
      const rxOuter = width / 2;
      const rxInner = rxOuter * 0.4;
      const ryOuter = height / 2;
      const ryInner = ryOuter * 0.4;
      const cx = x + rxOuter;
      const cy = y + ryOuter;
      
      let angle = -Math.PI / 2;
      const step = Math.PI / numSpikes;

      ctx.moveTo(cx + Math.cos(angle) * rxOuter, cy + Math.sin(angle) * ryOuter);
      
      for (let i = 0; i < numSpikes; i++) {
        // inner spike point
        angle += step;
        ctx.lineTo(cx + Math.cos(angle) * rxInner, cy + Math.sin(angle) * ryInner);
        // outer spike point
        angle += step;
        ctx.lineTo(cx + Math.cos(angle) * rxOuter, cy + Math.sin(angle) * ryOuter);
      }
      ctx.closePath();
    } else if (type === 'arrow') {
      const rx = width;
      const ry = height;
      const shaftWidth = ry * 0.4;
      const headWidth = ry * 0.8;
      const headLength = rx * 0.35;
      
      // Draw arrow polygon pointing right
      ctx.moveTo(x, y + (ry - shaftWidth) / 2);
      ctx.lineTo(x + rx - headLength, y + (ry - shaftWidth) / 2);
      ctx.lineTo(x + rx - headLength, y + (ry - headWidth) / 2);
      ctx.lineTo(x + rx, y + ry / 2);
      ctx.lineTo(x + rx - headLength, y + (ry + headWidth) / 2);
      ctx.lineTo(x + rx - headLength, y + (ry + shaftWidth) / 2);
      ctx.lineTo(x, y + (ry + shaftWidth) / 2);
      ctx.closePath();
    }

    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }

  /**
   * Draws visual editing gizmos (anchors, handle bars) for selected pen path.
   */
  public drawPathGizmos(
    ctx: CanvasRenderingContext2D,
    path: VectorPath,
    matrix: DOMMatrix,
    selectedAnchorId: string | null
  ) {
    ctx.save();
    ctx.setTransform(matrix);

    const anchorSize = 6 / matrix.a; // constant screen size
    const handleSize = 4 / matrix.a;

    path.anchors.forEach((anchor) => {
      const isSelected = anchor.id === selectedAnchorId;

      // Draw lines to control handles
      if (anchor.handleIn) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1 / matrix.a;
        ctx.beginPath();
        ctx.moveTo(anchor.point.x, anchor.point.y);
        ctx.lineTo(anchor.handleIn.x, anchor.handleIn.y);
        ctx.stroke();

        // Handle circle
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(anchor.handleIn.x, anchor.handleIn.y, handleSize, 0, Math.PI * 2);
        ctx.fill();
      }

      if (anchor.handleOut) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1 / matrix.a;
        ctx.beginPath();
        ctx.moveTo(anchor.point.x, anchor.point.y);
        ctx.lineTo(anchor.handleOut.x, anchor.handleOut.y);
        ctx.stroke();

        // Handle circle
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(anchor.handleOut.x, anchor.handleOut.y, handleSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw anchor node box
      ctx.fillStyle = isSelected ? '#3b82f6' : '#ffffff';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5 / matrix.a;
      
      ctx.fillRect(
        anchor.point.x - anchorSize,
        anchor.point.y - anchorSize,
        anchorSize * 2,
        anchorSize * 2
      );
      ctx.strokeRect(
        anchor.point.x - anchorSize,
        anchor.point.y - anchorSize,
        anchorSize * 2,
        anchorSize * 2
      );
    });

    ctx.restore();
  }
}

export const vectorSystemInstance = new VectorSystem();
