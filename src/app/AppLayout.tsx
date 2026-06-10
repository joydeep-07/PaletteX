import React from 'react';
import { TopToolbar } from '../features/toolbar/TopToolbar';
import { LeftToolbar } from '../features/toolbar/LeftToolbar';
import { CanvasViewport } from '../features/canvas/CanvasViewport';
import { StatusBar } from '../features/canvas/StatusBar';
import { FloatingPanel } from '../components/FloatingPanel';
import { ColorPickerPanel } from '../features/color/ColorPickerPanel';
import { BrushSettingsPanel } from '../features/brushes/BrushSettingsPanel';
import { LayersPanel } from '../features/layers/LayersPanel';
import { AiPanel } from '../features/ai/AiPanel';
import { TimelinePanel } from '../features/animation/TimelinePanel';
import { useUiStore } from '../store/uiStore';
import { useCanvasStore } from '../store/canvasStore';

export const AppLayout: React.FC = () => {
  const { floatingPanels } = useUiStore();
  const { activeDocumentId } = useCanvasStore();

  const getPanelContent = (id: string) => {
    switch (id) {
      case 'color-picker-panel':
        return <ColorPickerPanel />;
      case 'brush-settings-panel':
        return <BrushSettingsPanel />;
      case 'layers-panel':
        return <LayersPanel />;
      case 'ai-panel':
        return <AiPanel />;
      case 'timeline-panel':
        return <TimelinePanel />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-neutral-950 font-sans text-neutral-250 select-none">
      {/* Top Toolbar */}
      <TopToolbar />

      {/* Main Workspace Workspace */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Toolbar */}
        <LeftToolbar />

        {/* Drawing Canvas Viewport */}
        <CanvasViewport />

        {/* Floating dockable Panels */}
        {activeDocumentId &&
          floatingPanels.map((panel) => (
            <FloatingPanel key={panel.id} panel={panel}>
              {getPanelContent(panel.id)}
            </FloatingPanel>
          ))}
      </div>

      {/* Bottom Status bar */}
      <StatusBar />
    </div>
  );
};
export default AppLayout;
