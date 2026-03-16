import React from 'react';
import { AdminCard } from '../components/AdminCard';
import { usePgAdmin } from '../hooks/usePgAdmin';

const DatabaseIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
);

const RocketIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M5 13c1.5 1.5 4 2 6 2s4.5-.5 6-2c1.5-1.5 2-4 2-6s-.5-4.5-2-6c-1.5 1.5-4 2-6 2s-4.5-.5-6-2c-1.5 1.5-2 4-2 6s.5 4.5 2 6z" />
    <path d="M12 15v6" />
    <path d="M9 18h6" />
  </svg>
);

export const PgAdminTab: React.FC = () => {
  const {
    status,
    isLoading,
    actionLoading,
    error,
    actionMessage,
    refreshStatus,
    startPgAdmin,
    stopPgAdmin,
    destroyPgAdmin,
  } = usePgAdmin();

  const container = status?.container;
  const enabled = status?.enabled ?? false;
  const exists = container?.exists ?? false;
  const running = container?.running ?? false;

  const statusLabel = running ? 'Running' : exists ? 'Stopped' : 'Not Found';
  const statusBadgeClass = running
    ? 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50'
    : exists
      ? 'bg-amber-900/30 text-amber-300 border-amber-700/50'
      : 'bg-red-900/30 text-red-300 border-red-700/50';

  const handleStart = async () => {
    await startPgAdmin(false);
  };

  const handleReset = async () => {
    const confirmed = window.confirm(
      'Resetting PgAdmin will delete the pgadmin data volume and remove saved connections. Continue?'
    );
    if (!confirmed) return;
    await startPgAdmin(true);
  };

  const handleStop = async () => {
    await stopPgAdmin();
  };

  const handleDestroy = async (removeVolume: boolean) => {
    const warning = removeVolume
      ? 'Destroying PgAdmin with data will remove the container and delete the pgadmin data volume. Continue?'
      : 'Destroy the PgAdmin container? Saved data volume will be kept.';
    const confirmed = window.confirm(warning);
    if (!confirmed) return;
    await destroyPgAdmin(removeVolume);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <AdminCard icon={DatabaseIcon} title="PgAdmin Status" color="from-slate-500 to-slate-600">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Container</span>
            <span className={`px-2 py-1 rounded-md text-xs border ${statusBadgeClass}`}>
              {statusLabel}
            </span>
          </div>

          <div className="text-xs text-slate-500 space-y-2">
            <div className="flex justify-between gap-3">
              <span>Docker host</span>
              <span className="text-slate-200 font-mono text-[11px]">
                {status?.dockerHost || 'unknown'}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Container name</span>
              <span className="text-slate-200 font-mono text-[11px]">
                {status?.containerName || 'shadowcheck_pgadmin'}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Compose file</span>
              <span className="text-slate-200 font-mono text-[11px] text-right">
                {status?.composeFile || 'docker/infrastructure/docker-compose.postgres.yml'}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Data volume</span>
              <span className="text-slate-200 font-mono text-[11px]">
                {status?.volumeName || 'shadowcheck_pgadmin_data'}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Port</span>
              <span className="text-slate-200">{status?.port || 5050}</span>
            </div>
          </div>

          {status?.url && (
            <button
              onClick={() => window.open(status.url, '_blank', 'noopener,noreferrer')}
              disabled={!running}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-500 hover:to-blue-600 transition-all disabled:opacity-50 text-sm"
            >
              Open PgAdmin
            </button>
          )}

          <button
            onClick={refreshStatus}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-slate-800/80 text-slate-200 rounded-lg font-medium hover:bg-slate-700/80 transition-all disabled:opacity-50 text-sm"
          >
            {isLoading ? 'Refreshing...' : 'Refresh Status'}
          </button>

          {status && !status.composeFileExists && (
            <div className="p-3 rounded-lg text-xs bg-red-900/30 text-red-300 border border-red-700/50">
              Compose file not found. Set PGADMIN_COMPOSE_FILE to the correct path.
            </div>
          )}

          {status && !status.dockerAvailable && (
            <div className="p-3 rounded-lg text-xs bg-red-900/30 text-red-300 border border-red-700/50">
              Docker CLI not available for the API process. Run the server on the host or expose
              Docker to it.
            </div>
          )}

          {status?.error && !error && (
            <div className="p-3 rounded-lg text-xs bg-red-900/30 text-red-300 border border-red-700/50">
              {status.error}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg text-xs bg-red-900/30 text-red-300 border border-red-700/50">
              {error}
            </div>
          )}
        </div>
      </AdminCard>

      <AdminCard icon={RocketIcon} title="PgAdmin Controls" color="from-indigo-500 to-indigo-600">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Create, stop, destroy, or recreate PgAdmin using the shared infrastructure compose file.
            Keep the saved volume when you only want to remove the container.
          </p>

          {!enabled && (
            <div className="p-3 rounded-lg text-xs bg-amber-900/30 text-amber-300 border border-amber-700/50">
              Docker controls are disabled. Set ADMIN_ALLOW_DOCKER=true and restart the API server.
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={!enabled || actionLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg font-medium hover:from-emerald-500 hover:to-emerald-600 transition-all disabled:opacity-50 text-sm"
          >
            {actionLoading ? 'Working...' : exists ? 'Start / Recreate PgAdmin' : 'Create PgAdmin'}
          </button>

          <button
            onClick={handleReset}
            disabled={!enabled || actionLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-medium hover:from-red-500 hover:to-red-600 transition-all disabled:opacity-50 text-sm"
          >
            {actionLoading ? 'Working...' : 'Reset & Start Fresh'}
          </button>

          <button
            onClick={handleStop}
            disabled={!enabled || actionLoading || !running}
            className="w-full px-4 py-2.5 bg-slate-800/80 text-slate-200 rounded-lg font-medium hover:bg-slate-700/80 transition-all disabled:opacity-50 text-sm"
          >
            {actionLoading ? 'Working...' : 'Stop PgAdmin'}
          </button>

          <button
            onClick={() => handleDestroy(false)}
            disabled={!enabled || actionLoading || !exists}
            className="w-full px-4 py-2.5 bg-amber-900/60 text-amber-200 rounded-lg font-medium hover:bg-amber-800/70 transition-all disabled:opacity-50 text-sm"
          >
            {actionLoading ? 'Working...' : 'Destroy Container Only'}
          </button>

          <button
            onClick={() => handleDestroy(true)}
            disabled={!enabled || actionLoading || (!exists && !status?.volumeName)}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-rose-700 to-red-700 text-white rounded-lg font-medium hover:from-rose-600 hover:to-red-600 transition-all disabled:opacity-50 text-sm"
          >
            {actionLoading ? 'Working...' : 'Destroy Container + Data'}
          </button>

          {actionMessage && (
            <div className="p-3 rounded-lg text-xs bg-emerald-900/30 text-emerald-300 border border-emerald-700/50">
              {actionMessage}
            </div>
          )}

          <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/50 space-y-1">
            <p>• Controls Docker on: {status?.dockerHost || 'this API host'}</p>
            <p>• Uses docker-compose in docker/infrastructure</p>
            <p>• Destroy Container keeps the data volume for later recreation</p>
            <p>• Destroy Container + Data removes the pgadmin data volume</p>
            <p>• Restart policy is enforced as unless-stopped</p>
            <p>• PgAdmin listens on port {status?.port || 5050}</p>
            <p>• Stop frees resources without deleting data</p>
          </div>
        </div>
      </AdminCard>
    </div>
  );
};
