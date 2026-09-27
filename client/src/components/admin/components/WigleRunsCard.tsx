import React, { useEffect, useRef } from 'react';
import { AdminCard } from './AdminCard';
import type { WigleImportRun } from '../../../types/admin';
import type { SortEntry } from '../hooks/useWigleRuns';
import { COLUMNS, useWigleRunsColumns, type ColDef } from './wigle-runs/wigleRunsColumns';
import { RefreshIcon } from './wigle-runs/WigleRunsIcons';
import { WigleRunsColumnChooser } from './wigle-runs/WigleRunsColumnChooser';
import { WigleRunsTableHeader } from './wigle-runs/WigleRunsTableHeader';
import { WigleRunsTableRow } from './wigle-runs/WigleRunsTableRow';

export type { ColDef };

export interface WigleRunsCardProps {
  runs: WigleImportRun[];
  total?: number;
  hasMore?: boolean;
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  sortCols?: SortEntry[];
  onSort?: (col: ColDef, e: React.MouseEvent) => void;
  onRefresh: () => void;
  onLoadMore?: () => void;
  onResume: (id: number) => void;
  onPause: (id: number) => void;
  onCancel: (id: number) => void;
  onDelete: (id: number) => void;
  onCleanupCluster?: () => Promise<void>;
}

export const WigleRunsCard: React.FC<WigleRunsCardProps> = ({
  runs,
  total = 0,
  hasMore = false,
  loading,
  actionLoading,
  error,
  sortCols = [],
  onSort,
  onRefresh,
  onLoadMore,
  onResume,
  onPause,
  onCancel,
  onDelete,
  onCleanupCluster,
}) => {
  const { visibleCols, visibleColDefs, handleToggleColumn } = useWigleRunsColumns();
  const cancelledGlobalCount = runs.filter((r) => r.status === 'cancelled' && !r.state).length;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !onLoadMore) {
      return;
    }

    const handleScroll = () => {
      if (!hasMore || loading) {
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop <= clientHeight + 200) {
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, loading, onLoadMore]);

  const handleCleanupCluster = async () => {
    if (
      !window.confirm(
        `Delete all ${cancelledGlobalCount} cancelled Global runs? This cannot be undone.`
      )
    ) {
      return;
    }
    if (onCleanupCluster) {
      await onCleanupCluster();
    }
  };

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
            {total > 0 && (
              <span className="ml-2 text-slate-500">
                ({runs.length.toLocaleString()} of {total.toLocaleString()})
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <WigleRunsColumnChooser
              columns={COLUMNS}
              visibleCols={visibleCols}
              onToggleColumn={handleToggleColumn}
            />

            {cancelledGlobalCount > 0 && (
              <button
                onClick={handleCleanupCluster}
                disabled={loading || actionLoading}
                className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300 border border-red-500/30 bg-red-500/10 rounded hover:bg-red-500/20 transition-colors disabled:opacity-30"
              >
                Clean Up ({cancelledGlobalCount})
              </button>
            )}
            <button
              onClick={onRefresh}
              disabled={loading || actionLoading}
              className="p-1.5 text-slate-400 hover:text-white transition-colors disabled:opacity-30"
              title="Refresh"
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

        <div
          ref={scrollRef}
          className="overflow-x-auto overflow-y-auto max-h-[36rem] rounded-lg border border-slate-700/50"
        >
          <table className="w-full text-[11px] text-left text-slate-300">
            <WigleRunsTableHeader columns={visibleColDefs} sortCols={sortCols} onSort={onSort} />
            <tbody className="divide-y divide-slate-800">
              {runs.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={visibleColDefs.length}
                    className="px-3 py-6 text-center text-slate-500 italic"
                  >
                    No recent import runs found.
                  </td>
                </tr>
              )}
              {runs.map((run) => (
                <WigleRunsTableRow
                  key={run.id}
                  run={run}
                  columns={visibleColDefs}
                  actionLoading={actionLoading}
                  onResume={onResume}
                  onPause={onPause}
                  onCancel={onCancel}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
          {loading && runs.length > 0 && (
            <div className="px-3 py-3 text-center text-[11px] text-slate-500">Loading more…</div>
          )}
        </div>
      </div>
    </AdminCard>
  );
};
