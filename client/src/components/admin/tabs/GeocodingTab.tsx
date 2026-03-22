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

const MetricLabel: React.FC<{ label: string; tooltip: string }> = ({ label, tooltip }) => (
  <div className="text-xs text-slate-400 flex items-center gap-1">
    <span>{label}</span>
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-slate-300 cursor-help"
      title={tooltip}
      aria-label={`${label} info`}
    >
      ?
    </span>
  </div>
);

export const GeocodingTab: React.FC = () => {
  const [limit, setLimit] = useState(1000);
  const [precision, setPrecision] = useState(4);
  const [perMinute, setPerMinute] = useState(60);
  const [permanent, setPermanent] = useState(false);
  const [addressProvider, setAddressProvider] = useState<
    'mapbox' | 'nominatim' | 'opencage' | 'geocodio' | 'locationiq'
  >('locationiq');

  const {
    stats,
    isLoading,
    actionLoading,
    error,
    actionMessage,
    lastResult,
    probeLoading,
    probeResult,
    refreshStats,
    runGeocoding,
    testProvider,
  } = useGeocodingCache(precision);

  const runAddressPass = async () => {
    await runGeocoding({
      provider: addressProvider,
      mode: 'address-only',
      limit,
      precision,
      perMinute,
      permanent: addressProvider === 'mapbox' ? permanent : false,
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

  const runFallbackGeocodio = async () => {
    await runGeocoding({
      provider: 'geocodio',
      mode: 'address-only',
      limit,
      precision,
      perMinute: Math.min(perMinute, 60),
      permanent: false,
    });
  };

  const testSelectedProvider = async () => {
    await testProvider({
      provider: addressProvider,
      mode: 'address-only',
      limit,
      precision,
      perMinute,
      permanent: addressProvider === 'mapbox' ? permanent : false,
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <AdminCard icon={MapIcon} title="Geocoding Cache" color="from-indigo-500 to-indigo-600">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <MetricLabel
                label="Observations"
                tooltip="Total rows in app.observations (raw datapoints, not deduplicated)."
              />
              <div className="text-lg font-semibold text-white">
                {stats?.observation_count?.toLocaleString() || '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <MetricLabel
                label="Unique Blocks"
                tooltip="Unique rounded latitude/longitude cells at this precision."
              />
              <div className="text-lg font-semibold text-white">
                {stats?.unique_blocks?.toLocaleString() || '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <MetricLabel
                label="Cached Blocks"
                tooltip="How many rounded cells already have a geocoding cache row."
              />
              <div className="text-lg font-semibold text-white">
                {stats?.cached_blocks?.toLocaleString() || '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <MetricLabel
                label="Missing Blocks"
                tooltip="Rounded cells seen in observations that still have no cache row."
              />
              <div className="text-lg font-semibold text-white">
                {stats?.missing_blocks?.toLocaleString() || '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <MetricLabel
                label="Resolved Rows"
                tooltip="Cache rows with a non-null resolved address."
              />
              <div className="text-lg font-semibold text-white">
                {stats?.resolved_address_rows?.toLocaleString() || '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <MetricLabel
                label="POI Hits"
                tooltip="Cache rows where a POI name was found (poi_name is not null)."
              />
              <div className="text-lg font-semibold text-white">
                {stats?.cached_with_poi?.toLocaleString() || '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <MetricLabel
                label="Pending Queue"
                tooltip="Unresolved cache rows that have not yet been attempted for address enrichment."
              />
              <div className="text-lg font-semibold text-white">
                {stats?.pending_address_queue?.toLocaleString() || '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <MetricLabel
                label="Attempted No Hit"
                tooltip="Unresolved cache rows that have already been attempted at least once."
              />
              <div className="text-lg font-semibold text-white">
                {stats?.attempted_without_address?.toLocaleString() || '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <MetricLabel
                label="Recent Activity"
                tooltip="Cache rows touched in the last 10 minutes."
              />
              <div className="text-lg font-semibold text-white">
                {stats?.recent_activity?.toLocaleString() || '—'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
              <MetricLabel
                label="Distinct Addresses"
                tooltip="Distinct non-null address strings currently stored in cache."
              />
              <div className="text-lg font-semibold text-white">
                {stats?.distinct_addresses?.toLocaleString() || '—'}
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
                Address Provider
              </label>
              <select
                value={addressProvider}
                onChange={(e) =>
                  setAddressProvider(
                    e.target.value as
                      | 'mapbox'
                      | 'nominatim'
                      | 'opencage'
                      | 'geocodio'
                      | 'locationiq'
                  )
                }
                className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 transition-all"
              >
                <option value="locationiq">LocationIQ</option>
                <option value="geocodio">Geocodio</option>
                <option value="opencage">OpenCage</option>
                <option value="nominatim">Nominatim</option>
                <option value="mapbox">Mapbox</option>
              </select>
            </div>
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
            {addressProvider === 'mapbox' ? (
              <div className="flex items-center space-x-2 mt-7">
                <input
                  type="checkbox"
                  checked={permanent}
                  onChange={(e) => setPermanent(e.target.checked)}
                  className="h-4 w-4 text-teal-500 bg-slate-800 border-slate-600 rounded"
                />
                <span className="text-sm text-slate-300">Permanent (Mapbox)</span>
              </div>
            ) : (
              <div className="flex items-center text-xs text-slate-400 mt-7">
                Permanent mode only applies to Mapbox.
              </div>
            )}
          </div>

          <div className="text-xs text-slate-400 border border-slate-700/50 bg-slate-900/40 rounded-lg p-3">
            POI skip enforced for 814/816 MLK via `poi_skip`.
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={testSelectedProvider}
              disabled={probeLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-violet-600 to-violet-700 text-white rounded-lg font-medium hover:from-violet-500 hover:to-violet-600 transition-all disabled:opacity-50 text-sm"
            >
              {probeLoading ? 'Testing...' : `Test ${addressProvider}`}
            </button>
            <button
              onClick={runAddressPass}
              disabled={actionLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg font-medium hover:from-teal-500 hover:to-teal-600 transition-all disabled:opacity-50 text-sm"
            >
              {actionLoading ? 'Running...' : `Update Addresses (${addressProvider})`}
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
              onClick={runFallbackGeocodio}
              disabled={actionLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-lime-600 to-lime-700 text-white rounded-lg font-medium hover:from-lime-500 hover:to-lime-600 transition-all disabled:opacity-50 text-sm"
            >
              {actionLoading ? 'Running...' : 'Fallback Addresses (Geocodio)'}
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
          {stats?.current_run && (
            <div className="p-3 rounded-lg text-xs text-cyan-300 border border-cyan-700/50 bg-cyan-950/20">
              Running now: {stats.current_run.provider} • {stats.current_run.mode} • precision{' '}
              {stats.current_run.precision} • limit {stats.current_run.limit}
            </div>
          )}
          {probeResult && (
            <div className="p-3 rounded-lg text-xs text-slate-300 border border-slate-700/50 bg-slate-900/40 space-y-1">
              <div>
                Probe: {probeResult.provider} • {probeResult.mode} • sample {probeResult.sample.lat}
                , {probeResult.sample.lon}
              </div>
              <div>
                Result: {probeResult.result.ok ? 'ok' : probeResult.result.error || 'no hit'}
              </div>
              {probeResult.result.address && <div>Address: {probeResult.result.address}</div>}
              {probeResult.result.poiName && <div>POI: {probeResult.result.poiName}</div>}
            </div>
          )}
          {stats?.last_run?.error && (
            <div className="p-3 rounded-lg text-xs text-amber-300 border border-amber-700/50 bg-amber-950/20">
              Last failure: {stats.last_run.provider} • {stats.last_run.error}
            </div>
          )}
        </div>
      </AdminCard>
      <AdminCard icon={SparkIcon} title="Recent Geocoding Jobs" color="from-slate-600 to-slate-700">
        <div className="space-y-2">
          {stats?.recent_runs?.length ? (
            stats.recent_runs.map((run) => (
              <div
                key={`${run.id ?? run.startedAt}-${run.provider}`}
                className="p-3 rounded-lg text-xs text-slate-300 border border-slate-700/50 bg-slate-900/40"
              >
                <div>
                  #{run.id ?? '—'} • {run.status} • {run.provider} • {run.mode}
                </div>
                <div>
                  precision {run.precision} • limit {run.limit} • rate {run.perMinute}/min
                </div>
                {run.result && (
                  <div>
                    {run.result.successful}/{run.result.processed} successful • rate limited{' '}
                    {run.result.rateLimited} • {Math.round(run.result.durationMs / 1000)}s
                  </div>
                )}
                {run.error && <div>Error: {run.error}</div>}
              </div>
            ))
          ) : (
            <div className="p-3 rounded-lg text-sm text-slate-400 border border-slate-700/50 bg-slate-900/40">
              No persisted geocoding job history yet.
            </div>
          )}
        </div>
      </AdminCard>
    </div>
  );
};
