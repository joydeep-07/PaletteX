import React, { useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useCanvasStore } from './store/canvasStore';
import { useUiStore } from './store/uiStore';
import { AppLayout } from './app/AppLayout';
import { layerManagerInstance } from './canvas-engine/LayerManager';
import { saveProjectToDb } from './services/db';
import {
  copySelectionToClipboard,
  cutSelectionToClipboard,
  pasteFromClipboard,
  deleteSelectionPixels,
} from './services/clipboardService';

export const App: React.FC = () => {
  const {
    documents,
    activeDocumentId,
    setActiveTool,
    undo,
    redo,
    clearSelection,
  } = useCanvasStore();

  const { setSpaceHeld } = useUiStore();

  const doc = documents.find((d) => d.id === activeDocumentId);

  // Keyboard shortcut hooks (Desktop software feel)
  useHotkeys('b', () => setActiveTool('brush'));
  useHotkeys('e', () => setActiveTool('eraser'));
  useHotkeys('v', () => setActiveTool('move'));
  useHotkeys('l', () => setActiveTool('lasso'));
  useHotkeys('p', () => setActiveTool('pen'));
  useHotkeys('t', () => setActiveTool('text'));
  useHotkeys('i', () => setActiveTool('eyedropper'));
  useHotkeys('u', () => setActiveTool('shape'));
  useHotkeys('[', () => {
    const { brushSettings, updateBrushSettings } = useCanvasStore.getState();
    updateBrushSettings({ size: Math.max(1, brushSettings.size - 4) });
  });
  useHotkeys(']', () => {
    const { brushSettings, updateBrushSettings } = useCanvasStore.getState();
    updateBrushSettings({ size: Math.min(300, brushSettings.size + 4) });
  });

  // Space = temporary pan (hold to pan, release to restore)
  useHotkeys(
    'space',
    (e) => {
      e.preventDefault();
      setSpaceHeld(true);
    },
    { keydown: true },
    [setSpaceHeld]
  );
  useHotkeys(
    'space',
    () => setSpaceHeld(false),
    { keyup: true },
    [setSpaceHeld]
  );

  // Undo / Redo
  useHotkeys('meta+z, ctrl+z', (e) => {
    e.preventDefault();
    if (doc) undo(doc.id);
  });
  useHotkeys('meta+shift+z, ctrl+shift+z, meta+y, ctrl+y', (e) => {
    e.preventDefault();
    if (doc) redo(doc.id);
  });

  // Deselect
  useHotkeys('escape', () => clearSelection());
  useHotkeys('meta+d, ctrl+d', (e) => {
    e.preventDefault();
    clearSelection();
  });

  // Clipboard
  useHotkeys('meta+c, ctrl+c', (e) => {
    e.preventDefault();
    copySelectionToClipboard();
  });
  useHotkeys('meta+x, ctrl+x', (e) => {
    e.preventDefault();
    cutSelectionToClipboard();
  });
  useHotkeys('meta+v, ctrl+v', (e) => {
    e.preventDefault();
    pasteFromClipboard();
  });
  useHotkeys('delete, backspace', (e) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    e.preventDefault();
    deleteSelectionPixels();
  });

  // Save project (IndexedDB / Dexie)
  useHotkeys('meta+s, ctrl+s', async (e) => {
    e.preventDefault();
    if (doc) {
      const layersToSave = doc.layers.map((l) => ({
        metadata: l,
        canvas: layerManagerInstance.getOrCreateCanvas(l.id, doc.width, doc.height),
      }));

      await saveProjectToDb(
        {
          id: doc.id,
          name: doc.name,
          width: doc.width,
          height: doc.height,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        layersToSave,
        doc.vectorElements
      );
      console.log('Document autosaved to Dexie');
    }
  });

  // Initialize a default starter canvas document if empty
  useEffect(() => {
    if (documents.length === 0) {
      useCanvasStore.getState().addDocument('Sketchbook Canvas', 1200, 800);
    }
  }, [documents.length]);

  return <AppLayout />;
};
export default App;
