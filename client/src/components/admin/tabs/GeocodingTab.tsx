import React, { useState } from 'react';
import { AdminCard } from '../components/AdminCard';
import { useGeocodingCache } from '../hooks/useGeocodingCache';

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
    <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" />
    <path d="M9 4v14" />
    <path d="M15 6v14" />
  </svg>
);

const SparkIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2z" />
  </svg>
);

export const GeocodingTab: React.FC = () => {
  const {
    stats,
    isLoading,
    actionLoading,
    error,
    actionMessage,
    lastResult,
    refreshStats,
    runGeocoding,
  } = useGeocodingCache(5);

  const [limit, setLimit] = useState(1000);
  const [precision, setPrecision] = useState(5);
  const [perMinute, setPerMinute] = useState(200);
  const [permanent, setPermanent] = useState(true);

  const runAddressPass = async () => {
    await runGeocoding({
      provider: 'mapbox',
      mode: 'address-only',
      limit,
      precision,
      perMinute,
      permanent,
    });
  };

  const runPoiPass = async () => {
    await runGeocoding({
      provider: 'overpass',
      mode: 'poi-only',
      limit,
      precision,
      perMinute: Math.min(perMinute, 60),
      permanent: false,
    });
  };

  const runFallbackPass = async () => {
    await runGeocoding({
      provider: 'nominatim',
      mode: 'address-only',
      limit,
      precision,
      perMinute: Math.min(perMinute, 60),
      permanent: false,
    });
  };

  const runFallbackOpenCage = async () => {
    await runGeocoding({
      provider: 'opencage',
      mode: 'address-only',
      limit,
      precision,
      perMinute: Math.min(perMinute, 60),
      permanent: false,
    });
  };

  const runFallbackLocationIq = async () => {
    await runGeocoding({
      provider: 'locationiq',
      mode: 'address-only',
      limit,
      precision,
      perMinute: Math.min(perMinute, 60),
      permanent: false,
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
      <AdminCard icon={MapIcon} title="Geocoding Cache" color="from-indigo-500 to-indigo-600">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <div className="text-xs text-slate-400">Observations</div>
              <div className="text-lg font-semibold text-white">
                {stats?.observation_count?.toLocaleString() || '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <div className="text-xs text-slate-400">Unique Blocks</div>
              <div className="text-lg font-semibold text-white">
                {stats?.unique_blocks?.toLocaleString() || '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <div className="text-xs text-slate-400">Cached Blocks</div>
              <div className="text-lg font-semibold text-white">
                {stats?.cached_blocks?.toLocaleString() || '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <div className="text-xs text-slate-400">Missing Blocks</div>
              <div className="text-lg font-semibold text-white">
                {stats?.missing_blocks?.toLocaleString() || '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <div className="text-xs text-slate-400">Addresses</div>
              <div className="text-lg font-semibold text-white">
                {stats?.distinct_addresses?.toLocaleString() || '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <div className="text-xs text-slate-400">POI Hits</div>
              <div className="text-lg font-semibold text-white">
                {stats?.cached_with_poi?.toLocaleString() || '—'}
              </div>
            </div>
          </div>

          <button
            onClick={refreshStats}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg font-medium hover:from-indigo-500 hover:to-indigo-600 transition-all disabled:opacity-50 text-sm"
          >
            {isLoading ? 'Refreshing...' : 'Refresh Stats'}
          </button>
        </div>
      </AdminCard>

      <AdminCard icon={SparkIcon} title="Geocoding Runs" color="from-teal-500 to-teal-600">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Batch Size
              </label>
              <input
                type="number"
                min="1"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value || '0', 10))}
                className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Precision
              </label>
              <input
                type="number"
                min="3"
                max="6"
                value={precision}
                onChange={(e) => setPrecision(parseInt(e.target.value || '5', 10))}
                className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Rate / Minute
              </label>
              <input
                type="number"
                min="1"
                value={perMinute}
                onChange={(e) => setPerMinute(parseInt(e.target.value || '0', 10))}
                className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 transition-all"
              />
            </div>
            <div className="flex items-center space-x-2 mt-7">
              <input
                type="checkbox"
                checked={permanent}
                onChange={(e) => setPermanent(e.target.checked)}
                className="h-4 w-4 text-teal-500 bg-slate-800 border-slate-600 rounded"
              />
              <span className="text-sm text-slate-300">Permanent (Mapbox)</span>
            </div>
          </div>

          <div className="text-xs text-slate-400 border border-slate-700/50 bg-slate-900/40 rounded-lg p-3">
            POI skip enforced for 814/816 MLK via `poi_skip`.
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={runAddressPass}
              disabled={actionLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg font-medium hover:from-teal-500 hover:to-teal-600 transition-all disabled:opacity-50 text-sm"
            >
              {actionLoading ? 'Running...' : 'Update Addresses (Mapbox)'}
            </button>
            <button
              onClick={runPoiPass}
              disabled={actionLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-700 text-white rounded-lg font-medium hover:from-cyan-500 hover:to-cyan-600 transition-all disabled:opacity-50 text-sm"
            >
              {actionLoading ? 'Running...' : 'Update POI (Overpass)'}
            </button>
            <button
              onClick={runFallbackPass}
              disabled={actionLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg font-medium hover:from-slate-500 hover:to-slate-600 transition-all disabled:opacity-50 text-sm"
            >
              {actionLoading ? 'Running...' : 'Fallback Addresses (Nominatim)'}
            </button>
            <button
              onClick={runFallbackOpenCage}
              disabled={actionLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg font-medium hover:from-amber-500 hover:to-amber-600 transition-all disabled:opacity-50 text-sm"
            >
              {actionLoading ? 'Running...' : 'Fallback Addresses (OpenCage)'}
            </button>
            <button
              onClick={runFallbackLocationIq}
              disabled={actionLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg font-medium hover:from-emerald-500 hover:to-emerald-600 transition-all disabled:opacity-50 text-sm"
            >
              {actionLoading ? 'Running...' : 'Fallback Addresses (LocationIQ)'}
            </button>
          </div>

          {actionMessage && (
            <div className="p-3 rounded-lg text-sm bg-green-900/30 text-green-300 border border-green-700/50">
              {actionMessage}
            </div>
          )}
          {error && (
            <div className="p-3 rounded-lg text-sm bg-red-900/30 text-red-300 border border-red-700/50">
              {error}
            </div>
          )}
          {lastResult && (
            <div className="p-3 rounded-lg text-xs text-slate-300 border border-slate-700/50 bg-slate-900/40">
              Last run: {lastResult.provider} • {lastResult.mode} • {lastResult.successful}/
              {lastResult.processed} • {Math.round(lastResult.durationMs / 1000)}s
            </div>
          )}
        </div>
      </AdminCard>
    </div>
  );
};
