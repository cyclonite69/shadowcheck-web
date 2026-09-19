import { useState, useEffect } from 'react';
import { RefreshCw, Database, CheckCircle, AlertTriangle, Globe, Terminal } from 'lucide-react';

interface AlprRegion {
  id: string;
  name: string;
  label?: string;
  bbox?: number[];
  cameraCount?: number;
}

interface SyncResult {
  regionId: string;
  regionLabel: string;
  upsertedCount: number;
  prunedCount: number;
  candidateCount: number;
  durationMs: number;
}

export function AlprSyncTab() {
  const [regions, setRegions] = useState<AlprRegion[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [pruneStale, setPruneStale] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const appendLog = (msg: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 49)]);
  };

  useEffect(() => {
    fetchRegions();
  }, []);

  const fetchRegions = async () => {
    try {
      const res = await fetch('/api/admin/alpr/regions');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Failed to load regions: ${res.statusText}`);
      }
      const data = await res.json();
      const regionList: AlprRegion[] = data.regions || [];
      setRegions(regionList);
      if (regionList.length > 0 && !selectedRegion) {
        setSelectedRegion(regionList[0].id);
      }
      appendLog(`Loaded ${regionList.length} ALPR sync regions.`);
    } catch (err: any) {
      setError(err.message);
      appendLog(`Error loading regions: ${err.message}`);
    }
  };

  const handleSync = async () => {
    if (!selectedRegion) {
      setError('Please select a target region.');
      return;
    }

    setLoading(true);
    setError(null);
    setSyncResult(null);
    appendLog(`Initiating ALPR sync for region: ${selectedRegion} (Prune: ${pruneStale})`);

    try {
      const res = await fetch('/api/admin/alpr/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: selectedRegion, prune: pruneStale }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Sync failed with status ${res.status}`);
      }

      const result: SyncResult = data.result;
      setSyncResult(result);
      appendLog(
        `Sync completed: ${result.upsertedCount} of ${result.candidateCount} upserted, ${result.prunedCount} pruned in ${result.durationMs}ms.`
      );
    } catch (err: any) {
      setError(err.message);
      appendLog(`Sync error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedRegionObj = regions.find((r) => r.id === selectedRegion);

  return (
    <div className="space-y-6 text-slate-100">
      {/* Header Banner Card */}
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
          onClick={handleSync}
          disabled={loading}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-cyan-950/50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Synchronizing...' : 'Execute Sync'}
        </button>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 flex items-center gap-3 text-rose-300">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* 3-Column Configuration & Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Target Configuration Card */}
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  {regions.map((reg) => {
                    const displayName = reg.name || reg.label || reg.id;
                    return (
                      <option key={reg.id} value={reg.id}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
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

        {/* Telemetry Stats Card */}
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
                  {syncResult?.durationMs ? `${syncResult.durationMs}ms` : '—'}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 text-[11px] text-slate-500">
            {syncResult
              ? `Region: ${syncResult.regionLabel} (${syncResult.regionId})`
              : 'Awaiting synchronization run...'}
          </div>
        </div>

        {/* Execution Log Card */}
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
