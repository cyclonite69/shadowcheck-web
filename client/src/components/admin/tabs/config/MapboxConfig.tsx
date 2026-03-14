import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { SavedValueInput } from './SavedValueInput';

const MapIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </svg>
);

interface MapboxConfigProps {
  mapboxToken: string;
  setMapboxToken: (val: string) => void;
  savedMapboxToken: string;
  mapboxUnlimitedApiKey: string;
  setMapboxUnlimitedApiKey: (val: string) => void;
  savedMapboxUnlimitedApiKey: string;
  isSaving: boolean;
  onSave: () => void;
  hasChanges: boolean;
}

export const MapboxConfig: React.FC<MapboxConfigProps> = ({
  mapboxToken,
  setMapboxToken,
  savedMapboxToken,
  mapboxUnlimitedApiKey,
  setMapboxUnlimitedApiKey,
  savedMapboxUnlimitedApiKey,
  isSaving,
  onSave,
  hasChanges,
}) => (
  <AdminCard title="Mapbox Configuration" icon={MapIcon} color="from-blue-600 to-indigo-600">
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Public Token</label>
        <SavedValueInput
          actualValue={mapboxToken}
          savedValue={savedMapboxToken}
          onChange={setMapboxToken}
          sensitive={true}
          placeholder="pk.ey..."
          className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500/50 transition-colors"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Unlimited API Key (Optional)</label>
        <SavedValueInput
          actualValue={mapboxUnlimitedApiKey}
          savedValue={savedMapboxUnlimitedApiKey}
          onChange={setMapboxUnlimitedApiKey}
          sensitive={true}
          placeholder="sk.ey..."
          className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500/50 transition-colors"
        />
      </div>
      <button
        onClick={onSave}
        disabled={isSaving || !hasChanges}
        className={`w-full py-2.5 rounded-lg font-medium transition-all ${
          hasChanges
            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        {isSaving ? 'Saving...' : 'Save Mapbox Settings'}
      </button>
    </div>
  </AdminCard>
);
