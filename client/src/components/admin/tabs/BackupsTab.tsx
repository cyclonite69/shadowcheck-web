import React from 'react';
import { AdminCard } from '../components/AdminCard';
import { useBackups } from '../hooks/useBackups';
import { formatShortDate } from '../../../utils/formatDate';

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
  const {
    backupLoading,
    backupResult,
    backupError,
    runBackup,
    s3Backups,
    s3Loading,
    loadS3Backups,
    deleteS3Backup,
  } = useBackups();

  // Load S3 backups on component mount
  React.useEffect(() => {
    loadS3Backups();
  }, []);

  const handleDeleteS3Backup = async (key: string, fileName: string) => {
    if (!window.confirm(`Delete backup "${fileName}" from S3? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteS3Backup(key);
    } catch (err: any) {
      alert(`Failed to delete backup: ${err.message}`);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Backup Actions */}
      <AdminCard
        icon={DatabaseIcon}
        title="Database Backup"
        color="from-emerald-500 to-emerald-600"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Creates a complete PostgreSQL backup in custom format. Choose local storage or upload to
            S3.
          </p>

          <button
            onClick={() => runBackup(false)}
            disabled={backupLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg font-medium hover:from-emerald-500 hover:to-emerald-600 transition-all disabled:opacity-50 text-sm"
          >
            {backupLoading ? 'Running Backup...' : 'Local Backup Only'}
          </button>

          <button
            onClick={() => runBackup(true)}
            disabled={backupLoading}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-500 hover:to-blue-600 transition-all disabled:opacity-50 text-sm"
          >
            {backupLoading ? 'Running Backup...' : 'Backup + Upload to S3'}
          </button>

          {backupError && (
            <div className="p-3 rounded-lg text-sm bg-red-900/30 text-red-300 border border-red-700/50">
              {backupError}
            </div>
          )}
        </div>
      </AdminCard>

      {/* Backup Results */}
      <AdminCard icon={ShieldIcon} title="Backup Details" color="from-slate-500 to-slate-600">
        <div className="space-y-3">
          {backupResult ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-emerald-900/30 border border-emerald-700/50">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-emerald-300">File:</span>
                    <span className="text-slate-100 font-mono text-xs break-all max-w-[200px]">
                      {backupResult.fileName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-300">Size:</span>
                    <span className="text-slate-100 font-medium">
                      {formatBytes(backupResult.bytes)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-300">Local Path:</span>
                    <span className="text-slate-100 font-mono text-xs break-all max-w-[200px]">
                      {backupResult.filePath}
                    </span>
                  </div>
                  {backupResult.source && (
                    <div className="flex justify-between">
                      <span className="text-emerald-300">Source:</span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          backupResult.source.environment === 'aws-ec2'
                            ? 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
                            : 'bg-cyan-900/40 text-cyan-300 border border-cyan-700/50'
                        }`}
                      >
                        {backupResult.source.environment === 'aws-ec2'
                          ? `EC2 (${backupResult.source.instanceId})`
                          : `Local (${backupResult.source.hostname})`}
                      </span>
                    </div>
                  )}
                  {backupResult.s3 && (
                    <div className="flex justify-between">
                      <span className="text-blue-300">S3 Location:</span>
                      <span className="text-slate-100 font-mono text-xs break-all max-w-[200px]">
                        {backupResult.s3.url}
                      </span>
                    </div>
                  )}
                  {backupResult.s3Error && (
                    <div className="p-2 rounded bg-red-900/30 border border-red-700/50">
                      <span className="text-red-300 text-xs">
                        S3 Upload Failed: {backupResult.s3Error}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400">
              <p className="text-sm">No backup yet</p>
              <p className="text-xs mt-1">Run a backup to see details</p>
            </div>
          )}
          <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-700/50">
            <p>• Local backups stored on server</p>
            <p>• S3 backups use STANDARD_IA storage class</p>
            <p>• S3 bucket comes from runtime configuration</p>
            <p>• Retention: 14 days (default)</p>
          </div>
        </div>
      </AdminCard>

      {/* S3 Backup Management */}
      <AdminCard icon={ShieldIcon} title="S3 Backup Management" color="from-blue-500 to-blue-600">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-400">Manage backups in the configured S3 bucket</p>
            <button
              onClick={loadS3Backups}
              disabled={s3Loading}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-500 disabled:opacity-50"
            >
              {s3Loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2">
            {s3Backups.length > 0 ? (
              s3Backups.map((backup) => (
                <div
                  key={backup.key}
                  className="p-2 bg-slate-800/50 rounded border border-slate-700/50"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-slate-200 break-all">
                        {backup.fileName}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                        <span>{formatBytes(backup.size)}</span>
                        <span>•</span>
                        <span>{formatShortDate(backup.lastModified)}</span>
                        {backup.sourceEnv && backup.sourceEnv !== 'unknown' && (
                          <>
                            <span>•</span>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                backup.sourceEnv === 'aws-ec2'
                                  ? 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
                                  : 'bg-cyan-900/40 text-cyan-300 border border-cyan-700/50'
                              }`}
                            >
                              {backup.sourceEnv === 'aws-ec2' ? 'EC2' : 'LOCAL'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteS3Backup(backup.key, backup.fileName)}
                      className="ml-2 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-slate-400">
                <p className="text-sm">No S3 backups found</p>
                <p className="text-xs mt-1">Upload a backup to see it here</p>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-slate-700/50">
            <p>• Bucket: runtime-configured</p>
            <p>• Storage class: STANDARD_IA</p>
            <p>• Deletions are permanent</p>
          </div>
        </div>
      </AdminCard>
    </div>
  );
};
