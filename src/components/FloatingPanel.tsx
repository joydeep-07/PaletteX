import React, { useRef } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Minus, Square, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useUiStore, FloatingPanelConfig } from '../store/uiStore';

interface FloatingPanelProps {
  panel: FloatingPanelConfig;
  children: React.ReactNode;
}

export const FloatingPanel: React.FC<FloatingPanelProps> = ({ panel, children }) => {
  const { togglePanel, updatePanelPosition, updatePanelSize, togglePanelCollapsed } = useUiStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  if (!panel.visible) return null;

  // Handle manual drag completion to persist coordinates
const handleDragEnd = (_event: any, info: any) => {
  updatePanelPosition(
    panel.id,
    panel.x + info.offset.x,
    panel.y + info.offset.y,
  );
};

  // Resize handler using mouse movements
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startWidth = panel.width;
    const startHeight = panel.height;
    const startX = e.clientX;
    const startY = e.clientY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const newWidth = Math.max(panel.minWidth || 200, startWidth + dx);
      const newHeight = Math.max(panel.minHeight || 150, startHeight + dy);

      updatePanelSize(panel.id, newWidth, newHeight);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  
  return (
    <motion.div
      ref={panelRef}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={handleDragEnd}
      initial={{ x: panel.x, y: panel.y, opacity: 0, scale: 0.95 }}
      animate={{ x: panel.x, y: panel.y, opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      style={{
        position: "absolute",
        width: panel.width,
        height: panel.collapsed ? "auto" : panel.height,
        zIndex: 50,
      }}
      className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900/90 shadow-2xl backdrop-blur-md overflow-hidden text-neutral-200 select-none"
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-950/40 cursor-grab active:cursor-grabbing text-xs font-semibold tracking-wider text-neutral-400 uppercase select-none"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <span className="truncate">{panel.title}</span>
        <div className="flex items-center gap-1.5 ml-4">
          <button
            onClick={() => togglePanelCollapsed(panel.id)}
            className="p-1 hover:bg-neutral-800 rounded cursor-pointer transition-colors text-neutral-500 hover:text-neutral-300"
          >
            {panel.collapsed ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronUp size={13} />
            )}
          </button>
          <button
            onClick={() => togglePanel(panel.id)}
            className="p-1 hover:bg-neutral-800 rounded cursor-pointer transition-colors text-neutral-500 hover:text-red-400"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Content wrapper */}
      {!panel.collapsed && (
        <div className="flex-1 overflow-y-auto min-h-0 bg-neutral-900/40 relative">
          {children}
        </div>
      )}

      {/* Resize handle (bottom right) */}
      {!panel.collapsed && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5"
          style={{ zIndex: 100 }}
        >
          {/* Diagonal resize marks */}
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            className="text-neutral-600"
          >
            <line
              x1="6"
              y1="0"
              x2="0"
              y2="6"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <line
              x1="6"
              y1="3"
              x2="3"
              y2="6"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </div>
      )}
    </motion.div>
  );
};
