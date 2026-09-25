import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Database, CheckCircle, AlertTriangle, Globe, Terminal } from 'lucide-react';

type DurableSyncStatus = 'idle' | 'running' | 'success' | 'failed';

interface AlprRegion {
  id: string;
  name: string;
  label?: string;
  state?: string;
  bbox?: number[];
  cameraCount?: number;
  syncStatus?: DurableSyncStatus;
  lastSyncAt?: string | null;
  lastChunkCount?: number | null;
  lastElementCount?: number | null;
  cooldownUntil?: string | null;
}

interface SyncResult {
  regionId: string;
  regionLabel: string;
  upsertedCount: number;
  prunedCount: number;
  candidateCount: number;
  durationMs: number;
}

type InMemoryJobStatus = 'dispatched' | 'running' | 'completed' | 'failed';

interface SyncJob {
  jobId: string;
  regionId: string;
  status: InMemoryJobStatus;
  startTime: string;
  endTime?: string;
  error?: string;
  result?: SyncResult;
}

/** Clear tracked job id only on terminal statuses — not dispatched/running. */
export function shouldClearActiveJobId(status: InMemoryJobStatus): boolean {
  return status === 'completed' || status === 'failed';
}

function statusBadgeClass(status: DurableSyncStatus): string {
  switch (status) {
    case 'success':
      return 'text-emerald-300 bg-emerald-950/50 border-emerald-800/60';
    case 'failed':
      return 'text-rose-300 bg-rose-950/50 border-rose-800/60';
    case 'running':
      return 'text-cyan-300 bg-cyan-950/50 border-cyan-800/60 animate-pulse';
    case 'idle':
    default:
      return 'text-slate-400 bg-slate-950/60 border-slate-800/60';
  }
}

function formatSyncTime(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') {
    return 'Never';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function elementCountDisplay(count: number | null | undefined): number {
  return count === null || count === undefined ? 0 : count;
}

function durableStatusOf(region: AlprRegion | undefined): DurableSyncStatus {
  return region?.syncStatus ?? 'idle';
}

export function AlprSyncTab() {
  const [regions, setRegions] = useState<AlprRegion[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [pruneStale, setPruneStale] = useState<boolean>(false);
  const [dispatching, setDispatching] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const appendLog = useCallback((msg: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 49)]);
  }, []);

  const applyRegionList = useCallback(
    (regionList: AlprRegion[], options?: { preserveOptimisticRunningFor?: string | null }) => {
      const preserveId = options?.preserveOptimisticRunningFor;
      setRegions((prev) => {
        const merged = regionList.map((incoming) => {
          if (!preserveId || incoming.id !== preserveId) {
            return incoming;
          }
          const prior = prev.find((r) => r.id === preserveId);
          // Quiet poll can return durable idle before markRegionSyncRunning commits;
          // do not clobber optimistic 'running' with that stale idle snapshot.
          if (
            prior?.syncStatus === 'running' &&
            (incoming.syncStatus === 'idle' ||
              incoming.syncStatus === null ||
              incoming.syncStatus === undefined)
          ) {
            return { ...incoming, syncStatus: 'running' as const };
          }
          return incoming;
        });
        return merged;
      });
      setSelectedRegion((prev) => {
        if (prev && regionList.some((r) => r.id === prev)) {
          return prev;
        }
        return regionList[0]?.id ?? '';
      });
    },
    []
  );

  const fetchRegions = useCallback(
    async (
      signal?: AbortSignal,
      options?: { quiet?: boolean; preserveOptimisticRunningFor?: string | null }
    ) => {
      const quiet = options?.quiet === true;
      try {
        const res = await fetch('/api/v1/admin/alpr/regions', { signal });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string })?.error || `Failed to load regions: ${res.statusText}`
          );
        }
        const data = (await res.json()) as { regions?: AlprRegion[] };
        const regionList = data.regions ?? [];
        applyRegionList(regionList, {
          preserveOptimisticRunningFor: options?.preserveOptimisticRunningFor,
        });
        if (!quiet) {
          appendLog(`Loaded ${regionList.length} ALPR sync regions.`);
        }
        return regionList;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        if (!quiet) {
          appendLog(`Error loading regions: ${message}`);
        }
        return null;
      }
    },
    [appendLog, applyRegionList]
  );

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    void fetchRegions(controller.signal);
    return () => {
      controller.abort();
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [fetchRegions]);

  const hasRunningRegion = regions.some((r) => durableStatusOf(r) === 'running');
  // Keep polling while a job we dispatched is still tracked — durable status can
  // briefly regress to idle (stale GET overlapping optimistic 'running') and the
  // job may finish faster than one poll interval.
  const shouldPollRegions = hasRunningRegion || activeJobId !== null || dispatching;

  // Conditional short-polling: reconcile local UI with durable Postgres state
  // while a sync is in flight (durable running and/or tracked job id).
  useEffect(() => {
    if (!shouldPollRegions) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const controller = new AbortController();
    const preserveId =
      activeJobId !== null || dispatching || hasRunningRegion ? selectedRegion : null;
    const tick = () => {
      void fetchRegions(controller.signal, {
        quiet: true,
        preserveOptimisticRunningFor: preserveId,
      });
    };

    tick();
    pollTimerRef.current = setInterval(tick, 3000);

    return () => {
      controller.abort();
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [shouldPollRegions, fetchRegions, activeJobId, selectedRegion, dispatching, hasRunningRegion]);

  // When durable state leaves 'running', pull in-memory job telemetry for the panel.
  useEffect(() => {
    if (!activeJobId || !selectedRegion) {
      return;
    }
    const selected = regions.find((r) => r.id === selectedRegion);
    const status = durableStatusOf(selected);
    if (status === 'running') {
      return;
    }

    const controller = new AbortController();
    const jobId = activeJobId;
    void (async () => {
      try {
        const res = await fetch(
          `/api/v1/admin/alpr/sync/status?regionId=${encodeURIComponent(selectedRegion)}`,
          { signal: controller.signal }
        );
        const data = (await res.json().catch(() => ({}))) as {
          jobs?: SyncJob[];
          error?: string;
        };
        if (!res.ok) {
          return;
        }
        const job = data.jobs?.find((candidate) => candidate.jobId === jobId);
        if (!job) {
          return;
        }
        // Only clear the tracked job once it reaches a terminal state. Clearing
        // on dispatched/running drops the poll loop and leaves the button stuck
        // when a quiet regions GET overwrote optimistic 'running' with idle.
        if (!shouldClearActiveJobId(job.status)) {
          return;
        }
        if (job.status === 'completed') {
          setSyncResult(job.result ?? null);
          appendLog(`Sync ${job.jobId} completed.`);
          setActiveJobId(null);
          void fetchRegions(undefined, { quiet: true });
        } else if (job.status === 'failed') {
          setError(job.error || 'ALPR sync failed.');
          appendLog(`Sync ${job.jobId} failed: ${job.error || 'unknown error'}`);
          setActiveJobId(null);
          void fetchRegions(undefined, { quiet: true });
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    })();

    return () => controller.abort();
  }, [activeJobId, selectedRegion, regions, appendLog, fetchRegions]);

  const handleSync = async () => {
    if (!selectedRegion) {
      setError('Please select a target region.');
      return;
    }

    const regionId = selectedRegion;
    const previous = regions.find((r) => r.id === regionId);
    if (!previous) {
      setError('Selected region is not loaded.');
      return;
    }

    setDispatching(true);
    setError(null);
    setSyncResult(null);
    setActiveJobId(null);
    appendLog(`Initiating ALPR sync for region: ${regionId} (Prune: ${pruneStale})`);

    // Optimistic UI: mark durable status running before the POST resolves.
    setRegions((prev) =>
      prev.map((r) => (r.id === regionId ? { ...r, syncStatus: 'running' as const } : r))
    );

    try {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      const res = await fetch('/api/v1/admin/alpr/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regionId, prune: pruneStale }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => ({}))) as {
        jobId?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Sync failed with status ${res.status}`);
      }

      if (data.jobId) {
        setActiveJobId(data.jobId);
        appendLog(`Sync ${data.jobId} dispatched; reconciling via region status polling.`);
      } else {
        appendLog('Sync dispatched; reconciling via region status polling.');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      // Revert to last known durable snapshot for this region.
      setRegions((prev) => prev.map((r) => (r.id === regionId ? previous : r)));
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      appendLog(`Sync error: ${message}`);
    } finally {
      setDispatching(false);
    }
  };

  const selectedRegionObj = regions.find((r) => r.id === selectedRegion);
  const durableStatus = durableStatusOf(selectedRegionObj);
  const isSyncing = durableStatus === 'running' || dispatching;

  return (
    <div className="space-y-6 text-slate-100">
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            ALPR Camera Synchronization Manager
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Synchronize, ingest, and maintain Automated License Plate Recognition nodes via Overpass
            and PostGIS spatial indexes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={isSyncing || !selectedRegion}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-cyan-950/50"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Execute Sync'}
        </button>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 flex items-center gap-3 text-rose-300">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              Target Configuration
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Region Target
                </label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  disabled={isSyncing}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {regions.map((reg) => {
                    const displayName = reg.name || reg.label || reg.id;
                    const status = durableStatusOf(reg);
                    const count = elementCountDisplay(reg.lastElementCount);
                    return (
                      <option key={reg.id} value={reg.id}>
                        {displayName} — {status} · {count}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div
                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs font-medium ${statusBadgeClass(durableStatus)}`}
              >
                Durable status: {durableStatus}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="block text-slate-500 mb-0.5">Last sync</span>
                  <span className="font-mono text-slate-300">
                    {formatSyncTime(selectedRegionObj?.lastSyncAt)}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500 mb-0.5">Last elements</span>
                  <span className="font-mono text-slate-300">
                    {elementCountDisplay(selectedRegionObj?.lastElementCount)}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-medium text-slate-300">
                      Prune Stale Records
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      Delete nodes not seen in this refresh
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={pruneStale}
                    onChange={(e) => setPruneStale(e.target.checked)}
                    disabled={isSyncing}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                </div>
                {pruneStale && (
                  <p className="mt-2 text-[11px] text-amber-400/90 bg-amber-950/30 border border-amber-800/40 rounded p-2">
                    Warning: Pruning permanently deletes cameras inside this region that are absent
                    from the latest Overpass fetch.
                  </p>
                )}
              </div>
            </div>
          </div>

          {selectedRegionObj?.bbox && (
            <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs font-mono text-slate-400">
              <span className="text-slate-500 block mb-1">BBOX METRICS:</span>
              {JSON.stringify(selectedRegionObj.bbox)}
            </div>
          )}
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Telemetry Stats
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
                <span className="block text-[10px] uppercase text-slate-500 font-mono">
                  Upserts
                </span>
                <span className="text-xl font-bold font-mono text-cyan-400">
                  {syncResult ? `${syncResult.upsertedCount} / ${syncResult.candidateCount}` : '—'}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
                <span className="block text-[10px] uppercase text-slate-500 font-mono">Pruned</span>
                <span className="text-xl font-bold font-mono text-amber-400">
                  {syncResult?.prunedCount ?? '—'}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60 col-span-2">
                <span className="block text-[10px] uppercase text-slate-500 font-mono">
                  Duration
                </span>
                <span className="text-lg font-bold font-mono text-slate-200">
                  {syncResult?.durationMs !== null && syncResult?.durationMs !== undefined
                    ? `${syncResult.durationMs}ms`
                    : '—'}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 text-[11px] text-slate-500">
            {syncResult
              ? `Region: ${syncResult.regionLabel} (${syncResult.regionId})`
              : isSyncing
                ? 'Synchronization in progress…'
                : 'Awaiting synchronization run...'}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-400" />
            Execution Log
          </h3>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-300 h-48 overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <span className="text-slate-600">No logs recorded yet.</span>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="leading-tight break-all">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlprSyncTab;
export { AlprSyncTab as ALPRSyncManagerTab };
