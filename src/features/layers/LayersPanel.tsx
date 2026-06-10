import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, ShieldAlert, Plus, Trash2, Layers, Type, Compass, HelpCircle, ArrowDown } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { BlendMode } from '../../types/layer';

export const LayersPanel: React.FC = () => {
  const { documents, activeDocumentId, addLayer, deleteLayer, updateLayer, reorderLayers, setActiveLayer } = useCanvasStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const doc = documents.find((d) => d.id === activeDocumentId);
  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-neutral-500 text-center text-xs">
        <Layers size={24} className="mb-2 opacity-40 animate-pulse" />
        No active drawing document.
      </div>
    );
  }

  // Double click layer to rename
  const handleStartRename = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleFinishRename = (id: string) => {
    if (editName.trim()) {
      updateLayer(doc.id, id, { name: editName.trim() });
    }
    setEditingId(null);
  };

  // Drag and Drop Layer Index Tracker
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDrop = (e: React.DragEvent, hoverIndex: number) => {
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(dragIndex) && dragIndex !== hoverIndex) {
      reorderLayers(doc.id, dragIndex, hoverIndex);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Standard list of blend modes with user-friendly names
  const BLEND_MODES: { value: BlendMode; label: string }[] = [
    { value: 'source-over', label: 'Normal' },
    { value: 'multiply', label: 'Multiply' },
    { value: 'screen', label: 'Screen' },
    { value: 'overlay', label: 'Overlay' },
    { value: 'soft-light', label: 'Soft Light' },
    { value: 'hard-light', label: 'Hard Light' },
    { value: 'color-dodge', label: 'Color Dodge' },
    { value: 'color-burn', label: 'Color Burn' },
    { value: 'difference', label: 'Difference' },
    { value: 'exclusion', label: 'Exclusion' },
    { value: 'hue', label: 'Hue' },
    { value: 'saturation', label: 'Saturation' },
    { value: 'color', label: 'Color' },
    { value: 'luminosity', label: 'Luminosity' },
  ];

  const activeLayer = doc.layers.find((l) => l.id === doc.activeLayerId);

  return (
    <div className="flex flex-col h-full bg-neutral-900/60 text-xs">
      {/* Blend Mode & Opacity Controllers */}
      {activeLayer && (
        <div className="p-3 border-b border-neutral-800 bg-neutral-950/20 flex flex-col gap-3.5">
          <div className="flex justify-between items-center gap-3">
            <span className="text-neutral-400 font-medium">Blend Mode</span>
            <select
              value={activeLayer.blendMode}
              onChange={(e) => updateLayer(doc.id, activeLayer.id, { blendMode: e.target.value as BlendMode })}
              className="bg-neutral-800 text-neutral-200 border border-neutral-700 px-2 py-1 rounded outline-none w-36"
            >
              {BLEND_MODES.map((bm) => (
                <option key={bm.value} value={bm.value}>
                  {bm.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-neutral-400">
              <span>Opacity</span>
              <span>{Math.round(activeLayer.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={activeLayer.opacity * 100}
              onChange={(e) => updateLayer(doc.id, activeLayer.id, { opacity: parseInt(e.target.value) / 100 })}
              className="w-full accent-blue-500 h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
            />
          </div>

          {/* Quick Lock Toggles */}
          <div className="flex gap-2.5 mt-0.5">
            <button
              onClick={() => updateLayer(doc.id, activeLayer.id, { alphaLocked: !activeLayer.alphaLocked })}
              className={`flex-1 py-1 rounded border text-center font-medium transition-colors ${
                activeLayer.alphaLocked
                  ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                  : 'border-neutral-700 bg-transparent text-neutral-400 hover:border-neutral-600'
              }`}
            >
              Alpha Lock
            </button>
            <button
              onClick={() => updateLayer(doc.id, activeLayer.id, { clipped: !activeLayer.clipped })}
              className={`flex-1 py-1 rounded border text-center font-medium transition-colors ${
                activeLayer.clipped
                  ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                  : 'border-neutral-700 bg-transparent text-neutral-400 hover:border-neutral-600'
              }`}
              title="Clip Layer to Layer Below"
            >
              Clipping Mask
            </button>
          </div>
        </div>
      )}

      {/* Layer List Scroll View */}
      {/* We reverse the layers list in rendering so index 0 (bottommost layer) is drawn at the bottom of the list,
          and index length-1 (topmost layer) appears at the top of the panel, matching Photoshop behavior */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 max-h-[260px] min-h-[120px]">
        {[...doc.layers].reverse().map((layer, reversedIdx) => {
          const actualIdx = doc.layers.length - 1 - reversedIdx;
          const isActive = layer.id === doc.activeLayerId;
          const layerIcon = () => {
            if (layer.type === 'raster') return <Layers size={13} className="text-blue-400" />;
            if (layer.type === 'vector') return <Compass size={13} className="text-emerald-400" />;
            if (layer.type === 'text') return <Type size={13} className="text-amber-400" />;
            return <HelpCircle size={13} className="text-neutral-400" />;
          };

          return (
            <div
              key={layer.id}
              draggable
              onDragStart={(e) => handleDragStart(e, actualIdx)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, actualIdx)}
              onClick={() => setActiveLayer(doc.id, layer.id)}
              className={`flex items-center gap-2 p-2 rounded cursor-pointer border select-none transition-all group ${
                isActive
                  ? "bg-blue-600/15 border-blue-500/20 text-neutral-100 shadow-md shadow-black/20"
                  : "bg-neutral-950/30 border-neutral-800 hover:border-neutral-700 text-neutral-300"
              }`}
            >
              {/* Drag marker */}
              <div className="text-neutral-600 group-hover:text-neutral-400 cursor-ns-resize">
                ⋮
              </div>

              {/* Clipping Indicator */}
              {layer.clipped && (
                <div className="pl-1 text-neutral-500 flex items-center">
                  <ArrowDown size={11} className="mr-0.5" />
                </div>
              )}

              {/* Layer Icon */}
              {layerIcon()}

              {/* Layer Name / Rename input */}
              <div className="flex-1 min-w-0 pr-2">
                {editingId === layer.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleFinishRename(layer.id)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleFinishRename(layer.id)
                    }
                    autoFocus
                    className="bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-neutral-100 w-full outline-none font-sans"
                  />
                ) : (
                  <span
                    onDoubleClick={() =>
                      handleStartRename(layer.id, layer.name)
                    }
                    className="truncate block font-medium tracking-wide"
                  >
                    {layer.name}
                  </span>
                )}
              </div>

              {/* Layer Visibility & Lock */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateLayer(doc.id, layer.id, { locked: !layer.locked });
                  }}
                  className="p-1 hover:bg-neutral-800 rounded transition-colors text-neutral-500 hover:text-neutral-300"
                >
                  {layer.locked ? (
                    <Lock size={12} className="text-amber-500" />
                  ) : (
                    <Unlock size={12} />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateLayer(doc.id, layer.id, { visible: !layer.visible });
                  }}
                  className="p-1 hover:bg-neutral-800 rounded transition-colors text-neutral-500 hover:text-neutral-300"
                >
                  {layer.visible ? (
                    <Eye size={12} />
                  ) : (
                    <EyeOff size={12} className="text-neutral-600" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer controls: Add Layer, Duplicate, Delete */}
      <div className="flex items-center justify-between p-2.5 border-t border-neutral-800 bg-neutral-950/20">
        <button
          onClick={() => addLayer(doc.id, 'raster')}
          className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium rounded transition-colors"
        >
          <Plus size={13} />
          New Layer
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => addLayer(doc.id, 'vector')}
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Create Vector Layer"
          >
            <Compass size={13} />
          </button>
          <button
            onClick={() => addLayer(doc.id, 'text')}
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Create Text Layer"
          >
            <Type size={13} />
          </button>
          <button
            disabled={doc.layers.length <= 1}
            onClick={() => doc.activeLayerId && deleteLayer(doc.id, doc.activeLayerId)}
            className="p-1.5 hover:bg-neutral-850 hover:text-red-400 rounded text-neutral-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Delete Selected Layer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
