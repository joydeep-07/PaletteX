import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CanvasTool, SelectionState, ViewportState } from '../types/canvas';
import { LayerMetadata, LayerType, BlendMode, TextData } from '../types/layer';
import { BrushPreset, BrushType, BrushDynamics, StabilizerSettings } from '../types/brush';
import { VectorElement, ShapeType } from '../types/vector';
import { layerManagerInstance } from '../canvas-engine/LayerManager';

export interface CanvasDocument {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: LayerMetadata[];
  vectorElements: VectorElement[];
  activeLayerId: string | null;
  historyIndex: number;
  historyLength: number;
}

interface CanvasStoreState {
  documents: CanvasDocument[];
  activeDocumentId: string | null;
  activeTool: CanvasTool;
  activeShapeType: ShapeType;
  color: {
    primary: string;
    secondary: string;
  };
  selection: SelectionState;
  brushSettings: BrushPreset;
  brushPresets: BrushPreset[];
  colorHistory: string[];
  clipboard: {
    imageData: ImageData;
    width: number;
    height: number;
  } | null;
}

interface CanvasStoreActions {
  addDocument: (name: string, width: number, height: number) => string;
  closeDocument: (id: string) => void;
  setActiveDocument: (id: string) => void;
  setActiveTool: (tool: CanvasTool) => void;
  setActiveShapeType: (shape: ShapeType) => void;
  
  // Layers
  addLayer: (docId: string, type: LayerType, name?: string) => string;
  deleteLayer: (docId: string, layerId: string) => void;
  updateLayer: (docId: string, layerId: string, updates: Partial<LayerMetadata>) => void;
  reorderLayers: (docId: string, dragIndex: number, hoverIndex: number) => void;
  setActiveLayer: (docId: string, layerId: string | null) => void;
  toggleAlphaLock: (docId: string, layerId: string) => void;
  toggleLayerVisibility: (docId: string, layerId: string) => void;
  toggleLayerLock: (docId: string, layerId: string) => void;

  // Vector elements
  addVectorElement: (docId: string, element: VectorElement) => void;
  updateVectorElement: (docId: string, elementId: string, updates: Partial<VectorElement>) => void;
  removeVectorElement: (docId: string, elementId: string) => void;

  // Selection
  setSelection: (selection: Partial<SelectionState>) => void;
  clearSelection: () => void;

  // Brushes & Color
  setPrimaryColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
  addToColorHistory: (color: string) => void;
  updateBrushSettings: (updates: Partial<BrushPreset>) => void;
  saveBrushPreset: (preset: BrushPreset) => void;
  
  // Clipboard
  setClipboard: (data: CanvasStoreState['clipboard']) => void;

  // History Actions (state index trackers)
  pushHistory: (docId: string) => void;
  undo: (docId: string) => void;
  redo: (docId: string) => void;
  resetHistoryIndex: (docId: string, index: number, length: number) => void;
}


const DEFAULT_BRUSH_PRESETS: BrushPreset[] = [
  {
    id: 'pencil-preset',
    name: 'HB Pencil',
    type: 'pencil',
    size: 4,
    opacity: 0.9,
    flow: 1.0,
    dynamics: {
      sizeByPressure: true,
      opacityByPressure: true,
      flowByPressure: false,
      sizeBySpeed: false,
      opacityBySpeed: false,
      scatter: 0,
      spacing: 0.05,
      hardness: 0.9,
    },
    stabilizer: { type: 'basic', value: 20, ropeLength: 10 },
  },
  {
    id: 'ink-preset',
    name: 'Fine Inker',
    type: 'ink',
    size: 8,
    opacity: 1.0,
    flow: 1.0,
    dynamics: {
      sizeByPressure: true,
      opacityByPressure: false,
      flowByPressure: false,
      sizeBySpeed: true,
      opacityBySpeed: false,
      scatter: 0,
      spacing: 0.02,
      hardness: 0.98,
    },
    stabilizer: { type: 'rope', value: 50, ropeLength: 25 },
  },
  {
    id: 'marker-preset',
    name: 'Chisel Marker',
    type: 'marker',
    size: 20,
    opacity: 0.7,
    flow: 0.8,
    dynamics: {
      sizeByPressure: false,
      opacityByPressure: true,
      flowByPressure: true,
      sizeBySpeed: false,
      opacityBySpeed: true,
      scatter: 0,
      spacing: 0.04,
      hardness: 0.8,
    },
    stabilizer: { type: 'basic', value: 10, ropeLength: 5 },
  },
  {
    id: 'airbrush-preset',
    name: 'Soft Airbrush',
    type: 'airbrush',
    size: 80,
    opacity: 0.5,
    flow: 0.3,
    dynamics: {
      sizeByPressure: false,
      opacityByPressure: true,
      flowByPressure: true,
      sizeBySpeed: false,
      opacityBySpeed: false,
      scatter: 0,
      spacing: 0.08,
      hardness: 0.01,
    },
    stabilizer: { type: 'weighted', value: 30, ropeLength: 15 },
  },
  {
    id: 'smudge-preset',
    name: 'Details Smudger',
    type: 'smudge',
    size: 15,
    opacity: 0.8,
    flow: 0.6,
    dynamics: {
      sizeByPressure: true,
      opacityByPressure: false,
      flowByPressure: true,
      sizeBySpeed: true,
      opacityBySpeed: false,
      scatter: 0.1,
      spacing: 0.05,
      hardness: 0.5,
    },
    stabilizer: { type: 'basic', value: 15, ropeLength: 10 },
  },
  {
    id: 'eraser-preset',
    name: 'Draft Eraser',
    type: 'eraser',
    size: 24,
    opacity: 1.0,
    flow: 1.0,
    dynamics: {
      sizeByPressure: false,
      opacityByPressure: false,
      flowByPressure: false,
      sizeBySpeed: false,
      opacityBySpeed: false,
      scatter: 0,
      spacing: 0.05,
      hardness: 0.85,
    },
    stabilizer: { type: 'none', value: 0, ropeLength: 0 },
  }
];

export const useCanvasStore = create<CanvasStoreState & CanvasStoreActions>()(
  immer((set) => ({
    documents: [],
    activeDocumentId: null,
    activeTool: 'brush',
    activeShapeType: 'rectangle',
    color: {
      primary: '#3b82f6', // Premium Blue
      secondary: '#ffffff',
    },
    selection: {
      type: 'none',
      path: [],
      feather: 0,
      isActive: false,
    },
    brushSettings: DEFAULT_BRUSH_PRESETS[0],
    brushPresets: DEFAULT_BRUSH_PRESETS,
    colorHistory: ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff', '#000000'],
    clipboard: null,

    addDocument: (name, width, height) => {
      const id = 'doc_' + Math.random().toString(36).substring(2, 9);
      const firstLayerId = 'layer_' + Math.random().toString(36).substring(2, 9);
      
      const newDoc: CanvasDocument = {
        id,
        name,
        width,
        height,
        layers: [
          {
            id: firstLayerId,
            name: 'Layer 1',
            type: 'raster',
            visible: true,
            opacity: 1.0,
            blendMode: 'source-over',
            locked: false,
            alphaLocked: false,
            parentId: null,
            clipped: false,
          },
        ],
        vectorElements: [],
        activeLayerId: firstLayerId,
        historyIndex: 0,
        historyLength: 1,
      };

      set((state) => {
        state.documents.push(newDoc);
        state.activeDocumentId = id;
        
        // Push initial blank state snapshot
        layerManagerInstance.pushHistory(id, newDoc.layers, width, height, 0);
      });
      return id;
    },

    closeDocument: (id) => {
      set((state) => {
        const index = state.documents.findIndex((d) => d.id === id);
        if (index !== -1) {
          state.documents.splice(index, 1);
          if (state.activeDocumentId === id) {
            state.activeDocumentId = state.documents.length > 0 ? state.documents[state.documents.length - 1].id : null;
          }
        }
      });
    },

    setActiveDocument: (id) => {
      set((state) => {
        state.activeDocumentId = id;
      });
    },

    setActiveTool: (tool) => {
      set((state) => {
        state.activeTool = tool;
        if (tool === 'eraser') {
          state.brushSettings.type = 'eraser';
        } else if (state.brushSettings.type === 'eraser' && tool === 'brush') {
          state.brushSettings.type = 'pencil';
        }
      });
    },

    setActiveShapeType: (shape) => {
      set((state) => {
        state.activeShapeType = shape;
      });
    },

    // Layers
    addLayer: (docId, type, name) => {
      const id = 'layer_' + Math.random().toString(36).substring(2, 9);
      const layerName = name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${Math.random().toString(36).substring(2, 5)}`;
      
      const newLayer: LayerMetadata = {
        id,
        name: layerName,
        type,
        visible: true,
        opacity: 1.0,
        blendMode: 'source-over',
        locked: false,
        alphaLocked: false,
        parentId: null,
        clipped: false,
      };

      if (type === 'text') {
        newLayer.textData = {
          text: 'Double tap to edit text',
          fontSize: 32,
          fontFamily: 'Inter',
          fill: '#ffffff',
          x: 100,
          y: 100,
          width: 300,
          height: 80,
        };
      }

      set((state) => {
        const doc = state.documents.find((d) => d.id === docId);
        if (doc) {
          // Insert above the active layer, or at top
          const activeIdx = doc.layers.findIndex((l) => l.id === doc.activeLayerId);
          if (activeIdx !== -1) {
            doc.layers.splice(activeIdx, 0, newLayer); // splice in front (higher index means drawn top, wait: let's treat index 0 as bottom layer, top layer as last index, or vice versa? Let's treat index 0 as topmost drawn, or bottom. Let's make index 0 the bottom layer, and top index the topmost layer. Thus drawing loop processes layers from bottom to top, i.e. 0, 1, 2... index. For UI list, we will reverse it so topmost layer is displayed first)
          } else {
            doc.layers.push(newLayer);
          }
          doc.activeLayerId = id;
        }
      });
      return id;
    },

    deleteLayer: (docId, layerId) => {
      set((state) => {
        const doc = state.documents.find((d) => d.id === docId);
        if (doc) {
          const index = doc.layers.findIndex((l) => l.id === layerId);
          if (index !== -1) {
            doc.layers.splice(index, 1);
            if (doc.activeLayerId === layerId) {
              doc.activeLayerId = doc.layers.length > 0 ? doc.layers[Math.max(0, index - 1)].id : null;
            }
          }
        }
      });
    },

    updateLayer: (docId, layerId, updates) => {
      set((state) => {
        const doc = state.documents.find((d) => d.id === docId);
        if (doc) {
          const layer = doc.layers.find((l) => l.id === layerId);
          if (layer) {
            Object.assign(layer, updates);
          }
        }
      });
    },

    reorderLayers: (docId, dragIndex, hoverIndex) => {
      set((state) => {
        const doc = state.documents.find((d) => d.id === docId);
        if (doc) {
          const dragLayer = doc.layers[dragIndex];
          doc.layers.splice(dragIndex, 1);
          doc.layers.splice(hoverIndex, 0, dragLayer);
        }
      });
    },

    setActiveLayer: (docId, layerId) => {
      set((state) => {
        const doc = state.documents.find((d) => d.id === docId);
        if (doc) {
          doc.activeLayerId = layerId;
        }
      });
    },

    toggleAlphaLock: (docId, layerId) => {
      set((state) => {
        const doc = state.documents.find((d) => d.id === docId);
        if (doc) {
          const layer = doc.layers.find((l) => l.id === layerId);
          if (layer && layer.type === 'raster') {
            layer.alphaLocked = !layer.alphaLocked;
          }
        }
      });
    },

    toggleLayerVisibility: (docId, layerId) => {
      set((state) => {
        const doc = state.documents.find((d) => d.id === docId);
        if (doc) {
          const layer = doc.layers.find((l) => l.id === layerId);
          if (layer) {
            layer.visible = !layer.visible;
          }
        }
      });
    },

    toggleLayerLock: (docId, layerId) => {
      set((state) => {
        const doc = state.documents.find((d) => d.id === docId);
        if (doc) {
          const layer = doc.layers.find((l) => l.id === layerId);
          if (layer) {
            layer.locked = !layer.locked;
          }
        }
      });
    },

    // Vector elements
    addVectorElement: (docId, element) => {
      set((state) => {
        const doc = state.documents.find((d) => d.id === docId);
        if (doc) {
          doc.vectorElements.push(element);
        }
      });
    },

    updateVectorElement: (docId, elementId, updates) => {
      set((state) => {
        const doc = state.documents.find((d) => d.id === docId);
        if (doc) {
          const idx = doc.vectorElements.findIndex((el) => el.id === elementId);
          if (idx !== -1) {
            doc.vectorElements[idx] = { ...doc.vectorElements[idx], ...updates };
          }
        }
      });
    },

    removeVectorElement: (docId, elementId) => {
      set((state) => {
        const doc = state.documents.find((d) => d.id === docId);
        if (doc) {
          const idx = doc.vectorElements.findIndex((el) => el.id === elementId);
          if (idx !== -1) {
            doc.vectorElements.splice(idx, 1);
          }
        }
      });
    },

    // Selection
    setSelection: (selectionUpdates) => {
      set((state) => {
        state.selection = { ...state.selection, ...selectionUpdates };
      });
    },

    clearSelection: () => {
      set((state) => {
        state.selection = {
          type: 'none',
          path: [],
          feather: 0,
          isActive: false,
        };
      });
    },

    // Brushes & Color
    setPrimaryColor: (color) => {
      set((state) => {
        state.color.primary = color;
      });
    },

    setSecondaryColor: (color) => {
      set((state) => {
        state.color.secondary = color;
      });
    },

    addToColorHistory: (color) => {
      set((state) => {
        const idx = state.colorHistory.indexOf(color);
        if (idx !== -1) {
          state.colorHistory.splice(idx, 1);
        }
        state.colorHistory.unshift(color);
        if (state.colorHistory.length > 24) {
          state.colorHistory.pop();
        }
      });
    },

    updateBrushSettings: (updates) => {
      set((state) => {
        state.brushSettings = { ...state.brushSettings, ...updates };
      });
    },

    saveBrushPreset: (preset) => {
      set((state) => {
        const idx = state.brushPresets.findIndex((p) => p.id === preset.id);
        if (idx !== -1) {
          state.brushPresets[idx] = preset;
        } else {
          state.brushPresets.push(preset);
        }
      });
    },

    setClipboard: (data) => {
      set((state) => {
        state.clipboard = data;
      });
    },

    pushHistory: (docId) => {
      set((state) => {
        const doc = state.documents.find((d) => d.id === docId);
        if (doc) {
          doc.historyIndex++;
          doc.historyLength = doc.historyIndex + 1;
          
          // Capture and save current layer states
          layerManagerInstance.pushHistory(docId, doc.layers, doc.width, doc.height, doc.historyIndex);
        }
      });
    },

    undo: (docId) => {
      set((state) => {
        const doc = state.documents.find((d) => d.id === docId);
        if (doc && doc.historyIndex > 0) {
          doc.historyIndex--;
          
          // Restore layer canvases to previous index
          layerManagerInstance.restoreHistory(docId, doc.historyIndex, doc.width, doc.height);
        }
      });
    },

    redo: (docId) => {
      set((state) => {
        const doc = state.documents.find((d) => d.id === docId);
        if (doc && doc.historyIndex < doc.historyLength - 1) {
          doc.historyIndex++;
          
          // Restore layer canvases to next index
          layerManagerInstance.restoreHistory(docId, doc.historyIndex, doc.width, doc.height);
        }
      });
    },

    resetHistoryIndex: (docId, index, length) => {
      set((state) => {
        const doc = state.documents.find((d) => d.id === docId);
        if (doc) {
          doc.historyIndex = index;
          doc.historyLength = length;
        }
      });
    }
  }))
);
