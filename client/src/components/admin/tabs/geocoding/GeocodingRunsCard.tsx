import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import type {
  GeocodingDaemonStatus,
  GeocodingProviderProbeResult,
  GeocodingRunResult,
  GeocodingStats,
} from '../../types/admin.types';
import { SparkIcon } from './GeocodingIcons';

type Provider = 'mapbox' | 'nominatim' | 'opencage' | 'geocodio' | 'locationiq';

export const GeocodingRunsCard: React.FC<{
  stats: GeocodingStats | null;
  daemon: GeocodingDaemonStatus | null;
  actionLoading: boolean;
  probeLoading: boolean;
  actionMessage: string;
  error: string;
  lastResult: GeocodingRunResult | null;
  probeResult: GeocodingProviderProbeResult | null;
  limit: number;
  setLimit: (value: number) => void;
  precision: number;
  setPrecision: (value: number) => void;
  perMinute: number;
  setPerMinute: (value: number) => void;
  permanent: boolean;
  setPermanent: (value: boolean) => void;
  addressProvider: Provider;
  setAddressProvider: (value: Provider) => void;
  runAddressPass: () => Promise<void>;
  runPoiPass: () => Promise<void>;
  runFallbackPass: () => Promise<void>;
  runFallbackOpenCage: () => Promise<void>;
  runFallbackGeocodio: () => Promise<void>;
  runFallbackLocationIq: () => Promise<void>;
  testSelectedProvider: () => Promise<void>;
}> = ({
  stats,
  daemon,
  actionLoading,
  probeLoading,
  actionMessage,
  error,
  lastResult,
  probeResult,
  limit,
  setLimit,
  precision,
  setPrecision,
  perMinute,
  setPerMinute,
  permanent,
  setPermanent,
  addressProvider,
  setAddressProvider,
  runAddressPass,
  runPoiPass,
  runFallbackPass,
  runFallbackOpenCage,
  runFallbackGeocodio,
  runFallbackLocationIq,
  testSelectedProvider,
}) => {
  const formatSeconds = (ms?: number) => {
    if (!ms && ms !== 0) return '—';
    return `${Math.round(ms / 1000)}s`;
  };

  return (
    <>
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
                onChange={(e) => setAddressProvider(e.target.value as Provider)}
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
              onClick={() => void testSelectedProvider()}
              disabled={probeLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-violet-600 to-violet-700 text-white rounded-lg font-medium hover:from-violet-500 hover:to-violet-600 transition-all disabled:opacity-50 text-sm"
            >
              {probeLoading ? 'Testing...' : `Test ${addressProvider}`}
            </button>
            <button
              onClick={() => void runAddressPass()}
              disabled={actionLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg font-medium hover:from-teal-500 hover:to-teal-600 transition-all disabled:opacity-50 text-sm"
            >
              {actionLoading ? 'Running...' : `Update Addresses (${addressProvider})`}
            </button>
            <button
              onClick={() => void runPoiPass()}
              disabled={actionLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-700 text-white rounded-lg font-medium hover:from-cyan-500 hover:to-cyan-600 transition-all disabled:opacity-50 text-sm"
            >
              {actionLoading ? 'Running...' : 'Update POI (Overpass)'}
            </button>
            <button
              onClick={() => void runFallbackPass()}
              disabled={actionLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg font-medium hover:from-slate-500 hover:to-slate-600 transition-all disabled:opacity-50 text-sm"
            >
              {actionLoading ? 'Running...' : 'Fallback Addresses (Nominatim)'}
            </button>
            <button
              onClick={() => void runFallbackOpenCage()}
              disabled={actionLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg font-medium hover:from-amber-500 hover:to-amber-600 transition-all disabled:opacity-50 text-sm"
            >
              {actionLoading ? 'Running...' : 'Fallback Addresses (OpenCage)'}
            </button>
            <button
              onClick={() => void runFallbackGeocodio()}
              disabled={actionLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-lime-600 to-lime-700 text-white rounded-lg font-medium hover:from-lime-500 hover:to-lime-600 transition-all disabled:opacity-50 text-sm"
            >
              {actionLoading ? 'Running...' : 'Fallback Addresses (Geocodio)'}
            </button>
            <button
              onClick={() => void runFallbackLocationIq()}
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
          {daemon?.config && (
            <div className="p-3 rounded-lg text-xs text-rose-200 border border-rose-700/40 bg-rose-950/20">
              Daemon config: {daemon.config.provider} address loop • overpass POI • delay{' '}
              {formatSeconds(daemon.config.loopDelayMs)} • idle{' '}
              {formatSeconds(daemon.config.idleSleepMs)}
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
    </>
  );
};
