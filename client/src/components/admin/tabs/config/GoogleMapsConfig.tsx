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
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

interface GoogleMapsConfigProps {
  googleMapsApiKey: string;
  setGoogleMapsApiKey: (val: string) => void;
  savedGoogleMapsApiKey: string;
  isSaving: boolean;
  onSave: () => void;
  hasChanges: boolean;
}

export const GoogleMapsConfig: React.FC<GoogleMapsConfigProps> = ({
  googleMapsApiKey,
  setGoogleMapsApiKey,
  savedGoogleMapsApiKey,
  isSaving,
  onSave,
  hasChanges,
}) => (
  <AdminCard title="Google Maps" icon={MapIcon} color="from-red-600 to-rose-600">
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">API Key</label>
        <SavedValueInput
          actualValue={googleMapsApiKey}
          savedValue={savedGoogleMapsApiKey}
          onChange={setGoogleMapsApiKey}
          sensitive={true}
          placeholder="API Key"
          className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 outline-none focus:border-red-500/50 transition-colors"
        />
      </div>
      <button
        onClick={onSave}
        disabled={isSaving || !hasChanges}
        className={`w-full py-2.5 rounded-lg font-medium transition-all ${
          hasChanges
            ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        {isSaving ? 'Saving...' : 'Save Google Settings'}
      </button>
    </div>
  </AdminCard>
);
