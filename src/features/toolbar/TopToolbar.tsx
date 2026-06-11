import React, { useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useUiStore } from '../../store/uiStore';
import { layerManagerInstance } from '../../canvas-engine/LayerManager';
import { saveProjectToDb } from '../../services/db';
import { collabInstance } from '../../services/collaboration';
import { Undo2, Redo2, Plus, Download, Users, Sliders, Play, Settings, Sparkles, Folder, Palette, Paintbrush, Layers } from 'lucide-react';

export const TopToolbar: React.FC = () => {
  const { documents, activeDocumentId, addDocument, closeDocument, setActiveDocument, undo, redo, clearSelection, color } = useCanvasStore();
  const { viewport, setViewport, resetViewport, togglePanel, floatingPanels } = useUiStore();

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [collabRoom, setCollabRoom] = useState<string>('');
  const [showCollabDialog, setShowCollabDialog] = useState(false);
  const [showNewDocDialog, setShowNewDocDialog] = useState(false);
  const [docName, setDocName] = useState('Untitled Artwork');
  const [docWidth, setDocWidth] = useState(1920);
  const [docHeight, setDocHeight] = useState(1080);

  const doc = documents.find((d) => d.id === activeDocumentId);

  const isPanelVisible = (id: string) => floatingPanels.find((p) => p.id === id)?.visible ?? false;

  // File Exporter
  const handleExport = (format: 'png' | 'jpeg') => {
    if (!doc) return;
    
    // Create viewport size canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = doc.width;
    exportCanvas.height = doc.height;
    const ctx = exportCanvas.getContext('2d')!;

    // Composite all layers onto exporter canvas
    layerManagerInstance.composite(ctx, doc.layers, doc.width, doc.height);

    const dataUrl = exportCanvas.toDataURL(`image/${format}`);
    const link = document.createElement('a');
    link.download = `${doc.name || 'artwork'}.${format}`;
    link.href = dataUrl;
    link.click();
  };

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    const id = addDocument(docName, docWidth, docHeight);
    setShowNewDocDialog(false);
  };

  const handleConnectCollab = (e: React.FormEvent) => {
    e.preventDefault();
    if (collabRoom.trim()) {
      collabInstance.connect(collabRoom.trim());
      setShowCollabDialog(false);
    }
  };

  return (
    <div className="h-11 bg-neutral-950 border-b border-neutral-900 px-3 flex items-center justify-between text-xs text-neutral-300 select-none z-50">
      {/* App Logo & Dropdowns */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-1.5 mr-2">
          <div className="w-5 h-5 rounded bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-[10px]">
            X
          </div>
          <span className="font-bold tracking-wider text-neutral-200">PaletteX</span>
        </div>

        {/* File / Edit / View / Export triggers */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNewDocDialog(true)}
            className="px-2.5 py-1.5 hover:bg-neutral-900 rounded transition-colors flex items-center gap-1 font-medium cursor-pointer"
          >
            <Plus size={12} />
            New
          </button>

          {doc && (
            <>
              {/* Undo / Redo */}
              <button
                onClick={() => undo(doc.id)}
                disabled={doc.historyIndex <= 0}
                className="p-1.5 hover:bg-neutral-900 rounded disabled:opacity-30 transition-colors cursor-pointer"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={13} />
              </button>
              <button
                onClick={() => redo(doc.id)}
                disabled={doc.historyIndex >= doc.historyLength - 1}
                className="p-1.5 hover:bg-neutral-900 rounded disabled:opacity-30 transition-colors cursor-pointer"
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 size={13} />
              </button>

              {/* View options */}
              <button
                onClick={() => setViewport((prev) => ({ zoom: prev.zoom * 1.25 }))}
                className="px-2 py-1.5 hover:bg-neutral-900 rounded transition-colors font-medium cursor-pointer"
              >
                Zoom In
              </button>
              <button
                onClick={() => setViewport((prev) => ({ zoom: prev.zoom * 0.8 }))}
                className="px-2 py-1.5 hover:bg-neutral-900 rounded transition-colors font-medium cursor-pointer"
              >
                Zoom Out
              </button>
              <button
                onClick={resetViewport}
                className="px-2 py-1.5 hover:bg-neutral-900 rounded transition-colors font-medium cursor-pointer text-neutral-500 hover:text-neutral-300"
              >
                Reset View
              </button>

              {/* Exports */}
              <div className="h-4 w-px bg-neutral-800 mx-1.5" />
              <button
                onClick={() => handleExport('png')}
                className="px-2.5 py-1.5 hover:bg-neutral-900 rounded text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
              >
                <Download size={12} />
                Export PNG
              </button>
            </>
          )}
        </div>
      </div>

      {/* Center Tabs: Documents */}
      {documents.length > 0 && (
        <div className="flex items-center gap-1 max-w-[40%] overflow-x-auto scrollbar-none">
          {documents.map((d) => {
            const isActive = d.id === activeDocumentId;
            return (
              <div
                key={d.id}
                onClick={() => setActiveDocument(d.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md cursor-pointer border-t-2 select-none transition-all ${
                  isActive
                    ? 'bg-neutral-900 border-blue-500 text-neutral-150'
                    : 'bg-neutral-950 border-transparent text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <span className="truncate max-w-[80px] font-medium">{d.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDocument(d.id);
                  }}
                  className="p-0.5 hover:bg-neutral-800 rounded text-neutral-600 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Right side panels toggle */}
      <div className="flex items-center gap-2.5">
        {doc && (
          <>
            {/* Collaboration Connect */}
            {/* <button
              onClick={() => setShowCollabDialog(true)}
              className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-850 rounded flex items-center gap-1.5 font-bold transition-colors cursor-pointer text-neutral-300"
            >
              <Users size={12} className="text-emerald-400" />
              Collab
            </button> */}

            {/* Panel Toggles — one button per floating panel */}
            <div className="h-4 w-px bg-neutral-800 mx-1" />
            <button
              onClick={() => togglePanel('color-picker-panel')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isPanelVisible('color-picker-panel')
                  ? 'bg-neutral-800 text-pink-400'
                  : 'hover:bg-neutral-900 text-neutral-500 hover:text-pink-400'
              }`}
              title="Toggle Color Harmonizer"
            >
              <Palette size={13} />
            </button>
            <button
              onClick={() => togglePanel('brush-settings-panel')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isPanelVisible('brush-settings-panel')
                  ? 'bg-neutral-800 text-blue-400'
                  : 'hover:bg-neutral-900 text-neutral-500 hover:text-blue-400'
              }`}
              title="Toggle Brush Dynamix"
            >
              <Paintbrush size={13} />
            </button>
            <button
              onClick={() => togglePanel('layers-panel')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isPanelVisible('layers-panel')
                  ? 'bg-neutral-800 text-emerald-400'
                  : 'hover:bg-neutral-900 text-neutral-500 hover:text-emerald-400'
              }`}
              title="Toggle Layers & Blend Modes"
            >
              <Layers size={13} />
            </button>
            <button
              onClick={() => togglePanel('ai-panel')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isPanelVisible('ai-panel')
                  ? 'bg-neutral-800 text-purple-400'
                  : 'hover:bg-neutral-900 text-neutral-500 hover:text-purple-400'
              }`}
              title="Toggle AI Synthesis Laboratory"
            >
              <Sparkles size={13} />
            </button>
            <button
              onClick={() => togglePanel('timeline-panel')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isPanelVisible('timeline-panel')
                  ? 'bg-neutral-800 text-amber-400'
                  : 'hover:bg-neutral-900 text-neutral-500 hover:text-amber-400'
              }`}
              title="Toggle Animation Timeline"
            >
              <Play size={13} />
            </button>
          </>
        )}
      </div>

      {/* --- Dialogue Modals --- */}
      {/* New Project Dialog */}
      {showNewDocDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in">
          <form
            onSubmit={handleCreateDocument}
            className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 w-80 text-neutral-200 shadow-2xl flex flex-col gap-4"
          >
            <h3 className="font-bold text-sm text-neutral-100 flex items-center gap-1.5">
              <Folder size={14} className="text-blue-500" />
              New Drawing Canvas
            </h3>

            <div className="flex flex-col gap-1">
              <span className="text-neutral-500 text-[10px] uppercase font-semibold">Canvas Name</span>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="bg-neutral-950 border border-neutral-850 rounded p-2 text-neutral-200 outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-neutral-500 text-[10px] uppercase font-semibold">Width (px)</span>
                <input
                  type="number"
                  value={docWidth}
                  onChange={(e) => setDocWidth(parseInt(e.target.value) || 800)}
                  className="bg-neutral-950 border border-neutral-850 rounded p-2 text-neutral-200 outline-none focus:border-blue-500 text-center font-mono"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-neutral-500 text-[10px] uppercase font-semibold">Height (px)</span>
                <input
                  type="number"
                  value={docHeight}
                  onChange={(e) => setDocHeight(parseInt(e.target.value) || 600)}
                  className="bg-neutral-950 border border-neutral-850 rounded p-2 text-neutral-200 outline-none focus:border-blue-500 text-center font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setShowNewDocDialog(false)}
                className="flex-1 py-2 bg-neutral-950 hover:bg-neutral-800 rounded text-neutral-400 font-semibold cursor-pointer border border-neutral-850/50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Collaboration Dialog */}
      {showCollabDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in">
          <form
            onSubmit={handleConnectCollab}
            className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 w-80 text-neutral-200 shadow-2xl flex flex-col gap-4"
          >
            <h3 className="font-bold text-sm text-neutral-100 flex items-center gap-1.5">
              <Users size={14} className="text-emerald-500" />
              Connect to Team Workspace
            </h3>

            <div className="flex flex-col gap-1">
              <span className="text-neutral-500 text-[10px] uppercase font-semibold">Workspace Room ID</span>
              <input
                type="text"
                value={collabRoom}
                onChange={(e) => setCollabRoom(e.target.value)}
                placeholder="e.g. sketching-session-1"
                className="bg-neutral-950 border border-neutral-850 rounded p-2 text-neutral-200 outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setShowCollabDialog(false)}
                className="flex-1 py-2 bg-neutral-950 hover:bg-neutral-800 rounded text-neutral-400 font-semibold cursor-pointer border border-neutral-850/50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-white font-semibold cursor-pointer"
              >
                Connect
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
