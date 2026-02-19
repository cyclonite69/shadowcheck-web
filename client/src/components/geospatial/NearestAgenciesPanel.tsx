import React from 'react';
import type { Agency } from './useNearestAgencies';

interface NearestAgenciesPanelProps {
  agencies: Agency[];
  loading: boolean;
  error: string;
  networkCount?: number;
}

export const NearestAgenciesPanel: React.FC<NearestAgenciesPanelProps> = ({
  agencies,
  loading,
  error,
  networkCount = 1,
}) => {
  if (agencies.length === 0 && !loading) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '120px',
        right: '80px', // Shifted left to avoid +/- buttons
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgb(100, 116, 139)',
        borderRadius: '12px',
        padding: '16px',
        minWidth: '320px',
        maxWidth: '400px',
        maxHeight: '500px',
        zIndex: 1000,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Nearest Agencies</h2>
        {agencies.length > 0 && (
          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400">
            {agencies.length} found
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-3">
        {networkCount > 1
          ? `Agencies near all observation points from ${networkCount} networks (local + WiGLE)`
          : 'Agencies near all observation points (local + WiGLE)'}
      </p>

      {loading && <p className="text-slate-400 text-sm">Loading...</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="space-y-2 max-h-80 overflow-auto">
        {agencies.map((agency, idx) => (
          <div
            key={idx}
            className={`p-3 rounded border ${
              agency.has_wigle_obs
                ? 'bg-red-900/20 border-red-800/50'
                : 'bg-slate-800/70 border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-semibold text-sm text-slate-200">{agency.name}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {agency.office_type === 'field_office' ? '🏢 Field Office' : '📍 Resident Agency'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {agency.city}, {agency.state} {agency.postal_code}
                </div>
              </div>
              <div className="text-right ml-3">
                <div className="text-sm font-semibold text-blue-400">
                  {((agency.distance_meters || 0) / 1000).toFixed(1)} km
                </div>
                {agency.has_wigle_obs && (
                  <div className="text-xs text-red-400 mt-1">WiGLE data</div>
                )}
              </div>
            </div>
          </div>
        ))}
        {agencies.length === 0 && !loading && !error && (
          <p className="text-slate-500 text-sm">No agencies found nearby</p>
        )}
      </div>
    </div>
  );
};
