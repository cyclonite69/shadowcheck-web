import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { SavedValueInput } from './SavedValueInput';

const HomeIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

interface HomeLocationConfigProps {
  lat: string;
  lng: string;
  radius: string;
  setHomeLocation: (loc: { lat: string; lng: string; radius: string }) => void;
  isSaving: boolean;
  onSave: () => void;
  hasChanges: boolean;
  isLoading: boolean;
}

export const HomeLocationConfig: React.FC<HomeLocationConfigProps> = ({
  lat,
  lng,
  radius,
  setHomeLocation,
  isSaving,
  onSave,
  hasChanges,
  isLoading,
}) => (
  <AdminCard title="Home Location" icon={HomeIcon} color="from-purple-600 to-fuchsia-600">
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Latitude</label>
          <input
            type="text"
            value={lat}
            onChange={(e) => setHomeLocation({ lat: e.target.value, lng, radius })}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Longitude</label>
          <input
            type="text"
            value={lng}
            onChange={(e) => setHomeLocation({ lat, lng: e.target.value, radius })}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Radius (meters)</label>
        <input
          type="text"
          value={radius}
          onChange={(e) => setHomeLocation({ lat, lng, radius: e.target.value })}
          className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5 text-white outline-none focus:border-purple-500/50 transition-colors"
        />
      </div>
      <button
        onClick={onSave}
        disabled={isSaving || !hasChanges || isLoading}
        className={`w-full py-2.5 rounded-lg font-medium transition-all ${
          hasChanges
            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        {isSaving ? 'Saving...' : 'Save Home Location'}
      </button>
    </div>
  </AdminCard>
);
