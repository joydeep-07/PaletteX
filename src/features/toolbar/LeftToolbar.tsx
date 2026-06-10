import React from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { CanvasTool } from '../../types/canvas';
import { Paintbrush, Eraser, Move, Scissors, PenTool, Type, Pipette, Hand, Sparkles } from 'lucide-react';

interface ToolItem {
  id: CanvasTool;
  icon: React.ReactNode;
  label: string;
  hotkey: string;
}

export const LeftToolbar: React.FC = () => {
  const { activeTool, setActiveTool } = useCanvasStore();

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

  return (
    <div className="w-12 bg-neutral-950 border-r border-neutral-900 flex flex-col items-center py-4 gap-2 z-40 text-neutral-400 select-none">
      {TOOLS.map((t) => {
        const isActive = activeTool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setActiveTool(t.id)}
            className={`w-8 h-8 rounded flex items-center justify-center transition-all cursor-pointer relative group ${
              isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'hover:bg-neutral-900 hover:text-neutral-200'
            }`}
            title={`${t.label} (${t.hotkey})`}
          >
            {t.icon}
            
            {/* Tooltip */}
            <div className="absolute left-11 bg-neutral-900 border border-neutral-800 px-2 py-1 rounded text-[10px] text-neutral-300 font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all ml-1 z-50">
              {t.label} <span className="text-neutral-500 ml-1">({t.hotkey})</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
