import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { SavedValueInput } from './SavedValueInput';

const SearchIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

interface GeocodingConfigProps {
  opencageApiKey: string;
  setOpencageApiKey: (val: string) => void;
  savedOpencageApiKey: string;
  geocodioApiKey: string;
  setGeocodioApiKey: (val: string) => void;
  savedGeocodioApiKey: string;
  locationIqApiKey: string;
  setLocationIqApiKey: (val: string) => void;
  savedLocationIqApiKey: string;
  isSaving: boolean;
  onSave: () => void;
  hasChanges: boolean;
  isConfigured?: boolean;
}

export const GeocodingConfig: React.FC<GeocodingConfigProps> = ({
  opencageApiKey,
  setOpencageApiKey,
  savedOpencageApiKey,
  geocodioApiKey,
  setGeocodioApiKey,
  savedGeocodioApiKey,
  locationIqApiKey,
  setLocationIqApiKey,
  savedLocationIqApiKey,
  isSaving,
  onSave,
  hasChanges,
  isConfigured,
}) => (
  <AdminCard
    title="Geocoding Providers"
    icon={SearchIcon}
    color="from-green-600 to-emerald-600"
    isConfigured={isConfigured}
  >
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">OpenCage API Key</label>
        <SavedValueInput
          actualValue={opencageApiKey}
          savedValue={savedOpencageApiKey}
          onChange={setOpencageApiKey}
          sensitive={true}
          placeholder="API Key"
          className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 outline-none focus:border-green-500/50 transition-colors"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Geocodio API Key</label>
        <SavedValueInput
          actualValue={geocodioApiKey}
          savedValue={savedGeocodioApiKey}
          onChange={setGeocodioApiKey}
          sensitive={true}
          placeholder="API Key"
          className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 outline-none focus:border-green-500/50 transition-colors"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">LocationIQ API Key</label>
        <SavedValueInput
          actualValue={locationIqApiKey}
          savedValue={savedLocationIqApiKey}
          onChange={setLocationIqApiKey}
          sensitive={true}
          placeholder="API Key"
          className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 outline-none focus:border-green-500/50 transition-colors"
        />
      </div>
      <button
        onClick={onSave}
        disabled={isSaving || !hasChanges}
        className={`w-full py-2.5 rounded-lg font-medium transition-all ${
          hasChanges
            ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        {isSaving ? 'Saving...' : 'Save Geocoding Settings'}
      </button>
    </div>
  </AdminCard>
);
