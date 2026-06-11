import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { ViewportState } from '../types/canvas';

export interface FloatingPanelConfig {
  id: string;
  title: string;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  collapsed: boolean;
}

interface UiStoreState {
  viewport: ViewportState;
  cursorCoordinates: { x: number; y: number };
  fps: number;
  isSpaceHeld: boolean;
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  activeRightTab: 'layers' | 'colors' | 'brushes' | 'properties' | 'history' | 'ai';
  floatingPanels: FloatingPanelConfig[];
}

interface UiStoreActions {
  setViewport: (viewport: Partial<ViewportState> | ((v: ViewportState) => Partial<ViewportState>)) => void;
  resetViewport: () => void;
  setCursorCoordinates: (x: number, y: number) => void;
  setFps: (fps: number) => void;
  setSpaceHeld: (held: boolean) => void;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setActiveRightTab: (tab: 'layers' | 'colors' | 'brushes' | 'properties' | 'history' | 'ai') => void;
  
  // Floating Panels
  togglePanel: (id: string) => void;
  updatePanelPosition: (id: string, x: number, y: number) => void;
  updatePanelSize: (id: string, width: number, height: number) => void;
  togglePanelCollapsed: (id: string) => void;
}

export const useUiStore = create<UiStoreState & UiStoreActions>()(
  immer((set) => ({
    viewport: {
      x: 0,
      y: 0,
      zoom: 1.0,
      rotation: 0,
    },
    cursorCoordinates: { x: 0, y: 0 },
    fps: 60,
    isSpaceHeld: false,
    leftSidebarCollapsed: false,
    rightSidebarCollapsed: false,
    activeRightTab: 'layers',
    floatingPanels: [
      {
        id: 'color-picker-panel',
        title: 'Color Harmonizer',
        visible: true,
        x: 1050,
        y: 80,
        width: 320,
        height: 420,
        minWidth: 260,
        minHeight: 320,
        collapsed: false,
      },
      {
        id: 'brush-settings-panel',
        title: 'Brush Dynamix',
        visible: true,
        x: 1050,
        y: 520,
        width: 320,
        height: 380,
        minWidth: 260,
        minHeight: 250,
        collapsed: false,
      },
      {
        id: 'layers-panel',
        title: 'Layers & Blend Modes',
        visible: true,
        x: 710,
        y: 80,
        width: 320,
        height: 420,
        minWidth: 250,
        minHeight: 300,
        collapsed: false,
      },
      {
        id: 'ai-panel',
        title: 'AI Synthesis Laboratory',
        visible: false,
        x: 400,
        y: 120,
        width: 380,
        height: 520,
        minWidth: 320,
        minHeight: 400,
        collapsed: false,
      },
      {
        id: 'timeline-panel',
        title: 'Animation Motion Timeline',
        visible: false,
        x: 200,
        y: 600,
        width: 800,
        height: 250,
        minWidth: 400,
        minHeight: 180,
        collapsed: false,
      }
    ],

    setViewport: (viewport) => {
      set((state) => {
        if (typeof viewport === 'function') {
          Object.assign(state.viewport, viewport(state.viewport));
        } else {
          Object.assign(state.viewport, viewport);
        }
        
        // Clamp zoom between 0.01 (1%) and 64.0 (6400%)
        if (state.viewport.zoom < 0.01) state.viewport.zoom = 0.01;
        if (state.viewport.zoom > 64.0) state.viewport.zoom = 64.0;
        
        // Normalise rotation
        state.viewport.rotation = (state.viewport.rotation + 360) % 360;
      });
    },

    resetViewport: () => {
      set((state) => {
        state.viewport = { x: 0, y: 0, zoom: 1.0, rotation: 0 };
      });
    },

    setCursorCoordinates: (x, y) => {
      set((state) => {
        state.cursorCoordinates = { x, y };
      });
    },

    setFps: (fps) => {
      set((state) => {
        state.fps = fps;
      });
    },

    setSpaceHeld: (held) => {
      set((state) => {
        state.isSpaceHeld = held;
      });
    },

    toggleLeftSidebar: () => {
      set((state) => {
        state.leftSidebarCollapsed = !state.leftSidebarCollapsed;
      });
    },

    toggleRightSidebar: () => {
      set((state) => {
        state.rightSidebarCollapsed = !state.rightSidebarCollapsed;
      });
    },

    setActiveRightTab: (tab) => {
      set((state) => {
        state.activeRightTab = tab;
      });
    },

    togglePanel: (id) => {
      set((state) => {
        const panel = state.floatingPanels.find((p) => p.id === id);
        if (panel) {
          panel.visible = !panel.visible;
        }
      });
    },

    updatePanelPosition: (id, x, y) => {
      set((state) => {
        const panel = state.floatingPanels.find((p) => p.id === id);
        if (panel) {
          panel.x = x;
          panel.y = y;
        }
      });
    },

    updatePanelSize: (id, width, height) => {
      set((state) => {
        const panel = state.floatingPanels.find((p) => p.id === id);
        if (panel) {
          panel.width = width;
          panel.height = height;
        }
      });
    },

    togglePanelCollapsed: (id) => {
      set((state) => {
        const panel = state.floatingPanels.find((p) => p.id === id);
        if (panel) {
          panel.collapsed = !panel.collapsed;
        }
      });
    }
  }))
);
