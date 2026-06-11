import { layerManagerInstance } from '../canvas-engine/LayerManager';
import { vectorSystemInstance } from '../canvas-engine/VectorSystem';
import { CanvasDocument } from '../store/canvasStore';
import { VectorElement } from '../types/vector';

export type ExportFormat = 'png' | 'jpeg' | 'webp';

export interface ExportOptions {
  format: ExportFormat;
  /** When true, PNG/JPEG flatten onto #FFFFFF. Default true for PNG. */
  whiteBackground?: boolean;
  /** JPEG quality 0–1 */
  quality?: number;
}

function drawDocumentContent(
  ctx: CanvasRenderingContext2D,
  doc: CanvasDocument,
  whiteBackground: boolean
) {
  const { width, height } = doc;

  if (whiteBackground) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  layerManagerInstance.composite(ctx, doc.layers, width, height);

  doc.vectorElements.forEach((el: VectorElement) => {
    vectorSystemInstance.drawElement(ctx, el);
  });
}

export function renderDocumentToCanvas(
  doc: CanvasDocument,
  options: Pick<ExportOptions, 'whiteBackground'> = { whiteBackground: true }
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = doc.width;
  canvas.height = doc.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create export canvas context');

  drawDocumentContent(ctx, doc, options.whiteBackground ?? true);
  return canvas;
}

export function exportDocument(doc: CanvasDocument, options: ExportOptions): void {
  const whiteBackground =
    options.whiteBackground ?? (options.format === 'png' || options.format === 'jpeg');

  const exportCanvas = renderDocumentToCanvas(doc, { whiteBackground });
  const quality = options.quality ?? 0.92;

  let mimeType: string;
  let extension: string;

  switch (options.format) {
    case 'jpeg':
      mimeType = 'image/jpeg';
      extension = 'jpg';
      break;
    case 'webp':
      mimeType = 'image/webp';
      extension = 'webp';
      break;
    default:
      mimeType = 'image/png';
      extension = 'png';
      break;
  }

  const dataUrl = exportCanvas.toDataURL(mimeType, quality);
  const link = document.createElement('a');
  link.download = `${doc.name || 'artwork'}.${extension}`;
  link.href = dataUrl;
  link.click();
}

export function exportDocumentAsPng(
  doc: CanvasDocument,
  whiteBackground = true
): void {
  exportDocument(doc, { format: 'png', whiteBackground });
}
