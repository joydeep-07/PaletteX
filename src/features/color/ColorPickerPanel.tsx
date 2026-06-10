import React, { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';

export const ColorPickerPanel: React.FC = () => {
  const { color, setPrimaryColor, setSecondaryColor, colorHistory, addToColorHistory } = useCanvasStore();
  const wheelCanvasRef = useRef<HTMLCanvasElement>(null);
  const [hexInput, setHexInput] = useState(color.primary);
  const [harmonyType, setHarmonyType] = useState<'complementary' | 'analogous' | 'triadic'>('complementary');
  const [harmonies, setHarmonies] = useState<string[]>([]);

  // Convert Hex to HSV
  const hexToHsv = (hex: string): { h: number; s: number; v: number } => {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, v = max;
    let d = max - min;
    s = max === 0 ? 0 : d / max;

    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, v: v * 100 };
  };

  // Convert HSV to Hex
  const hsvToHex = (h: number, s: number, v: number): string => {
    h /= 360; s /= 100; v /= 100;
    let r = 0, g = 0, b = 0;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }

    const toHex = (n: number) => {
      const hex = Math.round(n * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const hsv = hexToHsv(color.primary);

  // Redraw color wheel
  useEffect(() => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) - 10;

    ctx.clearRect(0, 0, width, height);

    // Draw Wheel
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 0.5) * Math.PI / 180;
      const endAngle = (angle + 1.5) * Math.PI / 180;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      // Fade from white center to hue edge
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, `hsl(${angle}, 100%, 50%)`);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Draw current selection handle
    const angleRad = (hsv.h * Math.PI) / 180;
    const dist = (hsv.s / 100) * radius;
    const hx = cx + Math.cos(angleRad) * dist;
    const hy = cy + Math.sin(angleRad) * dist;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hy, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hx, hy, 5, 0, Math.PI * 2);
    ctx.stroke();
  }, [hsv.h, hsv.s]);

  // Compute Harmonies
  useEffect(() => {
    const { h, s, v } = hsv;
    let computed: string[] = [];

    if (harmonyType === 'complementary') {
      computed = [
        hsvToHex((h + 180) % 360, s, v),
        hsvToHex(h, Math.max(0, s - 30), Math.min(100, v + 15)),
        hsvToHex((h + 180) % 360, Math.max(0, s - 20), v),
      ];
    } else if (harmonyType === 'analogous') {
      computed = [
        hsvToHex((h + 30) % 360, s, v),
        hsvToHex((h - 30 + 360) % 360, s, v),
        hsvToHex((h + 60) % 360, Math.max(0, s - 10), v),
      ];
    } else if (harmonyType === 'triadic') {
      computed = [
        hsvToHex((h + 120) % 360, s, v),
        hsvToHex((h + 240) % 360, s, v),
        hsvToHex((h + 120) % 360, Math.max(0, s - 20), Math.max(0, v - 20)),
      ];
    }
    setHarmonies(computed);
  }, [hsv.h, hsv.s, hsv.v, harmonyType]);

  const handleWheelClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) - 10;

    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);

    if (dist <= radius) {
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (angle < 0) angle += 360;

      const sat = (dist / radius) * 100;
      const newHex = hsvToHex(angle, sat, hsv.v);
      
      setPrimaryColor(newHex);
      setHexInput(newHex);
      addToColorHistory(newHex);
    }
  };

  const handleHexSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^#[0-9A-F]{6}$/i.test(hexInput)) {
      setPrimaryColor(hexInput);
      addToColorHistory(hexInput);
    }
  };

  const togglePrimarySecondary = () => {
    const prim = color.primary;
    const sec = color.secondary;
    setPrimaryColor(sec);
    setSecondaryColor(prim);
    setHexInput(sec);
  };

  return (
    <div className="flex flex-col gap-4 p-4 text-xs h-full justify-between">
      {/* Dynamic Wheel & Swatch overlays */}
      <div className="flex items-center justify-center relative">
        <canvas
          ref={wheelCanvasRef}
          width={180}
          height={180}
          onClick={handleWheelClick}
          className="cursor-crosshair rounded-full bg-neutral-950/20"
        />

        {/* Primary/Secondary Color Box Toggle */}
        <div className="absolute bottom-1 right-1 flex items-center gap-1">
          <div className="relative w-8 h-8">
            <button
              onClick={togglePrimarySecondary}
              style={{ backgroundColor: color.secondary }}
              className="absolute bottom-0 right-0 w-6 h-6 rounded border border-neutral-700 shadow shadow-black"
              title="Secondary Color"
            />
            <button
              onClick={togglePrimarySecondary}
              style={{ backgroundColor: color.primary }}
              className="absolute top-0 left-0 w-6 h-6 rounded border border-neutral-700 shadow shadow-black"
              title="Primary Color (Click to Swap)"
            />
          </div>
        </div>
      </div>

      {/* Brightness / Value Slider */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-neutral-400 font-mono">
          <span>Brightness / Value</span>
          <span>{Math.round(hsv.v)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={hsv.v}
          onChange={(e) => {
            const newHex = hsvToHex(hsv.h, hsv.s, parseInt(e.target.value));
            setPrimaryColor(newHex);
            setHexInput(newHex);
          }}
          className="w-full accent-blue-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Numeric inputs */}
      <form onSubmit={handleHexSubmit} className="flex gap-2 items-center bg-neutral-950/50 p-1 rounded border border-neutral-800">
        <span className="text-neutral-500 font-mono pl-1">HEX</span>
        <input
          type="text"
          value={hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          className="bg-transparent text-neutral-200 outline-none w-20 font-mono uppercase text-center"
        />
        <button type="submit" className="ml-auto px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 transition-colors">
          Set
        </button>
      </form>

      {/* Color Harmony Picker */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between border-b border-neutral-800/60 pb-1">
          <span className="font-semibold text-neutral-400">Harmony Formulas</span>
          <select
            value={harmonyType}
            onChange={(e) => setHarmonyType(e.target.value as any)}
            className="bg-transparent text-blue-400 font-medium outline-none cursor-pointer"
          >
            <option className="bg-neutral-900 text-neutral-200" value="complementary">Complementary</option>
            <option className="bg-neutral-900 text-neutral-200" value="analogous">Analogous</option>
            <option className="bg-neutral-900 text-neutral-200" value="triadic">Triadic</option>
          </select>
        </div>
        <div className="flex gap-2">
          {harmonies.map((c, i) => (
            <button
              key={i}
              onClick={() => {
                setPrimaryColor(c);
                setHexInput(c);
                addToColorHistory(c);
              }}
              style={{ backgroundColor: c }}
              className="flex-1 h-6 rounded border border-neutral-800/80 shadow-sm hover:scale-105 active:scale-95 transition-transform"
              title={`Harmonic: ${c}`}
            />
          ))}
        </div>
      </div>

      {/* Color History / Swatches */}
      <div className="flex flex-col gap-1.5">
        <span className="font-semibold text-neutral-400">Color Swatch History</span>
        <div className="grid grid-cols-8 gap-1">
          {colorHistory.map((c, i) => (
            <button
              key={i}
              onClick={() => {
                setPrimaryColor(c);
                setHexInput(c);
              }}
              style={{ backgroundColor: c }}
              className="w-full aspect-square rounded-sm border border-neutral-950 hover:scale-110 active:scale-90 transition-transform shadow-inner"
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
