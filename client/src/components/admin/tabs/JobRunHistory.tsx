import React from 'react';
import { JobRunHistoryEntry, JobRuntimeStatus } from './jobTypes';
import { formatDuration, formatTimestamp } from './jobUtils';

export function JobRunHistory({
  status,
  onRefresh,
}: {
  status: JobRuntimeStatus | undefined;
  onRefresh: () => void;
}) {
  const lastRun = status?.lastRun;
  const currentRun = status?.currentRun;

  return (
    <div className="space-y-3 rounded-lg border border-slate-700/50 bg-slate-950/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Runtime Status
        </span>
        <button
          type="button"
          onClick={onRefresh}
          className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-white"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-slate-500">Next Run</div>
          <div className="mt-1 text-slate-200">{formatTimestamp(status?.nextRun)}</div>
        </div>
        <div>
          <div className="text-slate-500">Last Result</div>
          <div className="mt-1 text-slate-200">
            {lastRun ? (
              <span
                className={
                  lastRun.status === 'failed'
                    ? 'text-red-400'
                    : lastRun.status === 'completed'
                      ? 'text-emerald-400'
                      : 'text-blue-400'
                }
              >
                {lastRun.status}
              </span>
            ) : (
              'No runs yet'
            )}
          </div>
        </div>
      </div>

      {currentRun ? (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">
          Running now since {formatTimestamp(currentRun.startedAt)}
        </div>
      ) : null}

      {lastRun ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
          <div>Started: {formatTimestamp(lastRun.startedAt)}</div>
          <div>Finished: {formatTimestamp(lastRun.finishedAt)}</div>
          <div>Duration: {formatDuration(lastRun.durationMs)}</div>
          {lastRun.error ? <div className="mt-1 text-red-400">Error: {lastRun.error}</div> : null}
        </div>
      ) : null}

      {(status?.recentRuns?.length || 0) > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recent Runs
          </div>
          <div className="space-y-2">
            {status?.recentRuns.slice(0, 3).map((run: JobRunHistoryEntry) => (
              <div
                key={run.id}
                className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{formatTimestamp(run.startedAt)}</span>
                  <span
                    className={
                      run.status === 'failed'
                        ? 'text-red-400'
                        : run.status === 'completed'
                          ? 'text-emerald-400'
                          : 'text-blue-400'
                    }
                  >
                    {run.status}
                  </span>
                </div>
                <div className="mt-1 text-slate-500">{run.cron}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
