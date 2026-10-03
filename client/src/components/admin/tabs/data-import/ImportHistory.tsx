import React, { useEffect, useRef, useState } from 'react';
import { adminApi } from '../../../../api/adminApi';
import type { Metrics } from './types';
import { formatShortDate } from '../../../../utils/formatDate';
import { getImportHistoryStatusMeta, type ImportHistoryStatus } from './importHistoryStatusMeta';

interface ImportRun {
  id: number;
  upload_id: number | null;
  started_at: string;
  finished_at: string | null;
  source_tag: string;
  filename: string | null;
  imported: number | null;
  failed: number | null;
  duration_s: string | null;
  status: ImportHistoryStatus;
  error_detail: string | null;
  metrics_before: Metrics | null;
  metrics_after: Metrics | null;
  backup_taken: boolean;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) {
    return '—';
  }
  return n.toLocaleString();
}

function diff(
  after: number | null | undefined,
  before: number | null | undefined
): React.ReactNode {
  if (after === null || after === undefined || before === null || before === undefined) {
    return null;
  }
  const d = after - before;
  if (d === 0) {
    return <span className="text-slate-500 text-xs ml-1">(+0)</span>;
  }
  return (
    <span className={`text-xs ml-1 ${d > 0 ? 'text-green-400' : 'text-red-400'}`}>
      ({d > 0 ? '+' : ''}
      {d.toLocaleString()})
    </span>
  );
}

export function MetricsTable({ before, after }: { before: Metrics | null; after: Metrics | null }) {
  const rows: { label: string; key: keyof Metrics }[] = [
    { label: 'Networks', key: 'networks' },
    { label: 'Observations', key: 'observations' },
    { label: 'Explorer MV', key: 'in_explorer_mv' },
    { label: 'KML Files', key: 'kml_files' },
    { label: 'KML Points', key: 'kml_points' },
    { label: 'Kismet Devices', key: 'kismet_devices' },
    { label: 'Kismet Packets', key: 'kismet_packets' },
    { label: 'Kismet Alerts', key: 'kismet_alerts' },
  ];
  const hasAnyMetric = rows.some(
    ({ key }) =>
      (before?.[key] !== null && before?.[key] !== undefined) ||
      (after?.[key] !== null && after?.[key] !== undefined)
  );

  if (!hasAnyMetric) {
    return (
      <div className="mt-2 rounded border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
        Import metrics were not captured for this run.
      </div>
    );
  }

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
            <td className="py-1 pr-4 text-right tabular-nums">{fmt(before?.[key] ?? null)}</td>
            <td className="py-1 text-right tabular-nums">
              {fmt(after?.[key] ?? null)}
              {diff(after?.[key], before?.[key])}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function mergeHistoryRows(current: ImportRun[], incoming: ImportRun[]): ImportRun[] {
  const byId = new Map(current.map((run) => [run.id, run]));
  incoming.forEach((run) => byId.set(run.id, run));
  return Array.from(byId.values()).sort((left, right) => {
    const dateDifference = Date.parse(right.started_at) - Date.parse(left.started_at);
    return dateDifference || right.id - left.id;
  });
}

function ExpandedRow({ run }: { run: ImportRun }) {
  // Safely truncate error_detail to first 500 chars and strip SQL keywords for security
  const sanitizeErrorDetail = (detail: string | null): string | null => {
    if (!detail) {
      return null;
    }
    // Truncate to reasonable length
    let sanitized = detail.substring(0, 500);
    // If truncated, add ellipsis
    if (detail.length > 500) {
      sanitized += '...';
    }
    return sanitized;
  };

  return (
    <tr>
      <td colSpan={9} className="bg-slate-900/80 border-b border-slate-700/50 px-4 py-3">
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
              <div
                className="mt-2 p-2 bg-red-900/20 border border-red-700/40 rounded text-red-300 font-mono text-xs max-h-24 overflow-y-auto"
                title={run.error_detail}
              >
                {sanitizeErrorDetail(run.error_detail)}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export function ImportHistory({ refreshKey }: { refreshKey: number }) {
  const [history, setHistory] = useState<ImportRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const [startingUploads, setStartingUploads] = useState<Set<number>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);

  const reloadHistory = () => setReloadKey((prev) => prev + 1);

  useEffect(() => {
    setLoading(true);
    adminApi
      .getImportHistory(10)
      .then((data: any) => {
        setHistory((current) => mergeHistoryRows(current, data?.history ?? []));
        setHasMore((current) => current || data?.hasMore === true);
        setHistoryError(null);
      })
      .catch(() => setHistoryError('Failed to load import history.'))
      .finally(() => setLoading(false));
  }, [refreshKey, reloadKey]);

  useEffect(() => {
    const hasRunning = history.some((run) => run.status === 'running');
    if (!hasRunning) {
      return;
    }

    const interval = setInterval(() => {
      adminApi
        .getImportHistory(10)
        .then((data: any) => {
          setHistory((current) => mergeHistoryRows(current, data?.history ?? []));
          setHasMore((current) => current || data?.hasMore === true);
        })
        .catch(() => {});
    }, 4000);

    return () => clearInterval(interval);
  }, [history]);

  const loadOlderHistory = async () => {
    const oldest = history[history.length - 1];
    if (!hasMore || loadingMoreRef.current || !oldest) {
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setHistoryError(null);
    try {
      const data = await adminApi.getImportHistory(10, {
        startedAt: oldest.started_at,
        id: oldest.id,
      });
      const olderRows: ImportRun[] = data?.history ?? [];
      setHistory((current) => mergeHistoryRows(current, olderRows));
      setHasMore(data?.hasMore === true);
    } catch {
      setHistoryError('Failed to load older imports.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const handleStart = async (uploadId: number, runId: number) => {
    setActionError(null);
    setStartingUploads((prev) => new Set(prev).add(uploadId));

    try {
      await adminApi.startMobileImport(uploadId);
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(runId);
        return next;
      });
      reloadHistory();
    } catch (error: any) {
      setActionError(error?.message || 'Failed to start mobile import');
    } finally {
      setStartingUploads((prev) => {
        const next = new Set(prev);
        next.delete(uploadId);
        return next;
      });
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500 py-2">Loading history...</p>;
  }
  if (history.length === 0) {
    if (historyError) {
      return <p className="text-sm text-red-300 py-2">{historyError}</p>;
    }
    return <p className="text-sm text-slate-500 py-2">No imports recorded yet.</p>;
  }

  return (
    <div>
      {actionError && (
        <div className="mb-3 rounded border border-red-700/50 bg-red-900/20 px-3 py-2 text-xs text-red-300">
          {actionError}
        </div>
      )}
      {historyError && (
        <div className="mb-3 rounded border border-red-700/50 bg-red-900/20 px-3 py-2 text-xs text-red-300">
          {historyError}
        </div>
      )}
      <div
        data-testid="import-history-scroll-container"
        className="max-h-[32rem] overflow-auto"
        onScroll={(event) => {
          const container = event.currentTarget;
          if (container.scrollHeight - container.scrollTop - container.clientHeight < 120) {
            void loadOlderHistory();
          }
        }}
      >
        <table className="w-full text-xs text-slate-300">
          <thead className="sticky top-0 z-10 bg-slate-900">
            <tr className="text-slate-500 border-b border-slate-700/50">
              <th className="text-left py-1.5 pr-3">When</th>
              <th className="text-left py-1.5 pr-3">Source</th>
              <th className="text-right py-1.5 pr-3">Imported</th>
              <th className="text-right py-1.5 pr-3">Failed</th>
              <th className="text-right py-1.5 pr-3">Duration</th>
              <th className="text-center py-1.5 pr-3">Backup</th>
              <th className="text-left py-1.5 pr-3">Status</th>
              <th className="text-left py-1.5 pr-3">Action</th>
              <th className="text-left py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {history.map((run) => {
              const statusMeta = getImportHistoryStatusMeta(run.status);

              return (
                <React.Fragment key={run.id}>
                  <tr
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                    onClick={() => toggle(run.id)}
                  >
                    <td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap">
                      {formatShortDate(run.started_at)}
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
                      <span className={statusMeta.className}>{statusMeta.label}</span>
                    </td>
                    <td className="py-1.5 pr-3">
                      {run.status === 'pending' && run.upload_id ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleStart(run.upload_id!, run.id);
                          }}
                          disabled={startingUploads.has(run.upload_id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded text-[10px] font-black uppercase tracking-tighter transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                        >
                          {startingUploads.has(run.upload_id) ? 'Starting…' : '▶ Run'}
                        </button>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-1.5 text-slate-500 text-xs">
                      {expanded.has(run.id) ? '▲' : '▼'}
                    </td>
                  </tr>
                  {expanded.has(run.id) && <ExpandedRow run={run} />}
                </React.Fragment>
              );
            })}
            {hasMore && (
              <tr>
                <td colSpan={9} className="py-3 text-center">
                  <button
                    type="button"
                    onClick={() => void loadOlderHistory()}
                    disabled={loadingMore}
                    className="text-xs text-blue-300 hover:text-blue-200 disabled:text-slate-500"
                  >
                    {loadingMore ? 'Loading older imports…' : 'Load older imports'}
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
