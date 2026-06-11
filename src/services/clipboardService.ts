import { useCanvasStore } from '../store/canvasStore';
import { layerManagerInstance } from '../canvas-engine/LayerManager';
import { selectionSystemInstance } from '../canvas-engine/SelectionSystem';

/**
 * Clipboard operations for selection regions.
 * Full copy/cut/paste will be expanded in Phase 2 (rectangular selection).
 */
export function copySelectionToClipboard(): boolean {
  const { documents, activeDocumentId, selection, setClipboard } = useCanvasStore.getState();
  const doc = documents.find((d) => d.id === activeDocumentId);
  if (!doc?.activeLayerId || !selection.isActive || selection.path.length < 3) {
    return false;
  }

  const bounds = selectionSystemInstance.getSelectionBounds(selection.path);
  if (!bounds || bounds.width < 1 || bounds.height < 1) return false;

  const layerCanvas = layerManagerInstance.getOrCreateCanvas(
    doc.activeLayerId,
    doc.width,
    doc.height
  );

  const w = Math.ceil(bounds.width);
  const h = Math.ceil(bounds.height);
  const clipCanvas = document.createElement('canvas');
  clipCanvas.width = w;
  clipCanvas.height = h;
  const clipCtx = clipCanvas.getContext('2d');
  if (!clipCtx) return false;

  clipCtx.save();
  clipCtx.beginPath();
  clipCtx.moveTo(selection.path[0].x - bounds.x, selection.path[0].y - bounds.y);
  for (let i = 1; i < selection.path.length; i++) {
    clipCtx.lineTo(selection.path[i].x - bounds.x, selection.path[i].y - bounds.y);
  }
  clipCtx.closePath();
  clipCtx.clip();
  clipCtx.drawImage(layerCanvas, -bounds.x, -bounds.y);
  clipCtx.restore();

  const imageData = clipCtx.getImageData(0, 0, w, h);
  setClipboard({ imageData, width: w, height: h });
  return true;
}

export function cutSelectionToClipboard(): boolean {
  const copied = copySelectionToClipboard();
  if (!copied) return false;

  const { documents, activeDocumentId, selection, pushHistory } = useCanvasStore.getState();
  const doc = documents.find((d) => d.id === activeDocumentId);
  if (!doc?.activeLayerId || !selection.isActive) return false;

  const layerCanvas = layerManagerInstance.getOrCreateCanvas(
    doc.activeLayerId,
    doc.width,
    doc.height
  );
  const layerCtx = layerCanvas.getContext('2d');
  if (!layerCtx) return false;

  layerCtx.save();
  layerCtx.beginPath();
  layerCtx.moveTo(selection.path[0].x, selection.path[0].y);
  for (let i = 1; i < selection.path.length; i++) {
    layerCtx.lineTo(selection.path[i].x, selection.path[i].y);
  }
  layerCtx.closePath();
  layerCtx.clip();
  layerCtx.clearRect(0, 0, doc.width, doc.height);
  layerCtx.restore();

  pushHistory(doc.id);
  return true;
}

export function pasteFromClipboard(): boolean {
  const { documents, activeDocumentId, clipboard, pushHistory } = useCanvasStore.getState();
  const doc = documents.find((d) => d.id === activeDocumentId);
  if (!doc?.activeLayerId || !clipboard) return false;

  const layerCanvas = layerManagerInstance.getOrCreateCanvas(
    doc.activeLayerId,
    doc.width,
    doc.height
  );
  const layerCtx = layerCanvas.getContext('2d');
  if (!layerCtx) return false;

  const pasteCanvas = document.createElement('canvas');
  pasteCanvas.width = clipboard.width;
  pasteCanvas.height = clipboard.height;
  pasteCanvas.getContext('2d')?.putImageData(clipboard.imageData, 0, 0);

  const cx = Math.max(0, Math.floor((doc.width - clipboard.width) / 2));
  const cy = Math.max(0, Math.floor((doc.height - clipboard.height) / 2));
  layerCtx.drawImage(pasteCanvas, cx, cy);

  pushHistory(doc.id);
  return true;
}

export function deleteSelectionPixels(): boolean {
  return cutSelectionToClipboard();
}
