import React from 'react';
import { AdminCard } from './AdminCard';
import { formatShortDate } from '../../../utils/formatDate';
import type { WigleImportRun } from '../types/admin.types';

const RefreshIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const PlayIcon = ({ size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const PauseIcon = ({ size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

const CancelIcon = ({ size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="9" x2="15" y2="15" />
    <line x1="15" y1="9" x2="9" y2="15" />
  </svg>
);

interface WigleRunsCardProps {
  runs: WigleImportRun[];
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onResume: (id: number) => void;
  onPause: (id: number) => void;
  onCancel: (id: number) => void;
  onCleanupCluster?: () => Promise<void>;
  limit?: number;
}

export const WigleRunsCard: React.FC<WigleRunsCardProps> = ({
  runs,
  loading,
  actionLoading,
  error,
  onRefresh,
  onResume,
  onPause,
  onCancel,
  onCleanupCluster,
}) => {
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [page, setPage] = React.useState(0);
  const PAGE_SIZE = 25;

  // Detect cluster: 3+ CANCELLED runs with null state created within 60s of each other
  const cancelledGlobal = runs.filter((r) => r.status === 'cancelled' && !r.state);
  const clusterIds = React.useMemo(() => {
    if (cancelledGlobal.length < 3) return [];
    const sorted = [...cancelledGlobal].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );
    // Find the largest cluster within 60s window
    let best: number[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const anchor = new Date(sorted[i].startedAt).getTime();
      const cluster = sorted
        .filter((r) => Math.abs(new Date(r.startedAt).getTime() - anchor) <= 60_000)
        .map((r) => r.id);
      if (cluster.length >= 3 && cluster.length > best.length) best = cluster;
    }
    return best;
  }, [cancelledGlobal]);

  const filteredRuns = React.useMemo(
    () =>
      statusFilter === 'all'
        ? runs
        : runs.filter(
            (r) =>
              r.status === statusFilter ||
              (statusFilter === 'completed' && r.status === 'completed')
          ),
    [runs, statusFilter]
  );
  const totalPages = Math.ceil(filteredRuns.length / PAGE_SIZE);
  const pagedRuns = filteredRuns.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  React.useEffect(() => {
    setPage(0);
  }, [statusFilter]);

  return (
    <AdminCard
      icon={RefreshIcon}
      title="Recent WiGLE Imports & Resumption"
      color="from-rose-500 to-rose-600"
    >
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-xs text-slate-400">
            Automated search loops. Resumable via cursor-based pagination.
          </p>
          <div className="flex items-center gap-2">
            {clusterIds.length >= 3 && (
              <button
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Delete ${clusterIds.length} cancelled Global runs from the timestamp cluster? This cannot be undone.`
                    )
                  )
                    return;
                  if (onCleanupCluster) await onCleanupCluster();
                }}
                disabled={loading || actionLoading}
                className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300 border border-red-500/30 bg-red-500/10 rounded hover:bg-red-500/20 transition-colors disabled:opacity-30"
                title={`${clusterIds.length} cancelled Global runs in a tight timestamp cluster`}
              >
                Clean Up ({clusterIds.length})
              </button>
            )}
            <button
              onClick={onRefresh}
              disabled={loading || actionLoading}
              className="p-1.5 text-slate-400 hover:text-white transition-colors disabled:opacity-30"
              title="Refresh Runs"
            >
              <RefreshIcon className={loading ? 'animate-spin' : ''} size={18} />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-700/50 rounded text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Status filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'completed', 'running', 'paused', 'failed', 'cancelled'] as const).map((s) => {
            const count = s === 'all' ? runs.length : runs.filter((r) => r.status === s).length;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border transition-colors ${
                  statusFilter === s
                    ? s === 'cancelled'
                      ? 'bg-slate-500/30 text-slate-200 border-slate-500/60'
                      : s === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : s === 'failed'
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : s === 'running'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : s === 'paused'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-700 text-slate-200 border-slate-600'
                    : 'bg-transparent text-slate-500 border-slate-700/50 hover:border-slate-600 hover:text-slate-400'
                }`}
              >
                {s} {count > 0 ? `(${count})` : ''}
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-700/50">
          <table className="w-full text-[11px] text-left text-slate-300">
            <thead className="bg-slate-800/50 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Progress</th>
                <th className="px-3 py-2">Last Active</th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {pagedRuns.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500 italic">
                    No recent import runs found.
                  </td>
                </tr>
              )}
              {pagedRuns.map((run) => (
                <tr key={run.id} className="hover:bg-slate-700/20 group">
                  <td className="px-3 py-2 font-mono text-slate-500">#{run.id}</td>
                  <td className="px-3 py-2">
                    <div className="font-bold text-slate-200">
                      {run.state || 'Global'}
                      {run.searchTerm ? ` / ${run.searchTerm}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-1.5 py-0.5 rounded-full font-bold uppercase text-[9px] border ${
                        run.status === 'completed' && run.rowsInserted === 0
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : run.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : run.status === 'running'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : run.status === 'failed'
                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}
                      title={
                        run.status === 'completed' && run.rowsInserted === 0
                          ? 'Completed with 0 records — API quota may have been exhausted'
                          : undefined
                      }
                    >
                      {run.status === 'completed' && run.rowsInserted === 0
                        ? 'completed (0)'
                        : run.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-500">
                          P{run.pagesFetched}/{run.totalPages || '?'}
                        </span>
                        <span className="text-slate-400 font-mono">
                          {run.rowsInserted.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            run.status === 'completed' && run.rowsInserted === 0
                              ? 'bg-amber-500'
                              : run.status === 'completed'
                                ? 'bg-emerald-500'
                                : run.status === 'failed'
                                  ? 'bg-red-500'
                                  : 'bg-blue-500'
                          }`}
                          style={{
                            width: `${
                              run.totalPages
                                ? Math.min(100, (run.pagesFetched / run.totalPages) * 100)
                                : 10
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                    {run.lastAttemptedAt
                      ? formatShortDate(run.lastAttemptedAt)
                      : formatShortDate(run.startedAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center gap-1">
                      {(run.status === 'paused' || run.status === 'failed') && (
                        <button
                          onClick={() => onResume(run.id)}
                          disabled={actionLoading}
                          className="p-1.5 text-emerald-500 hover:bg-emerald-500/20 rounded transition-all disabled:opacity-20"
                          title="Resume Import"
                        >
                          <PlayIcon />
                        </button>
                      )}
                      {run.status === 'running' && (
                        <button
                          onClick={() => onPause(run.id)}
                          disabled={actionLoading}
                          className="p-1.5 text-amber-500 hover:bg-amber-500/20 rounded transition-all disabled:opacity-20"
                          title="Pause Import"
                        >
                          <PauseIcon />
                        </button>
                      )}
                      {(run.status === 'running' ||
                        run.status === 'paused' ||
                        run.status === 'failed') && (
                        <button
                          onClick={() => onCancel(run.id)}
                          disabled={actionLoading}
                          className="p-1.5 text-red-500 hover:bg-red-500/20 rounded transition-all disabled:opacity-20"
                          title="Cancel/Archive Run"
                        >
                          <CancelIcon />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-slate-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredRuns.length)}{' '}
              of {filteredRuns.length}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-0.5 text-[10px] border border-slate-700 rounded text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 transition-colors"
              >
                ← Prev
              </button>
              <span className="px-2 py-0.5 text-[10px] text-slate-500">
                {page + 1}/{totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 py-0.5 text-[10px] border border-slate-700 rounded text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-30 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminCard>
  );
};
