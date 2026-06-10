import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { useCanvasStore } from '../../store/canvasStore';
import { layerManagerInstance } from '../../canvas-engine/LayerManager';
import { Wand2, Sparkles, Cpu, Image as ImageIcon, Zap, AlertCircle } from 'lucide-react';

export const AiPanel: React.FC = () => {
  const { documents, activeDocumentId, updateLayer, pushHistory } = useCanvasStore();
  const [aiTool, setAiTool] = useState<string>('sketch-cleaner');
  const [provider, setProvider] = useState<string>('gemini');
  const [prompt, setPrompt] = useState<string>('');
  const [strength, setStrength] = useState<number>(0.75);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const doc = documents.find((d) => d.id === activeDocumentId);

  // Trigger AI operation
  const runAiOperation = async () => {
    if (!doc || !doc.activeLayerId) return;
    setIsGenerating(true);
    setErrorMsg(null);

    // Get layer canvas
    const canvas = layerManagerInstance.getOrCreateCanvas(doc.activeLayerId, doc.width, doc.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsGenerating(false);
      return;
    }

    try {
      // 1. Simulate API delay or load ONNX weights
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (aiTool === 'sketch-cleaner') {
        // Run functional sketch cleaner filter on image data (Threshold filter)
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        
        // Loop pixels: Convert greyish colors to white, dark colors to pure black
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const alpha = data[i + 3];

          if (alpha > 0) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            // High contrast threshold based on strength parameter
            const threshold = 255 * (1 - strength);
            const finalVal = gray > threshold ? 255 : 0;
            
            data[i] = finalVal;
            data[i + 1] = finalVal;
            data[i + 2] = finalVal;
            // Keep opacity
            data[i + 3] = finalVal === 255 ? 0 : 255; // transparent background, black lines
          }
        }
        ctx.putImageData(imgData, 0, 0);
        pushHistory(doc.id);
        
        // Show success animation
        confetti({ particleCount: 60, spread: 45, origin: { y: 0.6 } });
      } else if (aiTool === 'auto-coloring') {
        // Run simulation coloring (gradient overlays)
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.4)'); // blue
        grad.addColorStop(0.5, 'rgba(236, 72, 153, 0.3)'); // pink
        grad.addColorStop(1, 'rgba(16, 185, 129, 0.4)'); // green
        
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop'; // fill opacity channels
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        pushHistory(doc.id);
        
        confetti({ particleCount: 80, spread: 60, colors: ['#3b82f6', '#ec4899', '#10b981'] });
      } else {
        // Background generator, Inpainting, Smart Erase - simulate visual draw
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw some artistic lines as "AI generated overlay"
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.25, canvas.height * 0.5);
        ctx.bezierCurveTo(
          canvas.width * 0.4, canvas.height * 0.2,
          canvas.width * 0.6, canvas.height * 0.8,
          canvas.width * 0.75, canvas.height * 0.5
        );
        ctx.stroke();
        ctx.restore();
        
        pushHistory(doc.id);
        confetti({ particleCount: 40, spread: 30 });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const AI_TOOLS = [
    { id: 'sketch-cleaner', name: 'Ink Sketch Cleaner', desc: 'Converts gray scans into sharp, transparent black vector/raster lineart.' },
    { id: 'auto-coloring', name: 'Auto Colorizing Shader', desc: 'Predictive coloring and ambient occlusion map overlays.' },
    { id: 'background-gen', name: 'Dreamy BG Generator', desc: 'Uses prompt variables to synthesise a detailed scenic backdrop.' },
    { id: 'smart-erase', name: 'Magic Object Eraser', desc: 'Context-aware fill that blends selected borders seamlessly.' },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 text-xs h-full bg-neutral-900/40 justify-between select-none">
      {/* Workspace details */}
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold text-neutral-400">AI Tool Selection</span>
          <div className="flex flex-col gap-1.5">
            {AI_TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => setAiTool(t.id)}
                className={`p-2.5 rounded border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                  aiTool === t.id
                    ? 'bg-blue-600/15 border-blue-500/20 text-neutral-100 shadow'
                    : 'bg-neutral-950/20 border-neutral-800/60 hover:border-neutral-800/90 text-neutral-400 hover:text-neutral-300'
                }`}
              >
                <span className="font-bold flex items-center gap-1.5">
                  <Wand2 size={12} className={aiTool === t.id ? 'text-blue-400' : 'text-neutral-500'} />
                  {t.name}
                </span>
                <span className="text-[10px] text-neutral-500 font-medium tracking-wide">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Model configuration settings */}
        <div className="flex flex-col gap-3 border-t border-neutral-850 pt-3">
          <div className="flex justify-between items-center gap-2">
            <span className="font-semibold text-neutral-400">Model Engine</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="bg-neutral-800 text-neutral-250 border border-neutral-700 px-2 py-1 rounded outline-none w-36"
            >
              <option value="gemini">Gemini Pro Vision</option>
              <option value="openai">OpenAI DALL-E 3</option>
              <option value="claude">Anthropic Artifacts</option>
              <option value="onnx">Local WebGPU (ONNX)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-neutral-400">
              <span>Correction Strength</span>
              <span>{Math.round(strength * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={strength * 100}
              onChange={(e) => setStrength(parseInt(e.target.value) / 100)}
              className="w-full accent-blue-500 h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-semibold text-neutral-400">Generative Text Prompt</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. detailed watercolor background, sunset on cyberpunk street, 8k resolution..."
              rows={3}
              className="w-full bg-neutral-950/50 border border-neutral-800 rounded p-2 text-neutral-200 placeholder-neutral-600 outline-none focus:border-blue-500 transition-colors font-sans resize-none"
            />
          </div>
        </div>
      </div>

      {/* Trigger generator */}
      <div className="flex flex-col gap-2 border-t border-neutral-850 pt-3">
        {errorMsg && (
          <div className="flex items-center gap-1.5 text-red-400 text-[10px] bg-red-950/20 p-2 rounded border border-red-900/50">
            <AlertCircle size={12} />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          onClick={runAiOperation}
          disabled={isGenerating || !doc}
          className={`w-full py-2.5 rounded font-bold text-center flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg shadow-black/20 ${
            isGenerating
              ? 'bg-neutral-800 text-neutral-500 cursor-wait'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-98 text-white'
          }`}
        >
          {isGenerating ? (
            <>
              <Cpu size={14} className="animate-spin text-neutral-500" />
              Applying AI Filters...
            </>
          ) : (
            <>
              <Sparkles size={14} className="text-amber-300" />
              Synthesize Element
            </>
          )}
        </button>
      </div>
    </div>
  );
};
