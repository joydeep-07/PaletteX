import React, { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useUiStore } from '../../store/uiStore';
import { engineInstance } from '../../canvas-engine/CanvasEngine';
import { brushEngineInstance } from '../../canvas-engine/BrushEngine';
import { layerManagerInstance } from '../../canvas-engine/LayerManager';
import { selectionSystemInstance } from '../../canvas-engine/SelectionSystem';
import { vectorSystemInstance } from '../../canvas-engine/VectorSystem';
import { collabInstance, Collaborator } from '../../services/collaboration';
import { Point } from '../../types/vector';

export const CanvasViewport: React.FC = () => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeStrokeCanvasRef = useRef<HTMLCanvasElement>(null);

  const { documents, activeDocumentId, activeTool, color, brushSettings, selection, setSelection, setPrimaryColor, addVectorElement, pushHistory, addToColorHistory } = useCanvasStore();
  const { viewport, setViewport, setCursorCoordinates, setFps } = useUiStore();

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [peers, setPeers] = useState<Collaborator[]>([]);
  const [stabilizedLeashPt, setStabilizedLeashPt] = useState<Point | null>(null);

  // Selection/Layer move states
  const [isMovingSelectionPixels, setIsMovingSelectionPixels] = useState(false);
  const [moveStartCanvasPt, setMoveStartCanvasPt] = useState<Point>({ x: 0, y: 0 });
  const [draggedPixelsCanvas, setDraggedPixelsCanvas] = useState<HTMLCanvasElement | null>(null);
  const [draggedPixelsOffset, setDraggedPixelsOffset] = useState<Point>({ x: 0, y: 0 });
  const [originalSelectionPath, setOriginalSelectionPath] = useState<Point[]>([]);

  // Pen Tool editing states
  const [currentPenPath, setCurrentPenPath] = useState<Point[]>([]);

  const doc = documents.find((d) => d.id === activeDocumentId);

  // Subscribe to multiplayer collaboration presence
  useEffect(() => {
    const unsub = collabInstance.onPeersChange((peerList) => {
      setPeers(peerList);
    });
    
    // Sync remote draw triggers
    const unsubDraw = collabInstance.onRemoteDraw((layerId, drawData) => {
      if (!doc) return;
      const targetLayer = layerId === 'active' ? doc.activeLayerId : layerId;
      if (!targetLayer) return;

      const ctx = layerManagerInstance.getContext(targetLayer);
      if (ctx) {
        ctx.fillStyle = drawData.color;
        brushEngineInstance.drawStroke(
          ctx,
          { x: drawData.x - 2, y: drawData.y - 2 },
          { x: drawData.x, y: drawData.y },
          { ...brushSettings, size: drawData.size, type: 'pencil' }
        );
      }
    });

    return () => {
      unsub();
      unsubDraw();
    };
  }, [doc, brushSettings]);

  // Framerate calculation & Main Compositing loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let frameCount = 0;

    const renderLoop = (time: number) => {
      // Calculate FPS
      frameCount++;
      if (time > lastTime + 1000) {
        setFps(Math.round((frameCount * 1000) / (time - lastTime)));
        frameCount = 0;
        lastTime = time;
      }

      const canvas = compositeCanvasRef.current;
      const ctx = canvas?.getContext('2d');

      if (canvas && ctx && doc) {
        // Adjust Canvas drawing buffer size
        if (canvas.width !== viewportRef.current?.clientWidth || canvas.height !== viewportRef.current?.clientHeight) {
          canvas.width = viewportRef.current?.clientWidth || 800;
          canvas.height = viewportRef.current?.clientHeight || 600;
        }

        engineInstance.setDimensions(doc.width, doc.height, canvas.width, canvas.height);
        engineInstance.updateViewport(viewport);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const matrix = engineInstance.getTransformMatrix();

        // 1. Draw backing canvas boundary shadow
        engineInstance.drawCanvasShadow(ctx, matrix);

        // 2. Composite drawing layers onto a temp buffer, then paint it inside viewport coordinates
        // We use an offscreen canvas composite process managed by LayerManager
        layerManagerInstance.resizeLayers(doc.width, doc.height);
        
        // Grab main composite drawing context
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = doc.width;
        offscreenCanvas.height = doc.height;
        const offCtx = offscreenCanvas.getContext('2d')!;

        // Fill background checkerboard
        engineInstance.drawCheckerboard(offCtx, new DOMMatrix());

        // Merge all project layers
        layerManagerInstance.composite(offCtx, doc.layers, doc.width, doc.height);

        // Draw active selection pixels offset overlay if moving
        if (isMovingSelectionPixels && draggedPixelsCanvas) {
          offCtx.save();
          offCtx.drawImage(draggedPixelsCanvas, draggedPixelsOffset.x, draggedPixelsOffset.y);
          offCtx.restore();
        }

        // Draw selection clipping mask overlays if active
        // If selection is active, we clip the main drawing composite
        // Apply transformation matrix to draw layers on screen
        ctx.save();
        ctx.setTransform(matrix);
        ctx.drawImage(offscreenCanvas, 0, 0);
        ctx.restore();

        // 3. Render grid on top (zoomed in grid helper)
        engineInstance.drawGrid(ctx, matrix);

        // 4. Draw vector shapes
        ctx.save();
        ctx.setTransform(matrix);
        doc.vectorElements.forEach((el) => {
          vectorSystemInstance.drawElement(ctx, el);
        });
        ctx.restore();

        // 5. Draw Selection Marquee dashed marching ants
        selectionSystemInstance.drawMarquee(ctx, selection, matrix);

        // 6. Draw stabilizer leash line (if rope is pulling)
        if (activeTool === 'brush' && stabilizedLeashPt) {
          const rawScreen = engineInstance.canvasToScreen(stabilizedLeashPt.x, stabilizedLeashPt.y);
          const lazyScreen = engineInstance.canvasToScreen(
            brushEngineInstance.stabilizePointer(stabilizedLeashPt, brushSettings.stabilizer).pt.x,
            brushEngineInstance.stabilizePointer(stabilizedLeashPt, brushSettings.stabilizer).pt.y
          );
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)'; // stabilized leash line
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(rawScreen.x, rawScreen.y);
          ctx.lineTo(lazyScreen.x, lazyScreen.y);
          ctx.stroke();
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [doc, viewport, selection, activeTool, stabilizedLeashPt, brushSettings]);

  if (!doc) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-neutral-950 text-neutral-500 font-sans p-8 select-none">
        <div className="w-16 h-16 rounded-full border border-dashed border-neutral-800 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 opacity-45 animate-pulse text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-sm font-semibold text-neutral-350 tracking-wider">PaletteX Creative Suite</h2>
        <p className="text-xs text-neutral-600 mt-1.5 max-w-xs text-center">To begin sketching or editing vector files, go to File &gt; New Document in the top toolbar.</p>
      </div>
    );
  }

  // Handle pointer coordinate readouts
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = compositeCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const canvasPt = engineInstance.screenToCanvas(sx, sy);
    setCursorCoordinates(Math.round(canvasPt.x), Math.round(canvasPt.y));
    
    // Update collaboration presence cursor
    collabInstance.updateLocalCursor({ x: Math.round(canvasPt.x), y: Math.round(canvasPt.y) });

    // Handle selection pixel dragging
    if (isMovingSelectionPixels) {
      const dx = canvasPt.x - moveStartCanvasPt.x;
      const dy = canvasPt.y - moveStartCanvasPt.y;
      setDraggedPixelsOffset({ x: dx, y: dy });
      return;
    }

    // Handle viewport Panning
    if (isPanning) {
      const dx = sx - panStart.x;
      const dy = sy - panStart.y;
      setViewport((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }));
      setPanStart({ x: sx, y: sy });
      return;
    }

    // Handle Brush stroke drawing
    if (isDrawing && doc.activeLayerId && !doc.layers.find(l => l.id === doc.activeLayerId)?.locked) {
      const activeLayer = doc.layers.find((l) => l.id === doc.activeLayerId);
      if (activeLayer?.type !== 'raster') return;

      const layerCtx = layerManagerInstance.getContext(doc.activeLayerId);
      if (layerCtx) {
        // Apply pressure settings
        const pressure = e.pressure !== 0 ? e.pressure : 0.5;

        // Pointer Speed calculation
        const speed = Math.hypot(e.movementX, e.movementY);

        // Run point through stabilizer
        const isFirst = brushEngineInstance['lastPoint'] === null;
        const stabilized = brushEngineInstance.stabilizePointer(canvasPt, brushSettings.stabilizer, isFirst);
        
        if (brushSettings.stabilizer.type === 'rope') {
          setStabilizedLeashPt(canvasPt);
        }

        const lastPt = brushEngineInstance['lastPoint'] || stabilized.pt;

        layerCtx.save();
        layerCtx.fillStyle = color.primary;
        
        // Apply selection boundary clipping
        selectionSystemInstance.applySelectionClip(layerCtx, selection);

        brushEngineInstance.drawStroke(
          layerCtx,
          lastPt,
          stabilized.pt,
          brushSettings,
          pressure,
          speed,
          layerManagerInstance.getOrCreateCanvas(doc.activeLayerId, doc.width, doc.height) // for smudger
        );
        layerCtx.restore();

        // Broadcast drawing segment to peers
        collabInstance.broadcastDrawing(doc.activeLayerId, {
          x: stabilized.pt.x,
          y: stabilized.pt.y,
          color: color.primary,
          size: brushSettings.size,
        });

        brushEngineInstance['lastPoint'] = stabilized.pt;
      }
    }

    // Handle Lasso Selection tool
    if (isDrawing && activeTool === 'lasso') {
      setCurrentPenPath((prev) => [...prev, canvasPt]);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Left click or middle mouse click for panning
    if (activeTool === 'hand' || e.button === 1 || e.spaceKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const canvas = compositeCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const canvasPt = engineInstance.screenToCanvas(sx, sy);

    // Move tool logic: Check if moving selection pixels or moving the entire active layer
    if (activeTool === 'move' && doc.activeLayerId) {
      const activeLayer = doc.layers.find((l) => l.id === doc.activeLayerId);
      if (activeLayer?.type === 'raster' && !activeLayer.locked) {
        const layerCanvas = layerManagerInstance.getOrCreateCanvas(doc.activeLayerId, doc.width, doc.height);
        const layerCtx = layerCanvas.getContext('2d')!;

        const floatCanvas = document.createElement('canvas');
        floatCanvas.width = doc.width;
        floatCanvas.height = doc.height;
        const floatCtx = floatCanvas.getContext('2d')!;

        if (selection.isActive && selection.path.length > 0) {
          // 1. Capture selected pixels onto floating overlay
          floatCtx.save();
          floatCtx.beginPath();
          floatCtx.moveTo(selection.path[0].x, selection.path[0].y);
          for (let i = 1; i < selection.path.length; i++) {
            floatCtx.lineTo(selection.path[i].x, selection.path[i].y);
          }
          floatCtx.closePath();
          floatCtx.clip();
          floatCtx.drawImage(layerCanvas, 0, 0);
          floatCtx.restore();

          // 2. Clear selected pixels from source active layer
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

          setIsMovingSelectionPixels(true);
          setMoveStartCanvasPt(canvasPt);
          setDraggedPixelsCanvas(floatCanvas);
          setDraggedPixelsOffset({ x: 0, y: 0 });
          setOriginalSelectionPath(selection.path);
        } else {
          // Move the entire layer canvas content
          floatCtx.drawImage(layerCanvas, 0, 0);
          layerCtx.clearRect(0, 0, doc.width, doc.height);

          setIsMovingSelectionPixels(true);
          setMoveStartCanvasPt(canvasPt);
          setDraggedPixelsCanvas(floatCanvas);
          setDraggedPixelsOffset({ x: 0, y: 0 });
          setOriginalSelectionPath([]); // empty denotes full layer
        }
        return;
      }
    }

    // Eyedropper tool
    if (activeTool === 'eyedropper') {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const pixel = ctx.getImageData(sx, sy, 1, 1).data;
        const hex = '#' + Array.from(pixel.slice(0, 3)).map(x => x.toString(16).padStart(2, '0')).join('');
        setPrimaryColor(hex);
        addToColorHistory(hex);
      }
      return;
    }

    // Vector Pen tool clicks
    if (activeTool === 'pen') {
      const anchorId = 'anc_' + Math.random().toString(36).substring(2, 9);
      const newElement = {
        id: 'vec_' + Math.random().toString(36).substring(2, 9),
        type: 'path' as const,
        path: {
          id: 'path_' + Math.random().toString(36).substring(2, 9),
          anchors: [
            {
              id: anchorId,
              point: canvasPt,
              handleIn: null,
              handleOut: null,
              type: 'corner' as const,
            },
          ],
          closed: false,
          stroke: color.primary,
          strokeWidth: 4,
          fill: null,
        },
      };
      addVectorElement(doc.id, newElement);
      pushHistory(doc.id);
      return;
    }

    // Raster drawing starts
    if (activeTool === 'brush' || activeTool === 'eraser') {
      setIsDrawing(true);
      brushEngineInstance.reset();
      
      const activeLayer = doc.layers.find((l) => l.id === doc.activeLayerId);
      if (activeLayer?.locked) return;

      const layerCtx = layerManagerInstance.getContext(doc.activeLayerId || '');
      if (layerCtx) {
        const stabilized = brushEngineInstance.stabilizePointer(canvasPt, brushSettings.stabilizer, true);
        
        layerCtx.save();
        layerCtx.fillStyle = color.primary;
        selectionSystemInstance.applySelectionClip(layerCtx, selection);

        // Stamp first dot
        brushEngineInstance.drawStroke(
          layerCtx,
          stabilized.pt,
          stabilized.pt,
          brushSettings,
          e.pressure || 0.5,
          0
        );
        layerCtx.restore();

        brushEngineInstance['lastPoint'] = stabilized.pt;
      }
      return;
    }

    // Lasso drawing starts
    if (activeTool === 'lasso') {
      setIsDrawing(true);
      setCurrentPenPath([canvasPt]);
      return;
    }
  };

  const handlePointerUp = () => {
    // If dragging pixels, drop them back onto the layer canvas
    if (isMovingSelectionPixels && draggedPixelsCanvas && doc.activeLayerId) {
      const layerCanvas = layerManagerInstance.getOrCreateCanvas(doc.activeLayerId, doc.width, doc.height);
      const layerCtx = layerCanvas.getContext('2d')!;

      layerCtx.save();
      layerCtx.drawImage(draggedPixelsCanvas, draggedPixelsOffset.x, draggedPixelsOffset.y);
      layerCtx.restore();

      // If moving a selection, translate the selection border in the store as well
      if (originalSelectionPath.length > 0) {
        const shiftedPath = originalSelectionPath.map((pt) => ({
          x: pt.x + draggedPixelsOffset.x,
          y: pt.y + draggedPixelsOffset.y,
        }));
        setSelection({ path: shiftedPath, isActive: true, type: 'lasso' });
      }

      pushHistory(doc.id);

      // Reset move drag state
      setIsMovingSelectionPixels(false);
      setDraggedPixelsCanvas(null);
      setDraggedPixelsOffset({ x: 0, y: 0 });
      setOriginalSelectionPath([]);
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDrawing) {
      setIsDrawing(false);
      setStabilizedLeashPt(null);

      // Commit drawing history snapshot
      if (activeTool === 'brush' || activeTool === 'eraser') {
        pushHistory(doc.id);
      }

      // Finish Lasso path selection
      if (activeTool === 'lasso' && currentPenPath.length > 2) {
        setSelection({
          type: 'lasso',
          path: currentPenPath,
          isActive: true,
        });
        setCurrentPenPath([]);
      }
    }
  };

  return (
    <div
      ref={viewportRef}
      className="flex-1 h-full bg-neutral-950 relative overflow-hidden"
    >
      <canvas
        ref={compositeCanvasRef}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        className="w-full h-full cursor-crosshair absolute inset-0 block select-none touch-none"
      />

      {/* Collaborators Cursors Presence Overlays */}
      {peers.map((peer) => {
        if (!peer.cursor) return null;
        const screenPt = engineInstance.canvasToScreen(peer.cursor.x, peer.cursor.y);
        
        // Only draw cursor if inside viewport bounds
        if (screenPt.x < 0 || screenPt.y < 0 || screenPt.x > (viewportRef.current?.clientWidth || 0) || screenPt.y > (viewportRef.current?.clientHeight || 0)) {
          return null;
        }

        return (
          <div
            key={peer.id}
            style={{
              position: 'absolute',
              left: screenPt.x,
              top: screenPt.y,
              transform: 'translate(-2px, -2px)',
              pointerEvents: 'none',
              zIndex: 100,
            }}
            className="flex items-center gap-1.5 transition-all duration-75"
          >
            {/* Colored arrow cursor */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1 1L5.5 13L7.5 7.5L13 5.5L1 1Z"
                fill={peer.color}
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            
            {/* Tag banner */}
            <div
              style={{ backgroundColor: peer.color }}
              className="text-[9px] px-1.5 py-0.5 rounded text-white font-semibold font-sans shadow shadow-black/30 tracking-wider whitespace-nowrap"
            >
              {peer.name} {peer.isDrawing && '✍️'}
            </div>
          </div>
        );
      })}
    </div>
  );
};
