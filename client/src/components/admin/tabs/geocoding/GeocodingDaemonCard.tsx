import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import type { GeocodingDaemonStatus } from '../../types/admin.types';
import { ClockIcon } from './GeocodingIcons';

type Provider = 'mapbox' | 'nominatim' | 'opencage' | 'geocodio' | 'locationiq';

export const GeocodingDaemonCard: React.FC<{
  daemon: GeocodingDaemonStatus | null;
  actionLoading: boolean;
  precision: number;
  setPrecision: (value: number) => void;
  daemonLimit: number;
  setDaemonLimit: (value: number) => void;
  daemonPerMinute: number;
  setDaemonPerMinute: (value: number) => void;
  loopDelayMs: number;
  setLoopDelayMs: (value: number) => void;
  idleSleepMs: number;
  setIdleSleepMs: (value: number) => void;
  errorSleepMs: number;
  setErrorSleepMs: (value: number) => void;
  daemonAddressProvider: Provider;
  setDaemonAddressProvider: (value: Provider) => void;
  daemonPermanent: boolean;
  setDaemonPermanent: (value: boolean) => void;
  applyPersistedDaemonConfig: () => void;
  startContinuousDaemon: () => Promise<void>;
  stopDaemon: () => Promise<void>;
}> = ({
  daemon,
  actionLoading,
  precision,
  setPrecision,
  daemonLimit,
  setDaemonLimit,
  daemonPerMinute,
  setDaemonPerMinute,
  loopDelayMs,
  setLoopDelayMs,
  idleSleepMs,
  setIdleSleepMs,
  errorSleepMs,
  setErrorSleepMs,
  daemonAddressProvider,
  setDaemonAddressProvider,
  daemonPermanent,
  setDaemonPermanent,
  applyPersistedDaemonConfig,
  startContinuousDaemon,
  stopDaemon,
}) => {
  const formatSeconds = (ms?: number) => {
    if (!ms && ms !== 0) return '—';
    return `${Math.round(ms / 1000)}s`;
  };

  return (
    <AdminCard icon={ClockIcon} title="Geocoding Daemon" color="from-rose-500 to-rose-600">
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 text-sm text-slate-300 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Status
            </span>
            <span
              className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                daemon?.running
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-700/50 text-slate-300 border border-slate-600/50'
              }`}
            >
              {daemon?.running ? 'Running' : daemon?.stopRequested ? 'Stopping' : 'Stopped'}
            </span>
          </div>
          <div>
            Last tick: {daemon?.lastTickAt ? new Date(daemon.lastTickAt).toLocaleString() : '—'}
          </div>
          <div>
            Started: {daemon?.startedAt ? new Date(daemon.startedAt).toLocaleString() : '—'}
          </div>
          <div>
            Last result:{' '}
            {daemon?.lastResult
              ? `${daemon.lastResult.successful}/${daemon.lastResult.processed} in ${Math.round(
                  daemon.lastResult.durationMs / 1000
                )}s`
              : '—'}
          </div>
          {daemon?.lastError && (
            <div className="rounded border border-amber-700/50 bg-amber-950/30 p-2 text-amber-300">
              Last daemon error: {daemon.lastError}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Address Provider
            </label>
            <select
              value={daemonAddressProvider}
              onChange={(e) => setDaemonAddressProvider(e.target.value as Provider)}
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all"
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
              Batch Size
            </label>
            <input
              type="number"
              min="1"
              value={daemonLimit}
              onChange={(e) => setDaemonLimit(parseInt(e.target.value || '0', 10))}
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Rate / Minute
            </label>
            <input
              type="number"
              min="1"
              value={daemonPerMinute}
              onChange={(e) => setDaemonPerMinute(parseInt(e.target.value || '0', 10))}
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all"
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
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Loop Delay
            </label>
            <input
              type="number"
              min="1000"
              step="1000"
              value={loopDelayMs}
              onChange={(e) => setLoopDelayMs(parseInt(e.target.value || '0', 10))}
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all"
            />
            <div className="mt-1 text-[11px] text-slate-500">{formatSeconds(loopDelayMs)}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Idle Sleep
            </label>
            <input
              type="number"
              min="1000"
              step="1000"
              value={idleSleepMs}
              onChange={(e) => setIdleSleepMs(parseInt(e.target.value || '0', 10))}
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all"
            />
            <div className="mt-1 text-[11px] text-slate-500">{formatSeconds(idleSleepMs)}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Error Sleep
            </label>
            <input
              type="number"
              min="1000"
              step="1000"
              value={errorSleepMs}
              onChange={(e) => setErrorSleepMs(parseInt(e.target.value || '0', 10))}
              className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-all"
            />
            <div className="mt-1 text-[11px] text-slate-500">{formatSeconds(errorSleepMs)}</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
          <div className="text-xs text-slate-400">
            The daemon currently persists one address provider plus an Overpass POI pass.
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={daemonPermanent}
              onChange={(e) => setDaemonPermanent(e.target.checked)}
              disabled={daemonAddressProvider !== 'mapbox'}
              className="h-4 w-4 text-rose-500 bg-slate-800 border-slate-600 rounded"
            />
            Permanent
          </label>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => void startContinuousDaemon()}
            disabled={actionLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-lg font-medium hover:from-rose-500 hover:to-rose-600 transition-all disabled:opacity-50 text-sm"
          >
            {actionLoading
              ? 'Working...'
              : daemon?.running
                ? 'Update / Keep Daemon Running'
                : 'Start Daemon'}
          </button>
          <button
            onClick={() => void stopDaemon()}
            disabled={actionLoading || !daemon?.running}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-lg font-medium hover:from-slate-600 hover:to-slate-700 transition-all disabled:opacity-50 text-sm"
          >
            {actionLoading ? 'Working...' : 'Stop Daemon'}
          </button>
          <button
            onClick={applyPersistedDaemonConfig}
            disabled={!daemon?.config}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-fuchsia-700 to-fuchsia-800 text-white rounded-lg font-medium hover:from-fuchsia-600 hover:to-fuchsia-700 transition-all disabled:opacity-50 text-sm"
          >
            Load Persisted Settings
          </button>
        </div>
      </div>
    </AdminCard>
  );
};
