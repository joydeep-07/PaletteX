import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Plus, Trash2, Settings, ChevronRight, ChevronLeft, Disc } from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import { layerManagerInstance } from '../../canvas-engine/LayerManager';

export const TimelinePanel: React.FC = () => {
  const { documents, activeDocumentId, addLayer, deleteLayer, updateLayer } = useCanvasStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeFrame, setActiveFrame] = useState(0);
  const [frames, setFrames] = useState<string[]>([]); // Array of layer IDs mapped to each frame
  const [fps, setFps] = useState(8);
  const [onionSkin, setOnionSkin] = useState(true);
  const playTimerRef = useRef<any>(null);

  const doc = documents.find((d) => d.id === activeDocumentId);

  // Synchronise frames list with layers
  useEffect(() => {
    if (doc) {
      // Filter out raster layers and treat them as frames
      const rasterLayers = doc.layers.filter((l) => l.type === 'raster').map((l) => l.id);
      setFrames(rasterLayers.reverse()); // Bottommost layer is frame 1
    }
  }, [doc?.layers.length]);

  // Handle Play/Pause
  useEffect(() => {
    if (isPlaying && frames.length > 1) {
      const intervalMs = 1000 / fps;
      playTimerRef.current = setInterval(() => {
        setActiveFrame((prev) => (prev + 1) % frames.length);
      }, intervalMs);
    } else {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    }

    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
      }
    };
  }, [isPlaying, frames.length, fps]);

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-neutral-500 text-center text-xs">
        Animation Timeline requires an active document.
      </div>
    );
  }

  // When active frame changes, update layer visibility so only active frame (layer) is visible
  const handleSelectFrame = (idx: number) => {
    setActiveFrame(idx);
    setIsPlaying(false);

    // Make only the active frame visible, and optionally onion skins visible with opacity
    frames.forEach((layerId, i) => {
      const isCurrent = i === idx;
      const isPrev = i === idx - 1;
      
      if (isCurrent) {
        updateLayer(doc.id, layerId, { visible: true, opacity: 1.0 });
      } else if (onionSkin && isPrev) {
        // Onion Skin: Make previous frame slightly visible
        updateLayer(doc.id, layerId, { visible: true, opacity: 0.3 });
      } else {
        updateLayer(doc.id, layerId, { visible: false });
      }
    });
  };

  const handleAddFrame = () => {
    // Creating a raster layer acts as adding a frame
    const newLayerId = addLayer(doc.id, 'raster', `Frame ${frames.length + 1}`);
    setIsPlaying(false);
    
    // Select the newly added frame
    setTimeout(() => {
      handleSelectFrame(frames.length);
    }, 50);
  };

  const handleDeleteFrame = () => {
    if (frames.length <= 1) return;
    const targetLayerId = frames[activeFrame];
    deleteLayer(doc.id, targetLayerId);
    
    const nextSelect = Math.max(0, activeFrame - 1);
    setTimeout(() => {
      handleSelectFrame(nextSelect);
    }, 50);
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900/80 text-xs text-neutral-300 select-none">
      {/* Control Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-950/20">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              isPlaying ? 'bg-red-500/10 text-red-400 hover:bg-red-500/25' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
            }`}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>
          
          {/* Frame Step controls */}
          <button
            onClick={() => handleSelectFrame((activeFrame - 1 + frames.length) % frames.length)}
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 cursor-pointer"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="font-mono text-[10px] bg-neutral-950 px-2 py-0.5 rounded text-neutral-450 border border-neutral-850">
            Frame {activeFrame + 1} / {frames.length || 1}
          </span>
          <button
            onClick={() => handleSelectFrame((activeFrame + 1) % frames.length)}
            className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 cursor-pointer"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Playback Settings (FPS, Onion Skins) */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-neutral-400 cursor-pointer">
            <input
              type="checkbox"
              checked={onionSkin}
              onChange={(e) => setOnionSkin(e.target.checked)}
              className="accent-blue-500"
            />
            <span>Onion Skin</span>
          </label>

          <div className="flex items-center gap-2">
            <span className="text-neutral-550 font-mono">FPS:</span>
            <input
              type="number"
              min={1}
              max={24}
              value={fps}
              onChange={(e) => setFps(Math.max(1, parseInt(e.target.value) || 1))}
              className="bg-neutral-950 border border-neutral-850 rounded px-1.5 py-0.5 w-12 text-center text-neutral-200 outline-none font-mono"
            />
          </div>

          {/* Add/Remove Frame triggers */}
          <div className="flex items-center border-l border-neutral-800 pl-3 gap-1">
            <button
              onClick={handleAddFrame}
              className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center gap-1 cursor-pointer transition-colors"
              title="Add Frame (Layer)"
            >
              <Plus size={12} />
              Add Frame
            </button>
            <button
              disabled={frames.length <= 1}
              onClick={handleDeleteFrame}
              className="p-1.5 hover:bg-neutral-800 hover:text-red-400 text-neutral-500 disabled:opacity-30 rounded cursor-pointer transition-colors"
              title="Delete Frame"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Frame Cells list */}
      <div className="flex-1 overflow-x-auto p-3 bg-neutral-950/40 flex items-center gap-1 scrollbar-thin">
        {frames.length === 0 ? (
          <div className="text-neutral-600 italic text-[11px] text-center w-full">
            No frames found. Create a raster drawing layer to populate frames.
          </div>
        ) : (
          frames.map((layerId, idx) => {
            const isCurrent = idx === activeFrame;
            return (
              <button
                key={layerId}
                onClick={() => handleSelectFrame(idx)}
                className={`relative w-12 aspect-square rounded flex flex-col items-center justify-center border font-mono transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-md'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-750 hover:text-neutral-400'
                }`}
              >
                {/* Visual marker inside frame */}
                <Disc size={14} className={isCurrent ? 'animate-pulse text-blue-400' : 'text-neutral-600'} />
                <span className="text-[9px] mt-1">F{idx + 1}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
