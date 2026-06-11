import { LayerMetadata } from '../types/layer';

export class LayerManager {
  private canvases: Map<string, HTMLCanvasElement> = new Map();
  private contexts: Map<string, CanvasRenderingContext2D> = new Map();
  
  // Document ID -> Array of snapshots (layerId -> snapshot canvas)
  private historyStacks: Map<string, { [layerId: string]: HTMLCanvasElement }[]> = new Map();

  // Temporary compositing canvases for clipping masks and adjustment layers
  private tempCanvas1: HTMLCanvasElement | null = null;
  private tempCtx1: CanvasRenderingContext2D | null = null;
  private tempCanvas2: HTMLCanvasElement | null = null;
  private tempCtx2: CanvasRenderingContext2D | null = null;
  private compositeBuffer: HTMLCanvasElement | null = null;
  private compositeBufferCtx: CanvasRenderingContext2D | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      this.tempCanvas1 = document.createElement('canvas');
      this.tempCtx1 = this.tempCanvas1.getContext('2d');
      this.tempCanvas2 = document.createElement('canvas');
      this.tempCtx2 = this.tempCanvas2.getContext('2d');
      this.compositeBuffer = document.createElement('canvas');
      this.compositeBufferCtx = this.compositeBuffer.getContext('2d');
    }
  }

  /**
   * Returns a reusable offscreen canvas for viewport compositing (checkerboard + layers).
   */
  public getCompositeBuffer(width: number, height: number): HTMLCanvasElement {
    if (!this.compositeBuffer || !this.compositeBufferCtx) {
      this.compositeBuffer = document.createElement('canvas');
      this.compositeBufferCtx = this.compositeBuffer.getContext('2d');
    }
    if (this.compositeBuffer.width !== width || this.compositeBuffer.height !== height) {
      this.compositeBuffer.width = width;
      this.compositeBuffer.height = height;
    }
    return this.compositeBuffer;
  }

  /**
   * Saves a backup offscreen snapshot of all raster layers for a document.
   */
  public pushHistory(docId: string, layers: LayerMetadata[], width: number, height: number, index: number) {
    let stack = this.historyStacks.get(docId);
    if (!stack) {
      stack = [];
      this.historyStacks.set(docId, stack);
    }

    // Truncate any redo steps
    stack.splice(index);

    const snapshot: { [layerId: string]: HTMLCanvasElement } = {};
    layers.forEach((layer) => {
      if (layer.type === 'raster') {
        const canvas = this.getOrCreateCanvas(layer.id, width, height);
        const backup = document.createElement('canvas');
        backup.width = width;
        backup.height = height;
        backup.getContext('2d')?.drawImage(canvas, 0, 0);
        snapshot[layer.id] = backup;
      }
    });

    stack.push(snapshot);
  }

  /**
   * Restores all raster layers in a document to a specific history index.
   */
  public restoreHistory(docId: string, index: number, width: number, height: number) {
    const stack = this.historyStacks.get(docId);
    if (!stack || index < 0 || index >= stack.length) return;

    const snapshot = stack[index];
    Object.entries(snapshot).forEach(([layerId, backupCanvas]) => {
      const canvas = this.getOrCreateCanvas(layerId, width, height);
      const ctx = this.contexts.get(layerId);
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(backupCanvas, 0, 0);
      }
    });
  }


  public getOrCreateCanvas(layerId: string, width: number, height: number): HTMLCanvasElement {
    let canvas = this.canvases.get(layerId);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d')!;
      // Fill transparent background by default
      ctx.clearRect(0, 0, width, height);
      
      this.canvases.set(layerId, canvas);
      this.contexts.set(layerId, ctx);
    }
    return canvas;
  }

  public getContext(layerId: string): CanvasRenderingContext2D | null {
    return this.contexts.get(layerId) || null;
  }

  public clearLayer(layerId: string) {
    const canvas = this.canvases.get(layerId);
    const ctx = this.contexts.get(layerId);
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  public resizeLayers(width: number, height: number) {
    this.canvases.forEach((canvas, id) => {
      // Create backup
      const backup = document.createElement('canvas');
      backup.width = canvas.width;
      backup.height = canvas.height;
      backup.getContext('2d')?.drawImage(canvas, 0, 0);
      
      // Resize
      canvas.width = width;
      canvas.height = height;
      
      // Draw back
      const ctx = this.contexts.get(id);
      ctx?.clearRect(0, 0, width, height);
      ctx?.drawImage(backup, 0, 0);
    });

    if (this.tempCanvas1 && this.tempCanvas2) {
      this.tempCanvas1.width = width;
      this.tempCanvas1.height = height;
      this.tempCanvas2.width = width;
      this.tempCanvas2.height = height;
    }
  }

  /**
   * Main composition pipeline. Combines all layers onto a destination context.
   */
  public composite(
    destCtx: CanvasRenderingContext2D,
    layers: LayerMetadata[],
    width: number,
    height: number
  ) {
    if (!this.tempCanvas1 || !this.tempCtx1 || !this.tempCanvas2 || !this.tempCtx2) return;

    // Clear destination viewport canvas
    destCtx.clearRect(0, 0, width, height);

    // Initialise temporary canvases if sizes changed
    if (this.tempCanvas1.width !== width || this.tempCanvas1.height !== height) {
      this.tempCanvas1.width = width;
      this.tempCanvas1.height = height;
      this.tempCanvas2.width = width;
      this.tempCanvas2.height = height;
    }

    // Clear temp canvases
    this.tempCtx1.clearRect(0, 0, width, height);
    this.tempCtx2.clearRect(0, 0, width, height);

    // Render bottom-to-top
    // To draw bottom layer first, we loop backwards from the end of the array,
    // assuming index 0 is topmost in UI, index length-1 is bottom.
    // Wait, in canvasStore.ts addLayer, we insert in splice, and index 0 was bottom layer.
    // Let's iterate index 0 up to index length-1. Index 0 is bottom.
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (!layer.visible) continue;

      const layerCanvas = this.getOrCreateCanvas(layer.id, width, height);

      // Handle clipping mask
      if (layer.clipped && i > 0) {
        // This layer (A) is clipped to the layer below it (B).
        // B is already rendered onto tempCtx1 (which holds our current base composite).
        // Let's render layer A onto tempCanvas2.
        this.tempCtx2.clearRect(0, 0, width, height);
        this.tempCtx2.save();
        this.applyLayerFilters(this.tempCtx2, layer);
        this.tempCtx2.globalAlpha = layer.opacity;
        this.tempCtx2.drawImage(layerCanvas, 0, 0);
        this.tempCtx2.restore();

        // Draw Layer A onto the composite using 'source-in' against Layer B
        // Wait, Photoshop clipping: only pixels of A are shown where B is opaque.
        // We can draw B onto a separate canvas, then draw A over it with source-in,
        // then overlay that on the main composite with normal blend mode.
        const prevLayer = layers[i - 1];
        const prevCanvas = this.getOrCreateCanvas(prevLayer.id, width, height);
        
        this.tempCtx2.save();
        this.tempCtx2.globalCompositeOperation = 'destination-in'; // keep A only where B is opaque
        this.tempCtx2.drawImage(prevCanvas, 0, 0);
        this.tempCtx2.restore();

        // Composite tempCanvas2 (clipped A) onto tempCanvas1 (main stack)
        this.tempCtx1.save();
        this.tempCtx1.globalCompositeOperation = layer.blendMode;
        this.tempCtx1.drawImage(this.tempCanvas2, 0, 0);
        this.tempCtx1.restore();
      } else {
        // Normal rendering
        this.tempCtx1.save();
        this.tempCtx1.globalCompositeOperation = layer.blendMode;
        this.tempCtx1.globalAlpha = layer.opacity;
        
        // Apply adjustment filter if it is an adjustment layer
        this.applyLayerFilters(this.tempCtx1, layer);
        
        this.tempCtx1.drawImage(layerCanvas, 0, 0);
        this.tempCtx1.restore();
      }
    }

    // Finally, draw the stacked composite onto the viewport
    destCtx.drawImage(this.tempCanvas1, 0, 0);
  }

  /**
   * Applies adjustment layer filter parameters (brightness, hue-rotate, etc.)
   * to a Canvas context prior to drawing.
   */
  private applyLayerFilters(ctx: CanvasRenderingContext2D, layer: LayerMetadata) {
    if (layer.type === 'adjustment' && layer.adjustment) {
      const { type, params } = layer.adjustment;
      let filterString = '';

      switch (type) {
        case 'brightness-contrast':
          filterString = `brightness(${100 + (params.brightness || 0)}%) contrast(${100 + (params.contrast || 0)}%)`;
          break;
        case 'hue-saturation':
          filterString = `hue-rotate(${params.hue || 0}deg) saturate(${100 + (params.saturation || 0)}%)`;
          break;
        case 'invert':
          filterString = 'invert(100%)';
          break;
        case 'grayscale':
          filterString = 'grayscale(100%)';
          break;
        case 'blur':
          filterString = `blur(${params.blur || 0}px)`;
          break;
        case 'threshold':
          // Canvas doesn't have a direct threshold filter, so we use custom grayscale/contrast filter
          filterString = 'contrast(1000%) grayscale(100%)';
          break;
      }
      ctx.filter = filterString;
    } else {
      ctx.filter = 'none';
    }
  }

  /**
   * Remove cached canvas for deleted layer.
   */
  public deleteCanvas(layerId: string) {
    this.canvases.delete(layerId);
    this.contexts.delete(layerId);
  }
}

export const layerManagerInstance = new LayerManager();
