import React from 'react';
import { ControlPanel } from '../ControlPanel';
import { LayerType, DrawMode } from './types';

interface KeplerControlsProps {
  showMenu: boolean;
  onShowFilters: () => void;
  showFilters: boolean;
  layerType: LayerType;
  setLayerType: (type: LayerType) => void;
  pointSize: number;
  setPointSize: (size: number) => void;
  signalThreshold: number;
  setSignalThreshold: (val: number) => void;
  pitch: number;
  setPitch: (val: number) => void;
  height3d: number;
  setHeight3d: (val: number) => void;
  drawMode: DrawMode;
  setDrawMode: (mode: DrawMode) => void;
  datasetType: 'observations' | 'networks';
  setDatasetType: (type: 'observations' | 'networks') => void;
  loading: boolean;
  error: string;
  actualCounts: { observations: number; networks: number } | null;
}

export const KeplerControls: React.FC<KeplerControlsProps> = ({
  showMenu,
  onShowFilters,
  showFilters,
  layerType,
  setLayerType,
  pointSize,
  setPointSize,
  signalThreshold,
  setSignalThreshold,
  pitch,
  setPitch,
  height3d,
  setHeight3d,
  drawMode,
  setDrawMode,
  datasetType,
  setDatasetType,
  loading,
  error,
  actualCounts,
}) => {
  return (
    <ControlPanel isOpen={showMenu} onShowFilters={onShowFilters} showFilters={showFilters}>
      <div className="space-y-6">
        {/* Layer Type */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Layer Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['scatterplot', 'heatmap', 'hexagon', 'icon'] as LayerType[]).map((type) => (
              <button
                key={type}
                onClick={() => setLayerType(type)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  layerType === type
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Dataset Selection */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Dataset
          </label>
          <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setDatasetType('observations')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                datasetType === 'observations'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Observations
            </button>
            <button
              onClick={() => setDatasetType('networks')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                datasetType === 'networks'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Networks
            </button>
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-slate-300">
              <span>Point Size</span>
              <span className="text-blue-400 font-mono">{pointSize.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="2.0"
              step="0.01"
              value={pointSize}
              onChange={(e) => setPointSize(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-slate-300">
              <span>Pitch (3D)</span>
              <span className="text-blue-400 font-mono">{pitch}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              value={pitch}
              onChange={(e) => setPitch(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>

        {/* Stats & Status */}
        <div className="pt-4 border-t border-slate-800/50 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-blue-400 text-xs font-medium animate-pulse">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              Loading spatial data...
            </div>
          ) : error ? (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] leading-relaxed">
              {error}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/30">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">
                  Observations
                </div>
                <div className="text-sm font-bold text-slate-200 mt-0.5">
                  {actualCounts?.observations.toLocaleString() ?? 0}
                </div>
              </div>
              <div className="p-2.5 bg-slate-800/40 rounded-lg border border-slate-700/30">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">
                  Networks
                </div>
                <div className="text-sm font-bold text-slate-200 mt-0.5">
                  {actualCounts?.networks.toLocaleString() ?? 0}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ControlPanel>
  );
};
