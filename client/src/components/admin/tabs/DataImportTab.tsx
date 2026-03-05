import React, { useEffect, useState } from 'react';
import { AdminCard } from '../components/AdminCard';
import { useDataImport } from '../hooks/useDataImport';
import { adminApi } from '../../../api/adminApi';
import { SourceTagInput } from '../components/SourceTagInput';

const UploadIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

interface Metrics {
  networks: number;
  access_points: number;
  observations: number;
  in_explorer_mv: number;
}

interface ImportRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  source_tag: string;
  filename: string | null;
  imported: number | null;
  failed: number | null;
  duration_s: string | null;
  status: 'running' | 'success' | 'failed';
  error_detail: string | null;
  metrics_before: Metrics | null;
  metrics_after: Metrics | null;
  backup_taken: boolean;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

function diff(after: number | undefined, before: number | undefined): React.ReactNode {
  if (after == null || before == null) return null;
  const d = after - before;
  if (d === 0) return <span className="text-slate-500 text-xs ml-1">(+0)</span>;
  return (
    <span className={`text-xs ml-1 ${d > 0 ? 'text-green-400' : 'text-red-400'}`}>
      ({d > 0 ? '+' : ''}
      {d.toLocaleString()})
    </span>
  );
}

function MetricsTable({ before, after }: { before: Metrics | null; after: Metrics | null }) {
  const rows: { label: string; key: keyof Metrics }[] = [
    { label: 'Networks', key: 'networks' },
    { label: 'Access Points', key: 'access_points' },
    { label: 'Observations', key: 'observations' },
    { label: 'Explorer MV', key: 'in_explorer_mv' },
  ];

  return (
    <table className="text-xs text-slate-300 w-full mt-2">
      <thead>
        <tr className="text-slate-500 border-b border-slate-700/50">
          <th className="text-left py-1 pr-4">Table</th>
          <th className="text-right py-1 pr-4">Before</th>
          <th className="text-right py-1">After</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, key }) => (
          <tr key={key} className="border-b border-slate-800/40">
            <td className="py-1 pr-4 text-slate-400">{label}</td>
            <td className="py-1 pr-4 text-right tabular-nums">{fmt(before?.[key])}</td>
            <td className="py-1 text-right tabular-nums">
              {fmt(after?.[key])}
              {diff(after?.[key], before?.[key])}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExpandedRow({ run }: { run: ImportRun }) {
  return (
    <tr>
      <td colSpan={8} className="bg-slate-900/80 border-b border-slate-700/50 px-4 py-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">Before / After</p>
            <MetricsTable before={run.metrics_before} after={run.metrics_after} />
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            <p>
              <span className="text-slate-500">File:</span> {run.filename ?? '—'}
            </p>
            <p>
              <span className="text-slate-500">Duration:</span>{' '}
              {run.duration_s ? `${run.duration_s}s` : '—'}
            </p>
            <p>
              <span className="text-slate-500">Backup:</span>{' '}
              {run.backup_taken ? '✓ taken before import' : '✗ skipped'}
            </p>
            {run.error_detail && (
              <div className="mt-2 p-2 bg-red-900/20 border border-red-700/40 rounded text-red-300 font-mono break-all">
                {run.error_detail}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function ImportHistory({ refreshKey }: { refreshKey: number }) {
  const [history, setHistory] = useState<ImportRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLoading(true);
    adminApi
      .getImportHistory(10)
      .then((data: any) => setHistory(data?.history ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (loading) return <p className="text-sm text-slate-500 py-2">Loading history...</p>;
  if (history.length === 0)
    return <p className="text-sm text-slate-500 py-2">No imports recorded yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-slate-300">
        <thead>
          <tr className="text-slate-500 border-b border-slate-700/50">
            <th className="text-left py-1.5 pr-3">When</th>
            <th className="text-left py-1.5 pr-3">Source</th>
            <th className="text-right py-1.5 pr-3">Imported</th>
            <th className="text-right py-1.5 pr-3">Failed</th>
            <th className="text-right py-1.5 pr-3">Duration</th>
            <th className="text-center py-1.5 pr-3">Backup</th>
            <th className="text-left py-1.5 pr-3">Status</th>
            <th className="text-left py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {history.map((run) => (
            <React.Fragment key={run.id}>
              <tr
                className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                onClick={() => toggle(run.id)}
              >
                <td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap">
                  {new Date(run.started_at).toLocaleString()}
                </td>
                <td className="py-1.5 pr-3 font-mono">{run.source_tag}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(run.imported)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(run.failed)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400">
                  {run.duration_s ? `${run.duration_s}s` : '—'}
                </td>
                <td className="py-1.5 pr-3 text-center">
                  {run.backup_taken ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="py-1.5 pr-3">
                  {run.status === 'success' && <span className="text-green-400">✓ success</span>}
                  {run.status === 'failed' && <span className="text-red-400">✗ failed</span>}
                  {run.status === 'running' && <span className="text-yellow-400">⏳ running</span>}
                </td>
                <td className="py-1.5 text-slate-500 text-xs">
                  {expanded.has(run.id) ? '▲' : '▼'}
                </td>
              </tr>
              {expanded.has(run.id) && <ExpandedRow run={run} />}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const DataImportTab: React.FC = () => {
  const {
    isLoading,
    importStatus,
    sqlImportStatus,
    lastResult,
    sourceTag,
    setSourceTag,
    backupEnabled,
    setBackupEnabled,
    handleFileImport,
    handleSqlFileImport,
  } = useDataImport();
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    if (!isLoading && (importStatus || sqlImportStatus)) setHistoryKey((k) => k + 1);
  }, [isLoading, importStatus, sqlImportStatus]);

  const canImport = !isLoading && sourceTag.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SQLite Import */}
        <AdminCard icon={UploadIcon} title="SQLite Import" color="from-orange-500 to-orange-600">
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Import observations from WiGLE SQLite backups. Only new records after the last import
              for this source are added — safe to re-run.
            </p>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                Source Tag <span className="text-slate-500">(pick existing or type new)</span>
              </label>
              <SourceTagInput value={sourceTag} onChange={setSourceTag} disabled={isLoading} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={backupEnabled}
                onChange={(e) => setBackupEnabled(e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 rounded accent-orange-500"
              />
              <span className="text-xs text-slate-400">Back up database before importing</span>
            </label>

            <label className="block">
              <input
                id="sqlite-upload"
                type="file"
                accept=".sqlite,.db,.sqlite3"
                onChange={handleFileImport}
                disabled={!canImport}
                className="hidden"
              />
              <div
                className={`px-4 py-2.5 rounded-lg font-medium text-sm text-center transition-all text-white bg-gradient-to-r from-orange-600 to-orange-700 ${
                  canImport
                    ? 'hover:from-orange-500 hover:to-orange-600 cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                }`}
                onClick={() => canImport && document.getElementById('sqlite-upload')?.click()}
              >
                {isLoading
                  ? importStatus.startsWith('Running')
                    ? 'Backing up...'
                    : 'Importing...'
                  : 'Choose SQLite File'}
              </div>
            </label>

            {importStatus && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  importStatus.startsWith('Imported')
                    ? 'bg-green-900/30 text-green-300 border border-green-700/50'
                    : 'bg-red-900/30 text-red-300 border border-red-700/50'
                }`}
              >
                {importStatus}
              </div>
            )}
          </div>
        </AdminCard>

        {/* SQL Import */}
        <AdminCard icon={UploadIcon} title="SQL Import" color="from-green-500 to-green-600">
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Upload and execute a PostgreSQL SQL script directly on EC2.
            </p>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={backupEnabled}
                onChange={(e) => setBackupEnabled(e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 rounded accent-green-500"
              />
              <span className="text-xs text-slate-400">Back up database before SQL import</span>
            </label>

            <label className="block">
              <input
                id="sql-upload"
                type="file"
                accept=".sql"
                onChange={handleSqlFileImport}
                disabled={isLoading}
                className="hidden"
              />
              <div
                className={`px-4 py-2.5 rounded-lg font-medium text-sm text-center transition-all text-white bg-gradient-to-r from-green-600 to-green-700 ${
                  isLoading
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:from-green-500 hover:to-green-600 cursor-pointer'
                }`}
                onClick={() => !isLoading && document.getElementById('sql-upload')?.click()}
              >
                {isLoading
                  ? sqlImportStatus.startsWith('Running')
                    ? 'Backing up...'
                    : 'Running SQL...'
                  : 'Choose SQL File'}
              </div>
            </label>

            {sqlImportStatus && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  sqlImportStatus.toLowerCase().includes('complete')
                    ? 'bg-green-900/30 text-green-300 border border-green-700/50'
                    : 'bg-red-900/30 text-red-300 border border-red-700/50'
                }`}
              >
                {sqlImportStatus}
              </div>
            )}

            <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/50">
              <p>Accepted file type: `.sql`</p>
              <p>Executed with `psql -v ON_ERROR_STOP=1`.</p>
            </div>
          </div>
        </AdminCard>
      </div>

      {lastResult?.metricsBefore && lastResult?.metricsAfter && (
        <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-1">Last SQL Import Audit</h3>
          <p className="text-xs text-slate-500 mb-3">
            Source:{' '}
            <span className="font-mono">{lastResult.sourceTag || sourceTag || 'sql_upload'}</span>
            {lastResult.durationSec ? (
              <>
                {' '}
                · Duration: <span className="font-mono">{lastResult.durationSec}s</span>
              </>
            ) : null}
            {typeof lastResult.backupTaken === 'boolean' ? (
              <>
                {' '}
                · Backup: <span className="font-mono">{lastResult.backupTaken ? 'yes' : 'no'}</span>
              </>
            ) : null}
          </p>
          <MetricsTable before={lastResult.metricsBefore} after={lastResult.metricsAfter} />
        </div>
      )}

      {/* Import History */}
      <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">
          Import History{' '}
          <span className="text-slate-500 font-normal text-xs">— click a row for details</span>
        </h3>
        <ImportHistory refreshKey={historyKey} />
      </div>
    </div>
  );
};
