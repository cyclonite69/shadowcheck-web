import React from 'react';
import type { SiblingSummaryStats, SiblingRuleStat } from '../../hooks/useSiblingStats';
import { formatShortDate } from '../../../../utils/formatDate';

export interface DbSiblingStatsCardProps {
  siblingStats: SiblingSummaryStats | null;
  siblingByRule: SiblingRuleStat[];
  purgingSiblings: boolean;
  purgeSiblings: () => void;
  runningSiblings: boolean;
  runRefresh: (incremental?: boolean) => void;
  /** Non-null when the last runRefresh() poll timed out waiting for job completion. */
  refreshError: string | null;
}

export const DbSiblingStatsCard: React.FC<DbSiblingStatsCardProps> = ({
  siblingStats,
  siblingByRule,
  purgingSiblings,
  purgeSiblings,
  runningSiblings,
  runRefresh,
  refreshError,
}) => {
  return siblingStats ? (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Pairs',
            value: siblingStats.total_pairs.toLocaleString(),
            color: 'text-violet-400',
          },
          {
            label: 'Strong (≥0.97)',
            value: siblingStats.strong_pairs.toLocaleString(),
            color: 'text-emerald-400',
          },
          {
            label: 'Candidate',
            value: siblingStats.candidate_pairs.toLocaleString(),
            color: 'text-yellow-400',
          },
          {
            label: 'Avg Confidence',
            value: siblingStats.avg_confidence,
            color: 'text-blue-400',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-800/50 rounded-lg p-3 text-center">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">
              {label}
            </div>
            <div className={`text-lg font-black tabular-nums ${color}`}>{value}</div>
          </div>
        ))}
      </div>
      {/* Last computed */}
      {siblingStats.newest_computed_at && (
        <div className="text-[10px] text-slate-600 italic">
          Last computed: {formatShortDate(siblingStats.newest_computed_at)}
          {siblingStats.oldest_computed_at &&
            siblingStats.oldest_computed_at !== siblingStats.newest_computed_at && (
              <> · Oldest: {formatShortDate(siblingStats.oldest_computed_at)}</>
            )}
        </div>
      )}
      {/* By-rule breakdown */}
      {siblingByRule.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="py-2 pr-4 font-semibold uppercase tracking-wider">Rule</th>
                <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">
                  Pairs
                </th>
                <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">
                  Avg Conf
                </th>
                <th className="py-2 pl-4 font-semibold uppercase tracking-wider text-right">
                  Last Run
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {siblingByRule.map((r) => (
                <tr key={r.rule} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 pr-4 font-mono text-violet-400 font-medium">{r.rule}</td>
                  <td className="py-2 px-4 text-right tabular-nums text-slate-300">
                    {r.pair_count.toLocaleString()}
                  </td>
                  <td className="py-2 px-4 text-right tabular-nums text-blue-400">
                    {r.avg_confidence}
                  </td>
                  <td className="py-2 pl-4 text-right whitespace-nowrap text-slate-500">
                    {r.last_run_at ? formatShortDate(r.last_run_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Action buttons */}
      <div className="pt-3 border-t border-slate-800/50 flex justify-end gap-2">
        <button
          onClick={() => runRefresh(true)}
          disabled={runningSiblings || purgingSiblings}
          className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-900/60 hover:bg-blue-800/80 text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {runningSiblings ? 'Starting…' : 'Run Incremental'}
        </button>
        <button
          onClick={purgeSiblings}
          disabled={purgingSiblings || runningSiblings}
          className="px-3 py-1.5 text-xs font-semibold rounded bg-red-900/60 hover:bg-red-800/80 text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {purgingSiblings ? 'Purging…' : 'Purge & Full Redetect'}
        </button>
      </div>
      {/* Refresh timeout/error feedback — only shown when the poll bails out */}
      {refreshError && <p className="text-xs text-amber-400 mt-2">{refreshError}</p>}
    </div>
  ) : (
    <div className="text-xs text-slate-600 italic py-4 text-center">No sibling data available.</div>
  );
};
