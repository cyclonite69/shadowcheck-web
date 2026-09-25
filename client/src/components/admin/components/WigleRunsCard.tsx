import React, { useRef } from 'react';
import { AdminCard } from './AdminCard';
import { US_STATES } from '../../../constants/network';
import { formatShortDate } from '../../../utils/formatDate';
import type { WigleImportRun } from '../../../types/admin';
import type { SortEntry } from '../hooks/useWigleRuns';

// ─── Column definitions ───────────────────────────────────────────────────────

interface ColDef {
  id: string;
  label: string;
  sortKey: string | null;
  defaultVisible: boolean;
}

const COLUMNS: ColDef[] = [
  { id: 'id', label: 'ID', sortKey: null, defaultVisible: true },
  { id: 'target', label: 'Target', sortKey: 'search_term', defaultVisible: true },
  { id: 'jurisdiction', label: 'State/Territory', sortKey: 'state', defaultVisible: true },
  { id: 'status', label: 'Status', sortKey: 'status', defaultVisible: true },
  { id: 'progress', label: 'Progress', sortKey: null, defaultVisible: true },
  {
    id: 'rows_inserted',
    label: 'Last Run Rows Inserted',
    sortKey: 'rows_inserted',
    defaultVisible: true,
  },
  { id: 'rows_returned', label: 'Returned', sortKey: 'rows_returned', defaultVisible: false },
  { id: 'pages_fetched', label: 'Pages', sortKey: 'pages_fetched', defaultVisible: false },
  { id: 'total_pages', label: 'Total Pages', sortKey: 'total_pages', defaultVisible: false },
  { id: 'source', label: 'Source', sortKey: 'source', defaultVisible: false },
  { id: 'started_at', label: 'Started', sortKey: 'started_at', defaultVisible: true },
  { id: 'completed_at', label: 'Completed', sortKey: 'completed_at', defaultVisible: false },
  { id: 'last_active', label: 'Last Active', sortKey: 'updated_at', defaultVisible: true },
  { id: 'actions', label: 'Actions', sortKey: null, defaultVisible: true },
];

const COLUMN_STORAGE_KEY = 'import_runs_columns_v2';
const TERRITORY_CODES = new Set(['AS', 'GU', 'MP', 'PR', 'VI']);
const JURISDICTION_LABELS = new Map(US_STATES.map((state) => [state.code, state.name]));
const COUNTRY_LABELS = new Map([
  ['US', 'United States'],
  ['CA', 'Canada'],
  ['MX', 'Mexico'],
  ['GB', 'United Kingdom'],
  ['AU', 'Australia'],
  ['DE', 'Germany'],
  ['FR', 'France'],
  ['JP', 'Japan'],
]);

function getStringParam(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function formatJurisdiction(run: WigleImportRun): {
  label: string;
  detail: string | null;
  isUnknown: boolean;
} {
  const stateOrRegion = getStringParam(run.state) || getStringParam(run.requestParams?.region);
  const country = getStringParam(run.requestParams?.country);
  const normalizedCountry = country.toUpperCase();
  const code = (
    stateOrRegion || (TERRITORY_CODES.has(normalizedCountry) ? country : '')
  ).toUpperCase();

  if (!code) {
    if (!country) {
      return {
        label: 'Global',
        detail: null,
        isUnknown: false,
      };
    }

    const countryName = COUNTRY_LABELS.get(normalizedCountry);
    if (countryName) {
      return {
        label: `${normalizedCountry} — ${countryName} (National)`,
        detail: `country=${normalizedCountry} region=${stateOrRegion || '-'}`,
        isUnknown: false,
      };
    }

    return {
      label: 'Unknown',
      detail: `country=${normalizedCountry || '-'} region=${stateOrRegion || '-'} state=${run.state || '-'}`,
      isUnknown: true,
    };
  }

  const name = JURISDICTION_LABELS.get(code);
  if (name) {
    return {
      label: `${code} — ${name}`,
      detail: `country=${country || '-'} region=${stateOrRegion || '-'}`,
      isUnknown: false,
    };
  }

  return {
    label: 'Unknown',
    detail: `country=${country || '-'} region=${stateOrRegion || '-'} state=${run.state || '-'}`,
    isUnknown: true,
  };
}

// ─── Icons ────────────────────────────────────────────────────────────────────

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
const TrashIcon = ({ size = 16 }) => (
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
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface WigleRunsCardProps {
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
  // Column visibility
  const [visibleCols, setVisibleCols] = React.useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_STORAGE_KEY);
      if (saved) {
        return new Set(JSON.parse(saved) as string[]);
      }
    } catch {
      // Ignore localStorage read/parse errors and fall back to default columns
    }
    return new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id));
  });
  React.useEffect(() => {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify([...visibleCols]));
  }, [visibleCols]);

  const [chooserOpen, setChooserOpen] = React.useState(false);
  const chooserRef = useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!chooserOpen) {
      return;
    }
    const handler = (e: MouseEvent) => {
      if (chooserRef.current && !chooserRef.current.contains(e.target as Node)) {
        setChooserOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [chooserOpen]);

  const cancelledGlobalCount = runs.filter((r) => r.status === 'cancelled' && !r.state).length;
  const visibleColDefs = COLUMNS.filter((c) => visibleCols.has(c.id));

  const scrollRef = useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
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

  const renderCell = (col: ColDef, run: WigleImportRun) => {
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
            {/* Column chooser */}
            <div className="relative" ref={chooserRef}>
              <button
                onClick={() => setChooserOpen((o) => !o)}
                className={`text-[10px] font-black uppercase tracking-tighter transition-colors ${chooserOpen ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                ⊞ Columns
              </button>
              {chooserOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-slate-700/60 bg-slate-900 shadow-xl py-1">
                  {COLUMNS.map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800/60 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleCols.has(col.id)}
                        onChange={() =>
                          setVisibleCols((prev) => {
                            const next = new Set(prev);
                            if (next.has(col.id)) {
                              next.delete(col.id);
                            } else {
                              next.add(col.id);
                            }
                            return next;
                          })
                        }
                        className="w-3 h-3 rounded bg-slate-950 border-slate-700 text-blue-600"
                      />
                      <span className="text-[11px] text-slate-300">{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {cancelledGlobalCount > 0 && (
              <button
                onClick={async () => {
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
                }}
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
            <thead className="sticky top-0 z-10 bg-slate-900 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-700/50">
              <tr>
                {visibleColDefs.map((col) => {
                  const sortIdx = sortCols.findIndex((s) => s.key === col.sortKey);
                  const sortEntry = sortIdx !== -1 ? sortCols[sortIdx] : null;
                  return (
                    <th
                      key={col.id}
                      className={`px-3 py-2 whitespace-nowrap select-none ${col.sortKey && onSort ? 'cursor-pointer hover:text-slate-300 transition-colors' : ''}`}
                      onClick={col.sortKey && onSort ? (e) => onSort(col, e) : undefined}
                      title={col.sortKey ? 'Click to sort · Shift+click for multi-sort' : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortEntry && (
                          <span className="text-cyan-400 font-black">
                            {sortEntry.dir === 'asc' ? '↑' : '↓'}
                            {sortCols.length > 1 && (
                              <sup className="text-[8px] ml-px">{sortIdx + 1}</sup>
                            )}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
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
                <tr key={run.id} className="hover:bg-slate-700/20">
                  {visibleColDefs.map((col) => renderCell(col, run))}
                </tr>
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
