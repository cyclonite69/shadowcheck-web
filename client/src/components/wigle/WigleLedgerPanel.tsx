import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { wigleApi, type LedgerRow } from '../../api/wigleApi';
import { formatShortDate, formatISODate } from '../../utils/formatDate';

const STATUS_FILTERS = ['all', 'success', 'error', 'rate_limited', 'skipped'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const BADGE_STYLES = {
  success: 'bg-green-900/60 text-green-300 border border-green-700/40',
  error: 'bg-red-900/60 text-red-300 border border-red-700/40',
  warning: 'bg-amber-900/60 text-amber-300 border border-amber-700/40',
  info: 'bg-blue-900/60 text-blue-300 border border-blue-700/40',
  neutral: 'bg-slate-700/60 text-slate-400 border border-slate-600/40',
};

function Badge({
  text,
  type,
  isMono = false,
}: {
  text: string | number;
  type: keyof typeof BADGE_STYLES;
  isMono?: boolean;
}) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${BADGE_STYLES[type]} ${
        isMono ? 'font-mono' : ''
      }`}
    >
      {text}
    </span>
  );
}

const statusToBadgeType = (status: string): keyof typeof BADGE_STYLES => {
  if (status === 'success') {
    return 'success';
  }
  if (status === 'error') {
    return 'error';
  }
  if (status === 'rate_limited') {
    return 'warning';
  }
  return 'neutral';
};

const sourceToBadgeType = (source: string): keyof typeof BADGE_STYLES => {
  return source === 'import' ? 'info' : 'neutral';
};

const phaseToBadgeType = (phase: string): keyof typeof BADGE_STYLES => {
  if (phase === 'pending') {
    return 'warning';
  }
  if (phase === 'complete') {
    return 'success';
  }
  return 'neutral';
};

const querySourceToBadgeType = (qs: string): keyof typeof BADGE_STYLES => {
  if (qs === 'manual' || qs === 'scheduled' || qs === 'import') {
    return 'info';
  }
  return 'neutral';
};

const httpStatusToBadgeType = (status: number): keyof typeof BADGE_STYLES => {
  if (status === 429) {
    return 'warning';
  }
  if (status >= 400) {
    return 'error';
  }
  return 'success';
};

function fmtDuration(ms?: number) {
  if (ms === null || ms === undefined) {
    return '—';
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

export function WigleLedgerPanel() {
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const atTop = useRef(true);

  const load = useCallback(
    async (reset = false) => {
      if (loading) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const cursor =
          !reset && rows.length > 0
            ? { before: rows[rows.length - 1].timestamp, beforeId: rows[rows.length - 1].id }
            : {};
        const result = await wigleApi.getLedger({ status: statusFilter, ...cursor });
        setRows((prev) => (reset ? result.rows : [...prev, ...result.rows]));
        setHasMore(result.hasMore);
      } catch (e: any) {
        setError(e.message || 'Failed to load ledger');
      } finally {
        setLoading(false);
      }
    },
    [loading, rows, statusFilter]
  );

  // Load on open or filter change
  useEffect(() => {
    if (open) {
      load(true);
    }
  }, [open, statusFilter]);

  // Auto-refresh every 30s when open and at top
  useEffect(() => {
    if (!open) {
      return;
    }
    refreshTimer.current = setInterval(() => {
      if (atTop.current) {
        load(true);
      }
    }, 30_000);
    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, [open, statusFilter]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (!bottomRef.current || !hasMore) {
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          load(false);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(bottomRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading, load]);

  return (
    <div className="border-t border-slate-600 bg-slate-900/95 backdrop-blur-sm shadow-lg">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-blue-400">📋</span>
          REQUEST LEDGER
          {rows.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
              {rows.length}
              {hasMore ? '+' : ''}
            </span>
          )}
        </span>
        <span className="text-slate-400 text-base">{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* Filter pills */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                  statusFilter === s
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600/60'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Table */}
          <div
            className="overflow-auto max-h-72 rounded border border-slate-700/50"
            onScroll={(e) => {
              atTop.current = (e.currentTarget as HTMLDivElement).scrollTop < 40;
            }}
          >
            {error && <div className="p-4 text-red-400 text-xs">{error}</div>}
            {!error && rows.length === 0 && !loading && (
              <div className="p-6 text-center text-slate-500 text-xs">No entries yet</div>
            )}
            {rows.length > 0 && (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-800 text-slate-400 uppercase tracking-wider select-none">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Timestamp</th>
                    <th className="px-3 py-2 text-left font-semibold">Source</th>
                    <th className="px-3 py-2 text-left font-semibold">Kind</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                    <th className="px-3 py-2 text-right font-semibold">Records</th>
                    <th className="px-3 py-2 text-right font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <Fragment key={row.id}>
                      <tr
                        className={`border-t border-slate-700/30 hover:bg-slate-800/60 cursor-pointer transition-colors ${
                          expandedRowId === row.id ? 'bg-slate-850' : ''
                        }`}
                        onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                        title="Click to toggle details"
                      >
                        <td
                          className="px-3 py-1.5 text-slate-400 whitespace-nowrap font-mono"
                          title={formatISODate(row.timestamp)}
                        >
                          <span className="flex items-center gap-1.5">
                            {row.phase === 'pending' && (
                              <span
                                className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"
                                title="Pending execution"
                              />
                            )}
                            {formatShortDate(row.timestamp)}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          <Badge text={row.source} type={sourceToBadgeType(row.source)} />
                        </td>
                        <td className="px-3 py-1.5 text-slate-300 max-w-[160px] truncate">
                          {row.kind || '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          <Badge
                            text={`${row.status.replace('_', ' ')}${row.httpStatus !== null && row.httpStatus !== undefined ? ` (${row.httpStatus})` : ''}`}
                            type={statusToBadgeType(row.status)}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-400 font-mono">
                          {row.rowsInserted !== null && row.rowsInserted !== undefined
                            ? row.rowsInserted.toLocaleString()
                            : row.resultCount !== null && row.resultCount !== undefined
                              ? row.resultCount.toLocaleString()
                              : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-400 font-mono">
                          {fmtDuration(row.durationMs)}
                        </td>
                      </tr>
                      {expandedRowId === row.id && (
                        <tr className="bg-slate-950/60 font-mono text-[11px] text-slate-400 border-t border-slate-800">
                          <td colSpan={6} className="px-4 py-3 select-text">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-500 font-semibold w-24">Status:</span>
                                  <Badge
                                    text={row.status.replace('_', ' ')}
                                    type={statusToBadgeType(row.status)}
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-500 font-semibold w-24">Phase:</span>
                                  {row.phase ? (
                                    <Badge text={row.phase} type={phaseToBadgeType(row.phase)} />
                                  ) : (
                                    <span>—</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-500 font-semibold w-24">
                                    Query Source:
                                  </span>
                                  {row.querySource ? (
                                    <Badge
                                      text={row.querySource}
                                      type={querySourceToBadgeType(row.querySource)}
                                    />
                                  ) : (
                                    <span>—</span>
                                  )}
                                </div>
                                {row.httpStatus !== null && row.httpStatus !== undefined && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500 font-semibold w-24">
                                      HTTP Status:
                                    </span>
                                    <Badge
                                      text={row.httpStatus}
                                      type={httpStatusToBadgeType(row.httpStatus)}
                                    />
                                  </div>
                                )}
                                {row.resultCount !== null && row.resultCount !== undefined && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500 font-semibold w-24">
                                      Result Count:
                                    </span>
                                    <Badge text={row.resultCount} type="neutral" isMono={true} />
                                  </div>
                                )}
                                {row.retryAfterHint !== null &&
                                  row.retryAfterHint !== undefined && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-500 font-semibold w-24">
                                        Retry-After Hint:
                                      </span>
                                      <Badge
                                        text={`${row.retryAfterHint}s`}
                                        type="warning"
                                        isMono={true}
                                      />
                                    </div>
                                  )}
                                {row.error && (
                                  <div className="text-red-400 border border-red-700/40 bg-red-950/20 p-2 rounded max-w-md mt-1">
                                    <span className="text-red-500 font-semibold">
                                      Error Message:
                                    </span>{' '}
                                    <span className="break-all">{row.error}</span>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                {row.queryUrl && (
                                  <div className="max-w-md">
                                    <span className="text-slate-500 font-semibold">Query URL:</span>
                                    <div className="text-slate-300 break-all bg-slate-900 p-1.5 rounded border border-slate-800/60 max-h-16 overflow-y-auto font-mono text-[10px]">
                                      {row.queryUrl}
                                    </div>
                                  </div>
                                )}
                                {row.queryParams && Object.keys(row.queryParams).length > 0 && (
                                  <div>
                                    <span className="text-slate-500 font-semibold">
                                      Query Params:
                                    </span>
                                    <pre className="mt-1 p-2 rounded bg-slate-900 border border-slate-800/60 max-w-md overflow-x-auto text-[10px] text-slate-300 max-h-24 overflow-y-auto">
                                      {JSON.stringify(row.queryParams, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
            {/* Infinite scroll sentinel */}
            {hasMore && <div ref={bottomRef} className="h-4" />}
            {loading && (
              <div className="flex justify-center py-3">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
