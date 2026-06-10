import React from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useUiStore } from '../../store/uiStore';

export const StatusBar: React.FC = () => {
  const { documents, activeDocumentId } = useCanvasStore();
  const { viewport, cursorCoordinates, fps } = useUiStore();

  const doc = documents.find((d) => d.id === activeDocumentId);

  return (
    <div className="h-7 bg-neutral-950 border-t border-neutral-900 px-3 flex items-center justify-between text-[10px] text-neutral-500 select-none z-45 font-mono">
      {/* Coordinates / Dimensions */}
      <div className="flex items-center gap-4">
        {doc ? (
          <>
            <span>
              Canvas: {doc.width} x {doc.height} px
            </span>
            <span className="text-neutral-700">|</span>
            <span>
              Cursor: X: {cursorCoordinates.x} , Y: {cursorCoordinates.y}
            </span>
          </>
        ) : (
          <span>No Document Loaded</span>
        )}
      </div>

      {/* FPS & Zoom indicators */}
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${fps >= 60 ? 'bg-green-500' : 'bg-amber-500'}`} />
          {fps} FPS
        </span>
        <span className="text-neutral-700">|</span>
        <span>Zoom: {Math.round(viewport.zoom * 100)}%</span>
        <span className="text-neutral-700">|</span>
        <span>Rotate: {Math.round(viewport.rotation)}°</span>
      </div>
    </div>
  );
};
