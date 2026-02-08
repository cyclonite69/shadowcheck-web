import React from 'react';
import { LayerToggle } from './ui/LayerToggle';
import type { WigleLayerState } from './WiglePage';

interface WigleControlPanelProps {
  isOpen: boolean;
  onShowFilters: () => void;
  showFilters: boolean;
  mapStyle: string;
  onMapStyleChange: (style: string) => void;
  mapStyles: Array<{ label: string; value: string }>;
  show3dBuildings: boolean;
  onToggle3dBuildings: () => void;
  showTerrain: boolean;
  onToggleTerrain: () => void;
  onLoadPoints: () => void;
  loading: boolean;
  rowsLoaded: number;
  totalRows: number | null;
  layers: WigleLayerState;
  onToggleLayer: (key: keyof WigleLayerState) => void;
}

export const WigleControlPanel: React.FC<WigleControlPanelProps> = ({
  isOpen,
  onShowFilters,
  showFilters,
  mapStyle,
  onMapStyleChange,
  mapStyles,
  show3dBuildings,
  onToggle3dBuildings,
  showTerrain,
  onToggleTerrain,
  onLoadPoints,
  loading,
  rowsLoaded,
  totalRows,
  layers,
  onToggleLayer,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed top-16 left-4 w-80 max-h-[calc(100vh-100px)] bg-slate-900/95 border border-blue-500/25 backdrop-blur-xl rounded-xl shadow-2xl p-5 space-y-3.5 text-sm overflow-y-auto z-40 pointer-events-auto">
      <div className="border-b border-blue-500/20 pb-3.5 mb-1.5">
        <h3 className="text-xl font-bold text-blue-400">🛡️ ShadowCheck</h3>
        <p className="text-xs text-slate-400 mt-1">Network Mapping</p>
        <button
          onClick={onShowFilters}
          className={`mt-3 w-full px-3 py-2 text-sm font-semibold text-white rounded-lg border shadow-lg transition-all hover:shadow-xl ${
            showFilters
              ? 'bg-gradient-to-br from-red-500 to-red-600 border-red-600'
              : 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-600'
          }`}
        >
          {showFilters ? '✕ Hide Filters' : '🔍 Show Filters'}
        </button>
      </div>

      {/* Layer Toggles */}
      <div>
        <label className="block mb-1.5 text-xs text-slate-300 font-medium">Layers</label>
        <div className="space-y-0.5">
          <LayerToggle
            label="v2 Points"
            enabled={layers.v2}
            onChange={() => onToggleLayer('v2')}
            color="#3b82f6"
          />
          <LayerToggle
            label="v3 Points"
            enabled={layers.v3}
            onChange={() => onToggleLayer('v3')}
            color="#8b5cf6"
          />
          <LayerToggle
            label="Field Offices"
            enabled={layers.fieldOffices}
            onChange={() => onToggleLayer('fieldOffices')}
            color="#dc2626"
          />
          <LayerToggle
            label="Resident Agencies"
            enabled={layers.residentAgencies}
            onChange={() => onToggleLayer('residentAgencies')}
            color="#f97316"
          />
        </div>
      </div>

      {/* Map Style */}
      <div>
        <label htmlFor="wigle-map-style" className="block mb-1 text-xs text-slate-300">
          Map Style
        </label>
        <select
          id="wigle-map-style"
          value={mapStyle}
          onChange={(e) => onMapStyleChange(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs"
        >
          {mapStyles.map((style) => (
            <option key={style.value} value={style.value}>
              {style.label}
            </option>
          ))}
        </select>
      </div>

      {/* 3D & Terrain buttons */}
      <div className="flex gap-2">
        <button
          onClick={onToggle3dBuildings}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
            show3dBuildings
              ? 'bg-cyan-500 text-slate-900 shadow-lg'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {show3dBuildings ? '✓ ' : ''}3D Buildings
        </button>
        <button
          onClick={onToggleTerrain}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
            showTerrain
              ? 'bg-cyan-500 text-slate-900 shadow-lg'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {showTerrain ? '✓ ' : ''}Terrain
        </button>
      </div>

      {/* Load Points button */}
      <button
        onClick={onLoadPoints}
        className="w-full rounded-lg px-4 py-2 text-sm font-semibold shadow-lg transition-all hover:shadow-xl"
        style={{
          background: loading
            ? 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
            : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
        }}
        disabled={loading}
      >
        {loading ? 'Loading...' : '📍 Load Points'}
      </button>

      {/* Stats footer */}
      <div className="pt-3 mt-2 border-t border-blue-500/20 bg-gradient-to-b from-blue-500/5 to-transparent p-3 -mx-5 -mb-5 rounded-b-xl text-xs">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Loaded:</span>
            <span className="text-blue-400 font-semibold">{rowsLoaded.toLocaleString()}</span>
          </div>
          {totalRows != null && (
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total:</span>
              <span className="text-blue-400 font-semibold">{totalRows.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
