import React, { useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useCanvasStore } from './store/canvasStore';
import { AppLayout } from './app/AppLayout';
import { layerManagerInstance } from './canvas-engine/LayerManager';
import { saveProjectToDb } from './services/db';

export const App: React.FC = () => {
  const {
    documents,
    activeDocumentId,
    setActiveTool,
    undo,
    redo,
    clearSelection,
  } = useCanvasStore();

  const doc = documents.find((d) => d.id === activeDocumentId);

  // Keyboard shortcut hooks (Desktop software feel)
  useHotkeys('b', () => setActiveTool('brush'));
  useHotkeys('e', () => setActiveTool('eraser'));
  useHotkeys('v', () => setActiveTool('move'));
  useHotkeys('l', () => setActiveTool('lasso'));
  useHotkeys('p', () => setActiveTool('pen'));
  useHotkeys('t', () => setActiveTool('text'));
  useHotkeys('i', () => setActiveTool('eyedropper'));
  useHotkeys('space', (e) => {
    e.preventDefault();
    setActiveTool('hand');
  });

  // Undo / Redo
  useHotkeys('meta+z, ctrl+z', (e) => {
    e.preventDefault();
    if (doc) undo(doc.id);
  });
  useHotkeys('meta+shift+z, ctrl+shift+z', (e) => {
    e.preventDefault();
    if (doc) redo(doc.id);
  });

  // Clear Selection
  useHotkeys('meta+d, ctrl+d', (e) => {
    e.preventDefault();
    clearSelection();
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
