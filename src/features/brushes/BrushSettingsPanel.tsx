import React from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { BrushPreset, StabilizerType, BrushType } from '../../types/brush';

export const BrushSettingsPanel: React.FC = () => {
  const { brushSettings, brushPresets, updateBrushSettings } = useCanvasStore();

  const activePreset = brushPresets.find((p) => p.type === brushSettings.type) || brushSettings;

  const handleSliderChange = (key: keyof BrushPreset, value: number) => {
    updateBrushSettings({ [key]: value });
  };

  const handleDynamicsChange = (key: string, value: boolean | number) => {
    updateBrushSettings({
      dynamics: {
        ...brushSettings.dynamics,
        [key]: value,
      },
    });
  };

  const handleStabilizerChange = (key: string, value: any) => {
    updateBrushSettings({
      stabilizer: {
        ...brushSettings.stabilizer,
        [key]: value,
      },
    });
  };

  const selectPreset = (preset: BrushPreset) => {
    updateBrushSettings(preset);
  };

  const STABILIZERS: { value: StabilizerType; label: string }[] = [
    { value: 'none', label: 'None (Raw Input)' },
    { value: 'basic', label: 'Basic smoothing' },
    { value: 'lazy-mouse', label: 'Lazy Mouse leash' },
    { value: 'rope', label: 'Physical Rope stabilizer' },
    { value: 'weighted', label: 'Weighted interpolation' },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 text-xs h-full justify-between">
      {/* Active Preset Quick List */}
      <div className="flex flex-col gap-2">
        <span className="font-semibold text-neutral-400">Brush Presets</span>
        <div className="grid grid-cols-2 gap-1.5 max-h-[120px] overflow-y-auto pr-1">
          {brushPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => selectPreset(preset)}
              className={`p-2 rounded border text-left flex flex-col transition-all select-none ${
                brushSettings.id === preset.id
                  ? 'bg-blue-600/15 border-blue-500 text-neutral-100 shadow'
                  : 'bg-neutral-950/20 border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-250'
              }`}
            >
              <span className="font-semibold truncate">{preset.name}</span>
              <span className="text-[10px] text-neutral-500 uppercase">{preset.type}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Spacing / Flow / Size sliders */}
      <div className="flex flex-col gap-3 border-t border-neutral-800/60 pt-3">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-neutral-400">
            <span>Brush size</span>
            <span>{Math.round(brushSettings.size)} px</span>
          </div>
          <input
            type="range"
            min={1}
            max={300}
            value={brushSettings.size}
            onChange={(e) => handleSliderChange('size', parseInt(e.target.value))}
            className="w-full accent-blue-500 h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-neutral-400">
            <span>Brush hardness</span>
            <span>{Math.round(brushSettings.dynamics.hardness * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={brushSettings.dynamics.hardness * 100}
            onChange={(e) => handleDynamicsChange('hardness', parseInt(e.target.value) / 100)}
            className="w-full accent-blue-500 h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-neutral-400">
            <span>Opacity</span>
            <span>{Math.round(brushSettings.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={brushSettings.opacity * 100}
            onChange={(e) => handleSliderChange('opacity', parseInt(e.target.value) / 100)}
            className="w-full accent-blue-500 h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-neutral-400">
            <span>Spacing (Stamp density)</span>
            <span>{Math.round(brushSettings.dynamics.spacing * 100)}%</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={brushSettings.dynamics.spacing * 100}
            onChange={(e) => handleDynamicsChange('spacing', parseInt(e.target.value) / 100)}
            className="w-full accent-blue-500 h-1 bg-neutral-800 rounded appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Pen Stabilization settings */}
      <div className="flex flex-col gap-2 border-t border-neutral-800/60 pt-3">
        <span className="font-semibold text-neutral-400">Stabilization Smoothness</span>
        <div className="flex flex-col gap-2 bg-neutral-950/20 p-2 rounded border border-neutral-800">
          <select
            value={brushSettings.stabilizer.type}
            onChange={(e) => handleStabilizerChange('type', e.target.value as StabilizerType)}
            className="bg-neutral-800 text-neutral-250 border border-neutral-700 px-2 py-1 rounded outline-none w-full"
          >
            {STABILIZERS.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label}
              </option>
            ))}
          </select>

          {brushSettings.stabilizer.type !== 'none' && (
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex justify-between text-neutral-500 font-mono text-[10px]">
                <span>
                  {brushSettings.stabilizer.type === 'rope' ? 'Leash Radius (px)' : 'Smooth Factor'}
                </span>
                <span>
                  {brushSettings.stabilizer.type === 'rope'
                    ? brushSettings.stabilizer.ropeLength
                    : brushSettings.stabilizer.value}
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={100}
                value={
                  brushSettings.stabilizer.type === 'rope'
                    ? brushSettings.stabilizer.ropeLength
                    : brushSettings.stabilizer.value
                }
                onChange={(e) =>
                  handleStabilizerChange(
                    brushSettings.stabilizer.type === 'rope' ? 'ropeLength' : 'value',
                    parseInt(e.target.value)
                  )
                }
                className="w-full accent-blue-500 h-1 bg-neutral-850 rounded appearance-none cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>

      {/* Dynamics Mapping Toggles */}
      <div className="flex flex-col gap-1.5 border-t border-neutral-800/60 pt-3">
        <span className="font-semibold text-neutral-400">Pen Pressure & Speed Mapping</span>
        <div className="flex flex-col gap-1 bg-neutral-950/10 p-1.5 rounded">
          <label className="flex items-center gap-2 text-neutral-400 py-0.5 cursor-pointer">
            <input
              type="checkbox"
              checked={brushSettings.dynamics.sizeByPressure}
              onChange={(e) => handleDynamicsChange('sizeByPressure', e.target.checked)}
              className="accent-blue-500"
            />
            <span>Size by pressure sensitivity</span>
          </label>
          <label className="flex items-center gap-2 text-neutral-400 py-0.5 cursor-pointer">
            <input
              type="checkbox"
              checked={brushSettings.dynamics.opacityByPressure}
              onChange={(e) => handleDynamicsChange('opacityByPressure', e.target.checked)}
              className="accent-blue-500"
            />
            <span>Opacity by pressure sensitivity</span>
          </label>
          <label className="flex items-center gap-2 text-neutral-400 py-0.5 cursor-pointer">
            <input
              type="checkbox"
              checked={brushSettings.dynamics.sizeBySpeed}
              onChange={(e) => handleDynamicsChange('sizeBySpeed', e.target.checked)}
              className="accent-blue-500"
            />
            <span>Flick/taper size by pointer speed</span>
          </label>
        </div>
      </div>
    </div>
  );
};
