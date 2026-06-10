import { Point } from '../types/vector';
import { BrushPreset, BrushDynamics, StabilizerSettings } from '../types/brush';

export class BrushEngine {
  private lastPoint: Point | null = null;
  private points: { x: number; y: number; pressure: number }[] = [];
  
  // Stabilizer states
  private lazyX: number = 0;
  private lazyY: number = 0;
  private stabilizedPoints: Point[] = [];
  
  // Smudge buffer
  private smudgeCanvas: HTMLCanvasElement | null = null;
  private smudgeCtx: CanvasRenderingContext2D | null = null;

  constructor() {
    // Initialize offscreen canvas for holding smudge pixel textures
    if (typeof document !== 'undefined') {
      this.smudgeCanvas = document.createElement('canvas');
      this.smudgeCtx = this.smudgeCanvas.getContext('2d');
    }
  }

  public reset() {
    this.lastPoint = null;
    this.points = [];
    this.stabilizedPoints = [];
  }

  /**
   * Applies the selected stabilizer and returns the smoothed point.
   */
  public stabilizePointer(
    rawPt: Point,
    settings: StabilizerSettings,
    isFirst: boolean = false
  ): { pt: Point; leashActive: boolean; leashPt?: Point } {
    if (isFirst) {
      this.lazyX = rawPt.x;
      this.lazyY = rawPt.y;
      return { pt: rawPt, leashActive: false };
    }

    const { type, value, ropeLength } = settings;
    
    if (type === 'none') {
      return { pt: rawPt, leashActive: false };
    }

    if (type === 'lazy-mouse' || type === 'rope') {
      const leash = type === 'rope' ? ropeLength : value * 0.5;
      const dx = rawPt.x - this.lazyX;
      const dy = rawPt.y - this.lazyY;
      const dist = Math.hypot(dx, dy);

      if (dist > leash) {
        // Move the stabilized center towards the cursor
        const angle = Math.atan2(dy, dx);
        this.lazyX = rawPt.x - Math.cos(angle) * leash;
        this.lazyY = rawPt.y - Math.sin(angle) * leash;
        return {
          pt: { x: this.lazyX, y: this.lazyY },
          leashActive: true,
          leashPt: rawPt,
        };
      }
      return {
        pt: { x: this.lazyX, y: this.lazyY },
        leashActive: true,
        leashPt: rawPt,
      };
    }

    if (type === 'basic' || type === 'weighted') {
      // Exponentially weighted average
      const weight = type === 'weighted' ? (100 - value) / 100 : 0.35; // lower means more smoothing
      const lastX = this.lazyX;
      const lastY = this.lazyY;
      
      this.lazyX = lastX + (rawPt.x - lastX) * weight;
      this.lazyY = lastY + (rawPt.y - lastY) * weight;
      
      return { pt: { x: this.lazyX, y: this.lazyY }, leashActive: false };
    }

    return { pt: rawPt, leashActive: false };
  }

  /**
   * Draws a stroke segment on a canvas context, applying dynamics, spacing, and textures.
   */
  public drawStroke(
    ctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    settings: BrushPreset,
    pressure: number = 0.5,
    speed: number = 0,
    sourceCanvasForSmudge?: HTMLCanvasElement // for grabbing smudge colors
  ) {
    const { type, size, opacity, flow, dynamics } = settings;

    ctx.save();
    
    // Set compositing for eraser
    if (type === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    // Determine size and opacity dynamically
    let targetSize = size;
    let targetOpacity = opacity;
    let targetFlow = flow;

    if (dynamics.sizeByPressure) {
      targetSize = size * (0.15 + pressure * 0.85);
    }
    if (dynamics.opacityByPressure) {
      targetOpacity = opacity * (0.1 + pressure * 0.9);
    }
    if (dynamics.flowByPressure) {
      targetFlow = flow * (0.2 + pressure * 0.8);
    }

    // Speed dynamics (shrings brush if moving fast, e.g., standard inking pens)
    if (dynamics.sizeBySpeed) {
      const speedFactor = Math.max(0, Math.min(1, speed / 50));
      targetSize = targetSize * (1 - speedFactor * 0.5);
    }

    const colorHex = ctx.fillStyle as string;
    const r = parseInt(colorHex.slice(1, 3), 16) || 0;
    const g = parseInt(colorHex.slice(3, 5), 16) || 0;
    const b = parseInt(colorHex.slice(5, 7), 16) || 0;

    // Distance and angle between points
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // Stamping interval
    const spacingStep = Math.max(1, targetSize * dynamics.spacing);
    const steps = Math.ceil(distance / spacingStep);

    // Setup smudge buffer if doing smudge tool
    if (type === 'smudge' && sourceCanvasForSmudge && this.smudgeCtx) {
      this.captureSmudgeTexture(sourceCanvasForSmudge, from.x, from.y, targetSize);
    }

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 1 : i / steps;
      let sx = from.x + dx * t;
      let sy = from.y + dy * t;

      // Apply scatter dynamics
      if (dynamics.scatter > 0) {
        const scatterAmt = dynamics.scatter * targetSize * 0.4;
        sx += (Math.random() - 0.5) * scatterAmt;
        sy += (Math.random() - 0.5) * scatterAmt;
      }

      if (type === 'smudge' && this.smudgeCanvas) {
        // Draw captured smudge texture
        ctx.globalAlpha = targetOpacity * targetFlow * (1 - t * 0.3); // fade smudge along stroke segment
        ctx.drawImage(
          this.smudgeCanvas,
          sx - targetSize / 2,
          sy - targetSize / 2,
          targetSize,
          targetSize
        );
      } else if (type === 'pixel') {
        // Hard pixel block (no interpolation blur)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${targetOpacity * targetFlow})`;
        ctx.fillRect(Math.floor(sx - targetSize / 2), Math.floor(sy - targetSize / 2), Math.max(1, Math.round(targetSize)), Math.max(1, Math.round(targetSize)));
      } else {
        // Standard radial brush stamp
        const radius = targetSize / 2;
        if (radius <= 0.5) {
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${targetOpacity * targetFlow})`;
          ctx.fillRect(sx, sy, 1, 1);
          continue;
        }

        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
        const stampAlpha = targetOpacity * targetFlow;
        
        // Hardness mapping: 0 means pure gradient, 1 means hard-edged circle
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${stampAlpha})`);
        grad.addColorStop(dynamics.hardness, `rgba(${r}, ${g}, ${b}, ${stampAlpha})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Captures an image tile under the cursor from the canvas, acting as smudge paint.
   */
  private captureSmudgeTexture(canvas: HTMLCanvasElement, x: number, y: number, size: number) {
    if (!this.smudgeCanvas || !this.smudgeCtx) return;
    
    const sizeInt = Math.max(4, Math.round(size));
    this.smudgeCanvas.width = sizeInt;
    this.smudgeCanvas.height = sizeInt;
    
    this.smudgeCtx.clearRect(0, 0, sizeInt, sizeInt);
    
    // Draw a circular clip to make smudge stamp soft
    this.smudgeCtx.save();
    this.smudgeCtx.beginPath();
    this.smudgeCtx.arc(sizeInt / 2, sizeInt / 2, sizeInt / 2, 0, Math.PI * 2);
    this.smudgeCtx.clip();
    
    // Grab snippet from layer
    this.smudgeCtx.drawImage(
      canvas,
      x - sizeInt / 2,
      y - sizeInt / 2,
      sizeInt,
      sizeInt,
      0,
      0,
      sizeInt,
      sizeInt
    );
    this.smudgeCtx.restore();
  }
}

export const brushEngineInstance = new BrushEngine();
