import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { UploadIcon } from './UploadIcon';
import { ImportStatusMessage } from './ImportStatusMessage';
import { FileImportButton } from './FileImportButton';
import type {
  KmlImportStatusResponse,
  WigleKmlSyncStatusResponse,
} from '../../../../types/kmlImport';
import { adminApi } from '../../../../api/adminApi';

interface KmlImportCardProps {
  isLoading: boolean;
  kmlImports: KmlImportStatusResponse | null;
  kmlImportsError: string | null;
  kmlImportsLoading: boolean;
  kmlImportStatus: string;
  onFilesChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFolderChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRefreshImports: () => void;
}

const formatNumber = (value: number | null | undefined) => Number(value || 0).toLocaleString();

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return 'None';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

export const KmlImportCard = ({
  isLoading,
  kmlImports,
  kmlImportsError,
  kmlImportsLoading,
  kmlImportStatus,
  onFilesChange,
  onFolderChange,
  onRefreshImports,
}: KmlImportCardProps) => {
  const [syncStatus, setSyncStatus] = React.useState<WigleKmlSyncStatusResponse | null>(null);
  const [syncStatusLoading, setSyncStatusLoading] = React.useState(false);
  const [syncStatusError, setSyncStatusError] = React.useState<string | null>(null);

  const fetchSyncStatus = React.useCallback(async () => {
    try {
      setSyncStatusLoading(true);
      setSyncStatusError(null);
      const res = await adminApi.getWigleKmlSyncStatus();
      setSyncStatus(res);
    } catch (err) {
      setSyncStatusError(err instanceof Error ? err.message : 'Failed to fetch WiGLE sync status');
    } finally {
      setSyncStatusLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchSyncStatus();
  }, [fetchSyncStatus]);

  return (
    <AdminCard icon={UploadIcon} title="KML Import" color="from-sky-500 to-cyan-600">
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          Upload WiGLE KML exports into staged `app.kml_*` tables for later reconciliation. Raw file
          archiving is optional and depends on storage configuration.
        </p>

        <div className="grid grid-cols-1 gap-3">
          <FileImportButton
            id="kml-upload-files"
            accept=".kml"
            onChange={onFilesChange}
            disabled={isLoading}
            isLoading={isLoading}
            loadingText="Uploading KML..."
            idleText="Choose KML Files"
            activeColorClass="from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600"
            multiple
          />

          <FileImportButton
            id="kml-upload-folder"
            accept=".kml"
            onChange={onFolderChange}
            disabled={isLoading}
            isLoading={isLoading}
            loadingText="Uploading Folder..."
            idleText="Choose KML Folder"
            activeColorClass="from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600"
            multiple
            directory
          />
        </div>

        <ImportStatusMessage status={kmlImportStatus} />

        <div className="border-t border-slate-700/50 pt-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h4 className="text-sm font-semibold text-slate-300">Imported KMLs</h4>
            <button
              type="button"
              onClick={onRefreshImports}
              disabled={kmlImportsLoading}
              className="text-xs text-sky-300 hover:text-sky-200 disabled:text-slate-500"
            >
              {kmlImportsLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {kmlImportsError ? (
            <p className="text-xs text-red-300">{kmlImportsError}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-slate-500">Files</p>
                  <p className="font-mono text-slate-200">
                    {formatNumber(kmlImports?.totals.file_count)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Points</p>
                  <p className="font-mono text-slate-200">
                    {formatNumber(kmlImports?.totals.point_count)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">WiGLE files</p>
                  <p className="font-mono text-slate-200">
                    {formatNumber(kmlImports?.totals.wigle_file_count)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Latest</p>
                  <p className="font-mono text-slate-200">
                    {formatDate(kmlImports?.totals.latest_imported_at)}
                  </p>
                </div>
              </div>

              <div className="mt-3 max-h-56 overflow-auto rounded border border-slate-700/50">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-900 text-slate-400">
                    <tr>
                      <th className="px-2 py-2 font-medium">Source file</th>
                      <th className="px-2 py-2 font-medium">Type</th>
                      <th className="px-2 py-2 font-medium text-right">Placemarks</th>
                      <th className="px-2 py-2 font-medium text-right">Points</th>
                      <th className="px-2 py-2 font-medium">Hash</th>
                      <th className="px-2 py-2 font-medium">Imported</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(kmlImports?.files || []).slice(0, 25).map((file) => (
                      <tr key={file.id} className="text-slate-300">
                        <td className="px-2 py-2 font-mono text-[11px]">{file.source_file}</td>
                        <td className="px-2 py-2">{file.source_type || 'kml'}</td>
                        <td className="px-2 py-2 text-right font-mono">
                          {formatNumber(file.placemark_count)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono">
                          {formatNumber(file.point_count)}
                        </td>
                        <td className="px-2 py-2 font-mono">{file.hash_prefix || 'none'}</td>
                        <td className="px-2 py-2 font-mono text-[11px]">
                          {formatDate(file.imported_at)}
                        </td>
                      </tr>
                    ))}
                    {!kmlImports?.files?.length ? (
                      <tr>
                        <td className="px-2 py-4 text-center text-slate-500" colSpan={6}>
                          No KML imports found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-slate-700/50 pt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-slate-300">WiGLE Remote Sync</h4>
            <button
              type="button"
              onClick={fetchSyncStatus}
              disabled={syncStatusLoading}
              className="text-xs text-sky-300 hover:text-sky-200 disabled:text-slate-500"
            >
              {syncStatusLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {syncStatusError ? (
            <p className="text-xs text-red-300">{syncStatusError}</p>
          ) : syncStatus ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-slate-500">Credentials</p>
                  <p
                    className={`font-semibold ${syncStatus.configured ? 'text-emerald-400' : 'text-amber-400'}`}
                  >
                    {syncStatus.configured ? 'Configured' : 'Missing'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Remote Sync</p>
                  <p
                    className={`font-semibold ${syncStatus.supported ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    {syncStatus.supported ? 'Supported' : 'Unsupported'}
                  </p>
                </div>
              </div>

              {!syncStatus.supported ? (
                <>
                  <p className="text-xs text-slate-400 leading-relaxed bg-slate-800/40 p-2.5 rounded border border-slate-800">
                    {syncStatus.message} {syncStatus.recommendation}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled
                      title="WiGLE remote KML listing is unsupported in this version"
                      className="px-3 py-1.5 bg-slate-800 text-slate-500 border border-slate-700/50 text-xs rounded cursor-not-allowed flex-1"
                    >
                      Check WiGLE
                    </button>
                    <button
                      type="button"
                      disabled
                      title="WiGLE remote KML sync is unsupported in this version"
                      className="px-3 py-1.5 bg-slate-800 text-slate-500 border border-slate-700/50 text-xs rounded cursor-not-allowed flex-1"
                    >
                      Sync now
                    </button>
                  </div>
                </>
              ) : (
                <WiGLEActiveSyncPanel onRefreshImports={onRefreshImports} />
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Loading sync status...</p>
          )}
        </div>

        <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/50">
          <p>Accepted file type: `.kml`</p>
          <p>Files are staged into `app.kml_files` and `app.kml_points`.</p>
        </div>
      </div>
    </AdminCard>
  );
};

// ─── Active Sync Sub-Panel ──────────────────────────────────────────────────

interface ActiveSyncPanelProps {
  onRefreshImports: () => void;
}

const WiGLEActiveSyncPanel = ({ onRefreshImports }: ActiveSyncPanelProps) => {
  const [txs, setTxs] = React.useState<any[] | null>(null);
  const [txsLoading, setTxsLoading] = React.useState(false);
  const [txsError, setTxsError] = React.useState<string | null>(null);

  const [syncLoading, setSyncLoading] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<any | null>(null);
  const [force, setForce] = React.useState(false);

  const handleCheckWigle = async () => {
    try {
      setTxsLoading(true);
      setTxsError(null);
      setSyncResult(null);
      const res = await adminApi.getWigleKmlTransactions(0, 10);
      if (res && Array.isArray(res.results)) {
        setTxs(
          res.results.filter((tx: any) => {
            if (!tx.transid) {
              return false;
            }
            const statusStr = String(tx.status || '').toUpperCase();
            return statusStr === 'SUCCESS' || statusStr === 'D' || tx.percentDone === 100;
          })
        );
      } else {
        setTxs([]);
      }
    } catch (err) {
      setTxsError(err instanceof Error ? err.message : 'Failed to fetch WiGLE uploads');
    } finally {
      setTxsLoading(false);
    }
  };

  const handleSync = async (dryRun: boolean) => {
    try {
      setSyncLoading(true);
      setSyncResult(null);
      const res = await adminApi.syncWigleKmls({
        limit: 10,
        dryRun,
        force,
      });
      setSyncResult(res);
      if (!dryRun && res.syncedCount > 0) {
        onRefreshImports();
      }
    } catch (err) {
      setTxsError(err instanceof Error ? err.message : 'Failed to sync runs from WiGLE');
    } finally {
      setSyncLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) {
      return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCheckWigle}
          disabled={txsLoading || syncLoading}
          className="px-3 py-1.5 bg-slate-800 text-slate-200 border border-slate-700/50 hover:bg-slate-700/50 text-xs rounded transition flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {txsLoading ? 'Checking...' : 'Check WiGLE'}
        </button>
        <button
          type="button"
          onClick={() => handleSync(true)}
          disabled={!txs || txs.length === 0 || syncLoading || txsLoading}
          className="px-3 py-1.5 bg-slate-800 text-slate-200 border border-slate-700/50 hover:bg-slate-700/50 text-xs rounded transition flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Dry Run
        </button>
        <button
          type="button"
          onClick={() => handleSync(false)}
          disabled={!txs || txs.length === 0 || syncLoading || txsLoading}
          className="px-3 py-1.5 bg-sky-600 text-white hover:bg-sky-500 text-xs rounded transition font-medium flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncLoading ? 'Syncing...' : 'Sync now'}
        </button>
      </div>

      <div className="flex justify-between items-center text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <input
            id="wigle-sync-force"
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
            disabled={syncLoading || txsLoading}
            className="rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-sky-500 text-xs cursor-pointer"
          />
          <label htmlFor="wigle-sync-force" className="text-slate-400 cursor-pointer select-none">
            Force reimport (reprocess duplicates)
          </label>
        </div>
        <span>Batch size: 10</span>
      </div>

      {txsError && <p className="text-xs text-red-300">{txsError}</p>}

      {txs && txs.length > 0 && !syncResult && (
        <div className="bg-slate-800/40 rounded border border-slate-800 p-2 space-y-2">
          <p className="text-xs font-semibold text-slate-400">WiGLE Upload History (SUCCESS):</p>
          <div className="max-h-36 overflow-auto space-y-1.5 pr-1">
            {txs.map((tx: any) => (
              <div
                key={tx.transid}
                className="flex justify-between items-center text-[11px] font-mono text-slate-300"
              >
                <span className="truncate max-w-[200px]" title={tx.fileName || tx.transid}>
                  {tx.fileName || tx.transid}
                </span>
                <span className="text-slate-500">
                  {formatBytes(tx.fileSize)} | {tx.fileLines?.toLocaleString()} lines
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {txs && txs.length === 0 && !txsLoading && (
        <p className="text-xs text-slate-500 text-center">No successful uploads found on WiGLE.</p>
      )}

      {syncResult && (
        <div className="bg-slate-800/40 rounded border border-slate-800 p-2.5 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-300">Sync Execution Results</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                syncResult.rateLimited
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : syncResult.ok
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {syncResult.rateLimited
                ? 'Rate Limited'
                : syncResult.ok
                  ? 'Success'
                  : 'Warnings/Errors'}
            </span>
          </div>

          {syncResult.rateLimited && (
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded p-2 text-cyan-300 text-[11px] leading-relaxed">
              {syncResult.rateLimitMessage ||
                'Deferred — WiGLE request budget exhausted. Try again after the request window resets.'}
            </div>
          )}

          {syncResult.syncedCount === 0 &&
            syncResult.skippedCount > 0 &&
            syncResult.failedCount === 0 &&
            (syncResult.deferredCount || 0) === 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-2 text-slate-300 text-[11px] leading-relaxed">
                Processed {syncResult.skippedCount} transactions: 0 imported,{' '}
                {syncResult.skippedCount} already present. Local KML staging appears up to date for
                the current remote transaction window.
              </div>
            )}

          <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
            <span>Batch size: 10</span>
            <span>Processed {syncResult.results.length} transactions this run</span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-[11px] py-1 border-y border-slate-700/50">
            <div>
              <p className="text-slate-500">Imported</p>
              <p className="font-mono text-emerald-400 font-bold">{syncResult.syncedCount}</p>
            </div>
            <div>
              <p className="text-slate-500" title="Already Present / Associated">
                Already Present
              </p>
              <p className="font-mono text-amber-400 font-bold">{syncResult.skippedCount}</p>
            </div>
            <div>
              <p className="text-slate-500">Deferred</p>
              <p className="font-mono text-cyan-400 font-bold">{syncResult.deferredCount || 0}</p>
            </div>
            <div>
              <p className="text-slate-500">Failed</p>
              <p className="font-mono text-rose-400 font-bold">{syncResult.failedCount}</p>
            </div>
          </div>
          <div className="max-h-36 overflow-auto space-y-1 pr-1 font-mono text-[11px]">
            {syncResult.results.map((res: any, idx: number) => (
              <div
                key={res.transid || idx}
                className="flex justify-between items-start gap-2 border-b border-slate-800/50 pb-1"
              >
                <span className="truncate max-w-[180px] text-slate-300" title={res.fileName}>
                  {res.fileName}
                </span>
                <div className="text-right">
                  <span
                    className={`px-1.5 rounded-[3px] text-[9px] uppercase font-bold ${
                      res.status === 'imported'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : res.status === 'skipped'
                          ? 'bg-amber-500/20 text-amber-300'
                          : res.status === 'deferred'
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {res.status === 'skipped' ? 'already present' : res.status}
                  </span>
                  {res.pointsImported !== undefined && (
                    <span className="text-[10px] text-slate-500 ml-1">
                      ({res.pointsImported} pts)
                    </span>
                  )}
                  {res.error && (
                    <p className="text-[10px] text-rose-300 text-left mt-0.5 break-all max-w-[220px]">
                      {res.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
