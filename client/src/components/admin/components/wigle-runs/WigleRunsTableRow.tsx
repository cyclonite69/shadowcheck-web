import React from 'react';
import { formatShortDate } from '../../../../utils/formatDate';
import type { WigleImportRun } from '../../../../types/admin';
import type { ColDef } from './wigleRunsColumns';
import { formatJurisdiction } from './wigleRunsJurisdiction';
import { CancelIcon, PauseIcon, PlayIcon, TrashIcon } from './WigleRunsIcons';

export interface WigleRunsTableRowProps {
  run: WigleImportRun;
  columns: ColDef[];
  actionLoading: boolean;
  onResume: (id: number) => void;
  onPause: (id: number) => void;
  onCancel: (id: number) => void;
  onDelete: (id: number) => void;
}

export const WigleRunsTableRow: React.FC<WigleRunsTableRowProps> = ({
  run,
  columns,
  actionLoading,
  onResume,
  onPause,
  onCancel,
  onDelete,
}) => {
  const renderCell = (col: ColDef) => {
    switch (col.id) {
      case 'id':
        return (
          <td key={col.id} className="px-3 py-2 font-mono text-slate-500">
            #{run.id}
          </td>
        );
      case 'target':
        return (
          <td key={col.id} className="px-3 py-2">
            <div className="font-bold text-slate-200">{run.searchTerm || 'Global'}</div>
          </td>
        );
      case 'status':
        return (
          <td key={col.id} className="px-3 py-2">
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
              title={run.status === 'failed' && run.lastError ? run.lastError : undefined}
            >
              {run.status === 'completed' && run.rowsInserted === 0 ? 'completed (0)' : run.status}
            </span>
            {run.status === 'failed' && run.lastError && (
              <div
                className="mt-1 text-[9px] text-red-400/70 max-w-[160px] truncate"
                title={run.lastError}
              >
                {run.lastError}
              </div>
            )}
          </td>
        );
      case 'progress':
        return (
          <td key={col.id} className="px-3 py-2">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">
                  P{run.pagesFetched}/{run.totalPages || '?'}
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
                    width: `${run.totalPages ? Math.min(100, (run.pagesFetched / run.totalPages) * 100) : 10}%`,
                  }}
                />
              </div>
            </div>
          </td>
        );
      case 'rows_inserted':
        return (
          <td key={col.id} className="px-3 py-2 text-right tabular-nums font-mono text-slate-400">
            {run.rowsInserted.toLocaleString()}
          </td>
        );
      case 'rows_returned':
        return (
          <td key={col.id} className="px-3 py-2 text-right tabular-nums font-mono text-slate-400">
            {run.rowsReturned.toLocaleString()}
          </td>
        );
      case 'pages_fetched':
        return (
          <td key={col.id} className="px-3 py-2 text-right tabular-nums text-slate-400">
            {run.pagesFetched}
          </td>
        );
      case 'total_pages':
        return (
          <td key={col.id} className="px-3 py-2 text-right tabular-nums text-slate-400">
            {run.totalPages ?? '—'}
          </td>
        );
      case 'source': {
        const isBt = run.source === 'wigle_bt';
        return (
          <td key={col.id} className="px-3 py-2" title={`source=${run.source}`}>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                isBt
                  ? 'bg-purple-900/40 text-purple-300 border border-purple-700/40'
                  : 'bg-blue-900/30 text-blue-300 border border-blue-700/30'
              }`}
            >
              {isBt ? 'BT' : 'WiFi'}
            </span>
          </td>
        );
      }
      case 'jurisdiction': {
        const jurisdiction = formatJurisdiction(run);
        return (
          <td
            key={col.id}
            className="px-3 py-2 text-slate-400"
            title={jurisdiction.detail || undefined}
          >
            <div
              className={`font-semibold ${jurisdiction.isUnknown ? 'text-amber-300' : 'text-slate-200'}`}
            >
              {jurisdiction.label}
            </div>
            {jurisdiction.isUnknown && jurisdiction.detail && (
              <div className="text-[9px] text-slate-500 truncate max-w-[140px]">
                {jurisdiction.detail}
              </div>
            )}
          </td>
        );
      }
      case 'started_at':
        return (
          <td key={col.id} className="px-3 py-2 text-slate-500 whitespace-nowrap">
            {formatShortDate(run.startedAt)}
          </td>
        );
      case 'completed_at':
        return (
          <td key={col.id} className="px-3 py-2 text-slate-500 whitespace-nowrap">
            {run.completedAt ? formatShortDate(run.completedAt) : '—'}
          </td>
        );
      case 'last_active':
        return (
          <td key={col.id} className="px-3 py-2 text-slate-500 whitespace-nowrap">
            {run.lastAttemptedAt
              ? formatShortDate(run.lastAttemptedAt)
              : formatShortDate(run.startedAt)}
          </td>
        );
      case 'actions':
        return (
          <td key={col.id} className="px-3 py-2">
            <div className="flex justify-center gap-1">
              {(run.status === 'paused' || run.status === 'failed') && (
                <button
                  onClick={() => onResume(run.id)}
                  disabled={actionLoading}
                  className="p-1.5 text-emerald-500 hover:bg-emerald-500/20 rounded transition-all disabled:opacity-20"
                  title="Resume"
                >
                  <PlayIcon />
                </button>
              )}
              {run.status === 'running' && (
                <button
                  onClick={() => onPause(run.id)}
                  disabled={actionLoading}
                  className="p-1.5 text-amber-500 hover:bg-amber-500/20 rounded transition-all disabled:opacity-20"
                  title="Pause"
                >
                  <PauseIcon />
                </button>
              )}
              {(run.status === 'running' || run.status === 'paused' || run.status === 'failed') && (
                <button
                  onClick={() => onCancel(run.id)}
                  disabled={actionLoading}
                  className="p-1.5 text-red-500 hover:bg-red-500/20 rounded transition-all disabled:opacity-20"
                  title="Cancel"
                >
                  <CancelIcon />
                </button>
              )}
              {(run.status === 'completed' ||
                run.status === 'cancelled' ||
                run.status === 'failed') && (
                <button
                  onClick={() => onDelete(run.id)}
                  disabled={actionLoading}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all disabled:opacity-20"
                  title="Delete"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </td>
        );
      default:
        return null;
    }
  };

  return <tr className="hover:bg-slate-700/20">{columns.map((col) => renderCell(col))}</tr>;
};
