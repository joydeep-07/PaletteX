import React, { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { CanvasTool } from '../../types/canvas';
import { ShapeType } from '../../types/vector';
import {
  Paintbrush,
  Eraser,
  Move,
  Scissors,
  PenTool,
  Type,
  Pipette,
  Hand,
  Shapes,
  Minus,
  Square,
  RectangleHorizontal,
  Circle,
  Triangle,
  Diamond,
  Plus,
  ChevronDown,
} from 'lucide-react';

interface ToolItem {
  id: CanvasTool;
  icon: React.ReactNode;
  label: string;
  hotkey: string;
}

const SHAPE_OPTIONS: { type: ShapeType; icon: React.ReactNode; label: string }[] = [
  { type: 'line', icon: <Minus size={14} />, label: 'Line' },
  { type: 'rectangle', icon: <RectangleHorizontal size={14} />, label: 'Rectangle' },
  { type: 'square', icon: <Square size={14} />, label: 'Square' },
  { type: 'circle', icon: <Circle size={14} />, label: 'Circle' },
  { type: 'ellipse', icon: <Circle size={14} className="scale-x-125" />, label: 'Oval' },
  { type: 'triangle', icon: <Triangle size={14} />, label: 'Triangle' },
  { type: 'rhombus', icon: <Diamond size={14} />, label: 'Rhombus' },
];

export const LeftToolbar: React.FC = () => {
  const { activeTool, setActiveTool, activeShapeType, setActiveShapeType, brushSettings, updateBrushSettings } =
    useCanvasStore();
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const shapeMenuRef = useRef<HTMLDivElement>(null);

  const TOOLS: ToolItem[] = [
    { id: 'brush', icon: <Paintbrush size={15} />, label: 'Brush Tool', hotkey: 'B' },
    { id: 'eraser', icon: <Eraser size={15} />, label: 'Eraser Tool', hotkey: 'E' },
    { id: 'move', icon: <Move size={15} />, label: 'Move / Transform', hotkey: 'V' },
    { id: 'lasso', icon: <Scissors size={15} />, label: 'Lasso Selection', hotkey: 'L' },
    { id: 'pen', icon: <PenTool size={15} />, label: 'Bezier Pen Tool', hotkey: 'P' },
    { id: 'text', icon: <Type size={15} />, label: 'Text Tool', hotkey: 'T' },
    { id: 'eyedropper', icon: <Pipette size={15} />, label: 'Eye Dropper', hotkey: 'I' },
    { id: 'hand', icon: <Hand size={15} />, label: 'Hand Pan', hotkey: 'Space' },
  ];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shapeMenuRef.current && !shapeMenuRef.current.contains(e.target as Node)) {
        setShapeMenuOpen(false);
      }
    };
    if (shapeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [shapeMenuOpen]);

  const adjustEraserSize = (delta: number) => {
    const newSize = Math.min(300, Math.max(1, brushSettings.size + delta));
    updateBrushSettings({ size: newSize });
  };

  const activeShapeLabel = SHAPE_OPTIONS.find((s) => s.type === activeShapeType)?.label ?? 'Shape';

  return (
    <div className="w-12 bg-neutral-950 border-r border-neutral-900 flex flex-col items-center py-4 gap-2 z-40 text-neutral-400 select-none">
      {TOOLS.map((t) => {
        const isActive = activeTool === t.id;
        return (
          <React.Fragment key={t.id}>
            <button
              onClick={() => setActiveTool(t.id)}
              className={`w-8 h-8 rounded flex items-center justify-center transition-all cursor-pointer relative group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'hover:bg-neutral-900 hover:text-neutral-200'
              }`}
              title={`${t.label} (${t.hotkey})`}
            >
              {t.icon}

              <div className="absolute left-11 bg-neutral-900 border border-neutral-800 px-2 py-1 rounded text-[10px] text-neutral-300 font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all ml-1 z-50">
                {t.label} <span className="text-neutral-500 ml-1">({t.hotkey})</span>
              </div>
            </button>

            {t.id === 'eraser' && activeTool === 'eraser' && (
              <div className="flex flex-col items-center gap-0.5 -my-1">
                <button
                  onClick={() => adjustEraserSize(4)}
                  className="w-6 h-5 rounded flex items-center justify-center hover:bg-neutral-900 hover:text-neutral-200 transition-colors cursor-pointer"
                  title="Increase eraser size ([)"
                >
                  <Plus size={11} />
                </button>
                <span className="text-[8px] text-neutral-600 font-mono leading-none">
                  {Math.round(brushSettings.size)}
                </span>
                <button
                  onClick={() => adjustEraserSize(-4)}
                  className="w-6 h-5 rounded flex items-center justify-center hover:bg-neutral-900 hover:text-neutral-200 transition-colors cursor-pointer"
                  title="Decrease eraser size (])"
                >
                  <Minus size={11} />
                </button>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Shape tool with picker */}
      <div className="relative" ref={shapeMenuRef}>
        <div className="flex flex-col items-center">
          <button
            onClick={() => {
              setActiveTool('shape');
              setShapeMenuOpen((prev) => !prev);
            }}
            className={`w-8 h-8 rounded flex items-center justify-center transition-all cursor-pointer relative group ${
              activeTool === 'shape'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'hover:bg-neutral-900 hover:text-neutral-200'
            }`}
            title={`Shape Tool — ${activeShapeLabel} (U)`}
          >
            <Shapes size={15} />
            <div className="absolute left-11 bg-neutral-900 border border-neutral-800 px-2 py-1 rounded text-[10px] text-neutral-300 font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all ml-1 z-50">
              Shape Tool <span className="text-neutral-500 ml-1">({activeShapeLabel})</span>
            </div>
          </button>
          <button
            onClick={() => {
              setActiveTool('shape');
              setShapeMenuOpen((prev) => !prev);
            }}
            className="w-8 h-3 flex items-center justify-center text-neutral-600 hover:text-neutral-400 cursor-pointer -mt-0.5"
            title="Choose shape"
          >
            <ChevronDown size={10} />
          </button>
        </div>

        {shapeMenuOpen && (
          <div className="absolute left-11 top-0 bg-neutral-900 border border-neutral-800 rounded-lg p-1.5 grid grid-cols-2 gap-1 z-50 shadow-xl min-w-[140px]">
            {SHAPE_OPTIONS.map((shape) => (
              <button
                key={shape.type}
                onClick={() => {
                  setActiveShapeType(shape.type);
                  setActiveTool('shape');
                  setShapeMenuOpen(false);
                }}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                  activeShapeType === shape.type
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                }`}
              >
                {shape.icon}
                {shape.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
