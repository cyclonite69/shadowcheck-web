import React from 'react';
import { AdminCard } from '../components/AdminCard';
import { useBackups } from '../hooks/useBackups';

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

const ShieldIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />
  </svg>
);

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const decimals = value >= 10 || index === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[index]}`;
};

export const BackupsTab: React.FC = () => {
  const { backupLoading, backupResult, backupError, runBackup } = useBackups();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      <AdminCard
        icon={DatabaseIcon}
        title="Full Database Backup"
        color="from-emerald-500 to-emerald-600"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Creates a full PostgreSQL backup (custom format) on the server.
          </p>
          <button
            onClick={runBackup}
            disabled={backupLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg font-semibold hover:from-emerald-500 hover:to-emerald-600 transition-all disabled:opacity-50"
          >
            {backupLoading ? 'Running Backup...' : 'Run Full Backup'}
          </button>
          {backupError && (
            <div className="p-3 rounded-lg text-sm bg-red-900/50 text-red-300 border border-red-700">
              {backupError}
            </div>
          )}
          {backupResult && (
            <div className="p-3 rounded-lg text-sm bg-emerald-900/40 text-emerald-200 border border-emerald-700/60 space-y-1">
              <div>
                <span className="text-emerald-300">File:</span> {backupResult.fileName}
              </div>
              <div>
                <span className="text-emerald-300">Size:</span> {formatBytes(backupResult.bytes)}
              </div>
              <div>
                <span className="text-emerald-300">Path:</span> {backupResult.filePath}
              </div>
            </div>
          )}
        </div>
      </AdminCard>

      <AdminCard icon={ShieldIcon} title="Backup Notes" color="from-slate-500 to-slate-600">
        <div className="space-y-3 text-sm text-slate-400">
          <p>Backups are stored locally on the server and are not uploaded anywhere yet.</p>
          <p>
            Configure the storage path with <span className="text-slate-200">BACKUP_DIR</span> in
            your environment.
          </p>
          <p>
            Retention is controlled by <span className="text-slate-200">BACKUP_RETENTION_DAYS</span>{' '}
            (default 14).
          </p>
        </div>
      </AdminCard>
    </div>
  );
};
