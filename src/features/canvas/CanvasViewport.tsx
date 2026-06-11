import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useUiStore } from '../../store/uiStore';
import { engineInstance } from '../../canvas-engine/CanvasEngine';
import { brushEngineInstance } from '../../canvas-engine/BrushEngine';
import { layerManagerInstance } from '../../canvas-engine/LayerManager';
import { selectionSystemInstance } from '../../canvas-engine/SelectionSystem';
import { vectorSystemInstance } from '../../canvas-engine/VectorSystem';
import { Point } from '../../types/vector';
import { ViewportState } from '../../types/canvas';

export const CanvasViewport: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);

  const {
    documents,
    activeDocumentId,
    activeTool,
    activeShapeType,
    color,
    brushSettings,
    selection,
    setSelection,
    setPrimaryColor,
    addVectorElement,
    pushHistory,
    addToColorHistory,
  } = useCanvasStore();
  const { viewport, setViewport, setCursorCoordinates, setFps, isSpaceHeld } = useUiStore();

  const viewportStateRef = useRef(viewport);
  viewportStateRef.current = viewport;
  const isSpaceHeldRef = useRef(isSpaceHeld);
  isSpaceHeldRef.current = isSpaceHeld;

  const activePointersRef = useRef(new Map<number, Point>());
  const pinchGestureRef = useRef<{ startDistance: number; startZoom: number } | null>(null);
  const isPinchingRef = useRef(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [stabilizedLeashPt, setStabilizedLeashPt] = useState<Point | null>(null);
  const [cursorScreenPos, setCursorScreenPos] = useState<Point | null>(null);

  const [isMovingSelectionPixels, setIsMovingSelectionPixels] = useState(false);
  const [moveStartCanvasPt, setMoveStartCanvasPt] = useState<Point>({ x: 0, y: 0 });
  const [draggedPixelsCanvas, setDraggedPixelsCanvas] = useState<HTMLCanvasElement | null>(null);
  const [draggedPixelsOffset, setDraggedPixelsOffset] = useState<Point>({ x: 0, y: 0 });
  const [originalSelectionPath, setOriginalSelectionPath] = useState<Point[]>([]);

  const [currentPenPath, setCurrentPenPath] = useState<Point[]>([]);
  const [shapeDrag, setShapeDrag] = useState<{ start: Point; end: Point } | null>(null);

  const doc = documents.find((d) => d.id === activeDocumentId);

  const getScreenCoords = useCallback((clientX: number, clientY: number): Point => {
    const canvas = compositeCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const zoomAtScreenPoint = useCallback(
    (screenX: number, screenY: number, zoomFactor: number) => {
      setViewport((prev: ViewportState) => {
        engineInstance.updateViewport(prev);
        const canvasPt = engineInstance.screenToCanvas(screenX, screenY);
        const newZoom = Math.min(64, Math.max(0.01, prev.zoom * zoomFactor));
        engineInstance.updateViewport({ ...prev, zoom: newZoom });
        const screenAfter = engineInstance.canvasToScreen(canvasPt.x, canvasPt.y);
        return {
          zoom: newZoom,
          x: prev.x + (screenX - screenAfter.x),
          y: prev.y + (screenY - screenAfter.y),
        };
      });
    },
    [setViewport]
  );

  const shouldPan = useCallback(
    (tool: typeof activeTool, button: number, spaceHeld: boolean) =>
      tool === 'hand' || button === 1 || spaceHeld,
    []
  );

  const finalizeSelectionMove = useCallback(() => {
    if (!isMovingSelectionPixels || !draggedPixelsCanvas || !doc?.activeLayerId) return;

    const layerCanvas = layerManagerInstance.getOrCreateCanvas(doc.activeLayerId, doc.width, doc.height);
    const layerCtx = layerCanvas.getContext('2d')!;

    layerCtx.save();
    layerCtx.drawImage(draggedPixelsCanvas, draggedPixelsOffset.x, draggedPixelsOffset.y);
    layerCtx.restore();

    if (originalSelectionPath.length > 0) {
      const shiftedPath = originalSelectionPath.map((pt) => ({
        x: pt.x + draggedPixelsOffset.x,
        y: pt.y + draggedPixelsOffset.y,
      }));
      setSelection({ path: shiftedPath, isActive: true, type: 'lasso' });
    }

    pushHistory(doc.id);
    setIsMovingSelectionPixels(false);
    setDraggedPixelsCanvas(null);
    setDraggedPixelsOffset({ x: 0, y: 0 });
    setOriginalSelectionPath([]);
  }, [
    isMovingSelectionPixels,
    draggedPixelsCanvas,
    draggedPixelsOffset,
    originalSelectionPath,
    doc,
    setSelection,
    pushHistory,
  ]);

  const cancelDrawingGestures = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      brushEngineInstance.reset();
      setStabilizedLeashPt(null);
      setCurrentPenPath([]);
      setShapeDrag(null);
    }
    if (isPanning) {
      setIsPanning(false);
    }
    if (isMovingSelectionPixels) {
      finalizeSelectionMove();
    }
  }, [isDrawing, isPanning, isMovingSelectionPixels, finalizeSelectionMove]);

  const beginPinchGesture = useCallback(() => {
    const pointers = activePointersRef.current;
    if (pointers.size !== 2) return;

    const pts = [...pointers.values()];
    const distance = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    if (distance < 4) return;

    cancelDrawingGestures();
    isPinchingRef.current = true;
    pinchGestureRef.current = {
      startDistance: distance,
      startZoom: viewportStateRef.current.zoom,
    };
  }, [cancelDrawingGestures]);

  const updatePinchGesture = useCallback(() => {
    if (!isPinchingRef.current || !pinchGestureRef.current) return;

    const pointers = activePointersRef.current;
    if (pointers.size < 2) return;

    const pts = [...pointers.values()];
    const distance = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const scale = distance / pinchGestureRef.current.startDistance;
    const newZoom = Math.min(64, Math.max(0.01, pinchGestureRef.current.startZoom * scale));

    setViewport((prev: ViewportState) => {
      engineInstance.updateViewport(prev);
      const canvasPt = engineInstance.screenToCanvas(center.x, center.y);
      engineInstance.updateViewport({ ...prev, zoom: newZoom });
      const screenAfter = engineInstance.canvasToScreen(canvasPt.x, canvasPt.y);
      return {
        zoom: newZoom,
        x: prev.x + (center.x - screenAfter.x),
        y: prev.y + (center.y - screenAfter.y),
      };
    });
  }, [setViewport]);

  const endPinchGestureIfNeeded = useCallback(() => {
    if (activePointersRef.current.size < 2) {
      isPinchingRef.current = false;
      pinchGestureRef.current = null;
    }
  }, []);

  // Trackpad / mouse wheel: pinch-zoom (ctrl+wheel) and two-finger pan
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      if (!doc) return;

      const rect = container.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * 0.002);
        zoomAtScreenPoint(sx, sy, factor);
        return;
      }

      if (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        setViewport((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [doc, setViewport, zoomAtScreenPoint]);

  // Main compositing loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let frameCount = 0;

    const renderLoop = (time: number) => {
      frameCount++;
      if (time > lastTime + 1000) {
        setFps(Math.round((frameCount * 1000) / (time - lastTime)));
        frameCount = 0;
        lastTime = time;
      }

      const canvas = compositeCanvasRef.current;
      const ctx = canvas?.getContext('2d');

      if (canvas && ctx && doc) {
        if (
          canvas.width !== containerRef.current?.clientWidth ||
          canvas.height !== containerRef.current?.clientHeight
        ) {
          canvas.width = containerRef.current?.clientWidth || 800;
          canvas.height = containerRef.current?.clientHeight || 600;
        }

        engineInstance.setDimensions(doc.width, doc.height, canvas.width, canvas.height);
        engineInstance.updateViewport(viewport);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const matrix = engineInstance.getTransformMatrix();

        engineInstance.drawCanvasShadow(ctx, matrix);
        layerManagerInstance.resizeLayers(doc.width, doc.height);

        const offscreenCanvas = layerManagerInstance.getCompositeBuffer(doc.width, doc.height);
        const offCtx = offscreenCanvas.getContext('2d')!;

        engineInstance.drawCheckerboard(offCtx, new DOMMatrix());
        layerManagerInstance.composite(offCtx, doc.layers, doc.width, doc.height);

        if (isMovingSelectionPixels && draggedPixelsCanvas) {
          offCtx.save();
          offCtx.drawImage(draggedPixelsCanvas, draggedPixelsOffset.x, draggedPixelsOffset.y);
          offCtx.restore();
        }

        ctx.save();
        ctx.setTransform(matrix);
        ctx.drawImage(offscreenCanvas, 0, 0);
        ctx.restore();

        engineInstance.drawGrid(ctx, matrix);

        ctx.save();
        ctx.setTransform(matrix);
        doc.vectorElements.forEach((el) => {
          vectorSystemInstance.drawElement(ctx, el);
        });

        if (activeTool === 'shape' && shapeDrag) {
          const previewShape = vectorSystemInstance.shapeFromDrag(
            activeShapeType,
            shapeDrag.start,
            shapeDrag.end,
            color.primary,
            3,
            null
          );
          vectorSystemInstance.drawShape(ctx, previewShape);
        }
        ctx.restore();

        selectionSystemInstance.drawMarquee(ctx, selection, matrix);

        if (activeTool === 'brush' && stabilizedLeashPt) {
          const rawScreen = engineInstance.canvasToScreen(stabilizedLeashPt.x, stabilizedLeashPt.y);
          const lazyScreen = engineInstance.canvasToScreen(
            brushEngineInstance.stabilizePointer(stabilizedLeashPt, brushSettings.stabilizer).pt.x,
            brushEngineInstance.stabilizePointer(stabilizedLeashPt, brushSettings.stabilizer).pt.y
          );
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
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
  }, [
    doc,
    viewport,
    selection,
    activeTool,
    activeShapeType,
    shapeDrag,
    color.primary,
    stabilizedLeashPt,
    brushSettings,
    isMovingSelectionPixels,
    draggedPixelsCanvas,
    draggedPixelsOffset,
    setFps,
  ]);

  const eraserScreenSize = brushSettings.size * viewport.zoom;

  const canvasCursorClass =
    activeTool === 'eraser'
      ? 'cursor-none'
      : isSpaceHeld || activeTool === 'hand'
        ? 'cursor-grab'
        : isPanning
          ? 'cursor-grabbing'
          : 'cursor-crosshair';

  if (!doc) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-neutral-950 text-neutral-500 font-sans p-8 select-none">
        <div className="w-16 h-16 rounded-full border border-dashed border-neutral-800 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 opacity-45 animate-pulse text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h2 className="text-sm font-semibold text-neutral-350 tracking-wider">PaletteX Creative Suite</h2>
        <p className="text-xs text-neutral-600 mt-1.5 max-w-xs text-center">
          To begin sketching or editing vector files, go to File &gt; New Document in the top toolbar.
        </p>
      </div>
    );
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPinchingRef.current) return;

    const canvas = compositeCanvasRef.current;
    if (!canvas) return;
    const sx = e.clientX - canvas.getBoundingClientRect().left;
    const sy = e.clientY - canvas.getBoundingClientRect().top;

    setCursorScreenPos({ x: sx, y: sy });

    const canvasPt = engineInstance.screenToCanvas(sx, sy);
    setCursorCoordinates(Math.round(canvasPt.x), Math.round(canvasPt.y));

    if (isMovingSelectionPixels) {
      const dx = canvasPt.x - moveStartCanvasPt.x;
      const dy = canvasPt.y - moveStartCanvasPt.y;
      setDraggedPixelsOffset({ x: dx, y: dy });
      return;
    }

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

    if (isDrawing && doc.activeLayerId && !doc.layers.find((l) => l.id === doc.activeLayerId)?.locked) {
      const activeLayer = doc.layers.find((l) => l.id === doc.activeLayerId);
      if (activeLayer?.type !== 'raster') return;

      const layerCtx = layerManagerInstance.getContext(doc.activeLayerId);
      if (layerCtx) {
        const pressure = e.pressure !== 0 ? e.pressure : 0.5;
        const speed = Math.hypot(e.movementX, e.movementY);
        const isFirst = brushEngineInstance['lastPoint'] === null;
        const stabilized = brushEngineInstance.stabilizePointer(canvasPt, brushSettings.stabilizer, isFirst);

        if (brushSettings.stabilizer.type === 'rope') {
          setStabilizedLeashPt(canvasPt);
        }

        const lastPt = brushEngineInstance['lastPoint'] || stabilized.pt;

        layerCtx.save();
        layerCtx.fillStyle = color.primary;
        selectionSystemInstance.applySelectionClip(layerCtx, selection);

        brushEngineInstance.drawStroke(
          layerCtx,
          lastPt,
          stabilized.pt,
          brushSettings,
          pressure,
          speed,
          layerManagerInstance.getOrCreateCanvas(doc.activeLayerId, doc.width, doc.height)
        );
        layerCtx.restore();

        brushEngineInstance['lastPoint'] = stabilized.pt;
      }
    }

    if (isDrawing && activeTool === 'lasso') {
      setCurrentPenPath((prev) => [...prev, canvasPt]);
    }

    if (isDrawing && activeTool === 'shape' && shapeDrag) {
      setShapeDrag({ start: shapeDrag.start, end: canvasPt });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPinchingRef.current) return;

    const sx = getScreenCoords(e.clientX, e.clientY).x;
    const sy = getScreenCoords(e.clientX, e.clientY).y;

    if (shouldPan(activeTool, e.button, isSpaceHeldRef.current)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: sx, y: sy });
      return;
    }

    const canvas = compositeCanvasRef.current;
    if (!canvas) return;
    const canvasPt = engineInstance.screenToCanvas(sx, sy);

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
          floatCtx.drawImage(layerCanvas, 0, 0);
          layerCtx.clearRect(0, 0, doc.width, doc.height);

          setIsMovingSelectionPixels(true);
          setMoveStartCanvasPt(canvasPt);
          setDraggedPixelsCanvas(floatCanvas);
          setDraggedPixelsOffset({ x: 0, y: 0 });
          setOriginalSelectionPath([]);
        }
        return;
      }
    }

    if (activeTool === 'eyedropper') {
      const offscreenCanvas = layerManagerInstance.getCompositeBuffer(doc.width, doc.height);
      const offCtx = offscreenCanvas.getContext('2d');
      if (offCtx) {
        offCtx.clearRect(0, 0, doc.width, doc.height);
        layerManagerInstance.composite(offCtx, doc.layers, doc.width, doc.height);
        const px = Math.max(0, Math.min(doc.width - 1, Math.floor(canvasPt.x)));
        const py = Math.max(0, Math.min(doc.height - 1, Math.floor(canvasPt.y)));
        const pixel = offCtx.getImageData(px, py, 1, 1).data;
        const hex =
          '#' +
          Array.from(pixel.slice(0, 3))
            .map((x) => x.toString(16).padStart(2, '0'))
            .join('');
        setPrimaryColor(hex);
        addToColorHistory(hex);
      }
      return;
    }

    if (activeTool === 'pen') {
      const anchorId = 'anc_' + Math.random().toString(36).substring(2, 9);
      addVectorElement(doc.id, {
        id: 'vec_' + Math.random().toString(36).substring(2, 9),
        type: 'path',
        path: {
          id: 'path_' + Math.random().toString(36).substring(2, 9),
          anchors: [
            {
              id: anchorId,
              point: canvasPt,
              handleIn: null,
              handleOut: null,
              type: 'corner',
            },
          ],
          closed: false,
          stroke: color.primary,
          strokeWidth: 4,
          fill: null,
        },
      });
      pushHistory(doc.id);
      return;
    }

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

    if (activeTool === 'lasso') {
      setIsDrawing(true);
      setCurrentPenPath([canvasPt]);
      return;
    }

    if (activeTool === 'shape') {
      setIsDrawing(true);
      setShapeDrag({ start: canvasPt, end: canvasPt });
      return;
    }
  };

  const handlePointerUp = () => {
    if (isPinchingRef.current) return;

    if (isMovingSelectionPixels && draggedPixelsCanvas && doc.activeLayerId) {
      const layerCanvas = layerManagerInstance.getOrCreateCanvas(doc.activeLayerId, doc.width, doc.height);
      const layerCtx = layerCanvas.getContext('2d')!;

      layerCtx.save();
      layerCtx.drawImage(draggedPixelsCanvas, draggedPixelsOffset.x, draggedPixelsOffset.y);
      layerCtx.restore();

      if (originalSelectionPath.length > 0) {
        const shiftedPath = originalSelectionPath.map((pt) => ({
          x: pt.x + draggedPixelsOffset.x,
          y: pt.y + draggedPixelsOffset.y,
        }));
        setSelection({ path: shiftedPath, isActive: true, type: 'lasso' });
      }

      pushHistory(doc.id);
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

      if (activeTool === 'brush' || activeTool === 'eraser') {
        pushHistory(doc.id);
      }

      if (activeTool === 'lasso' && currentPenPath.length > 2) {
        setSelection({
          type: 'lasso',
          path: currentPenPath,
          isActive: true,
        });
        setCurrentPenPath([]);
      }

      if (activeTool === 'shape' && shapeDrag && doc) {
        const previewShape = vectorSystemInstance.shapeFromDrag(
          activeShapeType,
          shapeDrag.start,
          shapeDrag.end,
          color.primary,
          3,
          null
        );
        if (Math.abs(previewShape.width) > 2 || Math.abs(previewShape.height) > 2) {
          addVectorElement(doc.id, {
            id: 'vec_' + Math.random().toString(36).substring(2, 9),
            type: 'shape',
            shape: previewShape,
          });
          pushHistory(doc.id);
        }
        setShapeDrag(null);
      }
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const screenPt = getScreenCoords(e.clientX, e.clientY);
    activePointersRef.current.set(e.pointerId, screenPt);

    if (activePointersRef.current.size === 2) {
      beginPinchGesture();
      e.preventDefault();
      return;
    }

    handlePointerDown(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const screenPt = getScreenCoords(e.clientX, e.clientY);
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, screenPt);
    }

    if (isPinchingRef.current && activePointersRef.current.size >= 2) {
      updatePinchGesture();
      return;
    }

    handlePointerMove(e);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    endPinchGestureIfNeeded();

    if (isPinchingRef.current) return;

    handlePointerUp();
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    endPinchGestureIfNeeded();

    if (isPinchingRef.current) return;

    handlePointerUp();
  };

  const onPointerLeave = () => {
    setCursorScreenPos(null);
  };

  return (
    <div ref={containerRef} className="flex-1 h-full bg-neutral-950 relative overflow-hidden">
      <canvas
        ref={compositeCanvasRef}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        className={`w-full h-full absolute inset-0 block select-none touch-none ${canvasCursorClass}`}
      />

      {activeTool === 'eraser' && cursorScreenPos && eraserScreenSize >= 2 && (
        <div
          className="pointer-events-none absolute z-50"
          style={{
            left: cursorScreenPos.x - eraserScreenSize / 2,
            top: cursorScreenPos.y - eraserScreenSize / 2,
            width: eraserScreenSize,
            height: eraserScreenSize,
          }}
        >
          <div
            className="w-full h-full box-border"
            style={{
              border: '1px solid rgba(255,255,255,0.9)',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.85)',
              background: 'rgba(255,255,255,0.06)',
            }}
          />
        </div>
      )}
    </div>
  );
};
