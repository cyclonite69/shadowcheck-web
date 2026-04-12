import React, { useEffect, useState } from 'react';
import { AdminCard } from '../components/AdminCard';
import { useWigleDetail, type WigleDetailType } from '../hooks/useWigleDetail';
import { useWigleFileUpload } from '../../../hooks/useWigleFileUpload';
import { useWigleRuns } from '../hooks/useWigleRuns';
import { wigleApi } from '../../../api/wigleApi';
import { renderNetworkTooltip } from '../../../utils/geospatial/renderNetworkTooltip';
import { normalizeTooltipData } from '../../../utils/geospatial/tooltipDataNormalizer';
import { formatShortDate } from '../../../utils/formatDate';
import { WigleRunsCard } from '../components/WigleRunsCard';
import { V3EnrichmentManagerTable } from './data-import/V3EnrichmentManagerTable';

const SearchIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const DetailIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export const WigleDetailTab: React.FC = () => {
  const [netid, setNetid] = useState('');
  const [detailType, setDetailType] = useState<WigleDetailType>('wifi');
  const {
    loading,
    error,
    data,
    observations,
    imported,
    newObservations,
    totalObservations,
    fetchDetail,
  } = useWigleDetail();
  const { uploadError, uploadSuccess, uploadFile, reset } = useWigleFileUpload();

  const [pendingEnrichment, setPendingEnrichment] = useState<number | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);

  const {
    runs,
    loading: runsLoading,
    error: runsError,
    actionLoading,
    refresh: refreshRuns,
    resumeRun: originalResume,
    pauseRun,
    cancelRun,
  } = useWigleRuns({ limit: 10 });

  const resumeRun = async (id: number) => {
    try {
      const data = await wigleApi.resumeEnrichment(id);
      if (data?.ok) {
        await refreshRuns();
      }
    } catch (e: any) {
      alert(`Failed to resume enrichment: ${e.message}`);
    }
  };

  const loadEnrichmentStats = async () => {
    try {
      const data = await wigleApi.getEnrichmentStats();
      if (data?.ok) {
        setPendingEnrichment(data.pendingCount);
      }
    } catch (e) {
      console.error('Failed to load enrichment stats', e);
    }
  };

  useEffect(() => {
    void loadEnrichmentStats();
  }, []);

  const handleStartEnrichment = async () => {
    try {
      const bssids = isManualMode
        ? manualBssids
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter((s) => s.length > 5)
        : undefined;

      const data = await wigleApi.startEnrichment(bssids);
      if (data?.ok) {
        await refreshRuns();
        void loadEnrichmentStats();
        if (isManualMode) setManualBssids('');
      }
    } catch (e: any) {
      alert(`Failed to start enrichment: ${e.message}`);
    }
  };

  const handleSearch = (shouldImport: boolean) => {
    reset();
    fetchDetail(netid, shouldImport, detailType);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const networkId = await uploadFile(file);
    if (networkId) {
      setNetid(networkId);
      fetchDetail(networkId, false, detailType);
    }

    // Reset input
    event.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <AdminCard
        icon={SearchIcon}
        title="Network Detail Lookup (v3)"
        color="from-cyan-500 to-cyan-600"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Fetch deep forensic details for a single network from WiGLE API v3 or upload a JSON
            file.
          </p>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded border border-slate-600/60 overflow-hidden">
              {(['wifi', 'bt'] as WigleDetailType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDetailType(type)}
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                    detailType === type
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {type === 'wifi' ? 'Wi-Fi' : 'BT/BLE'}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={netid}
              onChange={(e) => setNetid(e.target.value)}
              placeholder={
                detailType === 'wifi'
                  ? 'Enter Wi-Fi BSSID (e.g., 00:11:22:33:44:55)'
                  : 'Enter BT Network ID (e.g., EC:81:93:76:BD:CE)'
              }
              className="flex-1 px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
            />
            <button
              onClick={() => handleSearch(false)}
              disabled={loading || !netid}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium disabled:opacity-50 text-sm transition-all"
            >
              Lookup
            </button>
            <button
              onClick={() => handleSearch(true)}
              disabled={loading || !netid}
              className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium disabled:opacity-50 text-sm transition-all"
            >
              Lookup & Import
            </button>

            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                id="wigle-json-upload"
              />
              <label
                htmlFor="wigle-json-upload"
                className="flex items-center justify-center px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium cursor-pointer text-sm transition-all h-full"
                title="Upload v3 JSON"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </label>
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm p-3 bg-red-900/20 rounded border border-red-700/50">
              {error}
            </div>
          )}
          {uploadError && (
            <div className="text-red-400 text-sm p-3 bg-red-900/20 rounded border border-red-700/50">
              Upload Error: {uploadError}
            </div>
          )}
          {uploadSuccess && (
            <div className="text-green-400 text-sm p-3 bg-green-900/20 rounded border border-green-700/50">
              Success: {uploadSuccess}
            </div>
          )}
        </div>
      </AdminCard>

      {/* Results */}
      {data && (
        <AdminCard
          icon={DetailIcon}
          title="Network Forensics"
          color="from-violet-500 to-violet-600"
        >
          <div className="space-y-6">
            {/* Header Info */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-700/50">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">
                  {data.ssid || data.name || '(hidden)'}
                </h3>
                <div className="font-mono text-cyan-400 text-sm">{data.networkId}</div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-xs text-slate-400">Encryption</div>
                <div className="text-sm font-medium text-white px-2 py-0.5 bg-slate-700 rounded inline-block">
                  {data.encryption || 'N/A'}
                </div>
              </div>
            </div>

            {/* Forensic Snapshot Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/40 p-4 rounded border border-slate-700/50">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">
                  Forensic Snapshot
                </h4>
                <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      WiGLE Observations
                    </span>
                    <span className="text-lg font-black text-cyan-400 font-mono">
                      {totalObservations.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      Local Matches
                    </span>
                    <span className="text-lg font-black text-emerald-400 font-mono">
                      {(totalObservations - newObservations).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      New Records
                    </span>
                    <span className="text-lg font-black text-amber-400 font-mono">
                      {newObservations.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">
                      Quality Score
                    </span>
                    <span className="text-lg font-black text-white font-mono">
                      {data.bestClusterWiGLEQoS !== null && data.bestClusterWiGLEQoS !== undefined
                        ? `${((data.bestClusterWiGLEQoS / 7) * 100).toFixed(0)}%`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tooltip Preview (Unified Design) */}
              <div className="bg-slate-900/40 p-4 rounded border border-slate-700/50">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">
                  Forensic Tooltip Preview
                </h4>
                <div className="flex justify-center bg-slate-950/50 p-4 rounded-lg border border-slate-800 shadow-inner overflow-hidden">
                  <div
                    className="scale-[0.85] origin-top"
                    dangerouslySetInnerHTML={{
                      __html: renderNetworkTooltip(
                        normalizeTooltipData({
                          ...data,
                          netid: data.networkId,
                          ssid: data.ssid || data.name,
                          type:
                            data.type?.toLowerCase() === 'wifi'
                              ? 'W'
                              : data.type?.toLowerCase() === 'gsm'
                                ? 'G'
                                : data.type?.toLowerCase() === 'lte'
                                  ? 'L'
                                  : data.type?.toLowerCase() === 'ble'
                                    ? 'E'
                                    : data.type?.toLowerCase() === 'bt'
                                      ? 'B'
                                      : 'W',
                          observation_count: observations?.length || 0,
                          accuracy: data.locationClusters?.[0]?.accuracy || null,
                          ...data.streetAddress,
                          qos: data.bestClusterWiGLEQoS,
                          comment: data.comment,
                        })
                      ),
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Address & Location */}
            {data.streetAddress && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/40 p-4 rounded border border-slate-700/50">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">
                    Address Intelligence
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Street:</span>
                      <span className="text-slate-200">
                        {data.streetAddress.housenumber} {data.streetAddress.road}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">City:</span>
                      <span className="text-slate-200">{data.streetAddress.city}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Region:</span>
                      <span className="text-slate-200">
                        {data.streetAddress.region}, {data.streetAddress.country}{' '}
                        {data.streetAddress.postalcode}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/40 p-4 rounded border border-slate-700/50">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Trilateration</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Latitude:</span>
                      <span className="text-cyan-300 font-mono">{data.trilateratedLatitude}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Longitude:</span>
                      <span className="text-cyan-300 font-mono">{data.trilateratedLongitude}</span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-700/50 text-xs text-slate-500">
                      Based on signal clustering analysis
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-slate-800/30 p-3 rounded">
                <div className="text-xs text-slate-500 mb-1">First Seen</div>
                <div className="text-sm text-white">{formatShortDate(data.firstSeen)}</div>
              </div>
              <div className="bg-slate-800/30 p-3 rounded">
                <div className="text-xs text-slate-500 mb-1">Last Seen</div>
                <div className="text-sm text-white">{formatShortDate(data.lastSeen)}</div>
              </div>
              <div className="bg-slate-800/30 p-3 rounded">
                <div className="text-xs text-slate-500 mb-1">Channel</div>
                <div className="text-sm text-white">{data.channel ?? 'N/A'}</div>
              </div>
            </div>

            {/* Observations Table */}
            {observations && observations.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">
                    Individual Observation Points ({observations.length})
                  </h4>
                  <div className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                    Deep Forensic Data
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded border border-slate-700/50 overflow-hidden">
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="sticky top-0 bg-slate-800 text-slate-400 font-semibold border-b border-slate-700">
                        <tr>
                          <th className="px-3 py-2">Timestamp</th>
                          <th className="px-3 py-2 text-right">Signal</th>
                          <th className="px-3 py-2 text-right">Altitude</th>
                          <th className="px-3 py-2">Lat/Lon</th>
                          <th className="px-3 py-2">SSID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {observations.map((obs) => (
                          <tr key={obs.id} className="hover:bg-slate-800/30 text-slate-300">
                            <td className="px-3 py-2 whitespace-nowrap">
                              {formatShortDate(obs.observed_at)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span
                                className={`${
                                  obs.signal > -70
                                    ? 'text-green-400'
                                    : obs.signal > -85
                                      ? 'text-yellow-400'
                                      : 'text-red-400'
                                }`}
                              >
                                {obs.signal} dBm
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-slate-400 font-mono">
                              {obs.altitude ? `${obs.altitude}m` : '-'}
                            </td>
                            <td className="px-3 py-2 font-mono text-cyan-500/80">
                              {obs.latitude.toFixed(5)}, {obs.longitude.toFixed(5)}
                            </td>
                            <td className="px-3 py-2 italic text-slate-400">{obs.ssid || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Import Status */}
            {imported && (
              <div className="bg-green-900/20 border border-green-800/50 p-3 rounded text-center text-sm text-green-400">
                {newObservations > 0
                  ? totalObservations > newObservations
                    ? `Imported ${newObservations} new records (had ${totalObservations - newObservations}, now ${totalObservations} total) ✓`
                    : `Imported ${newObservations} records ✓`
                  : totalObservations > 0
                    ? `No new records — all ${totalObservations} already in database ✓`
                    : 'Imported to database ✓'}
              </div>
            )}
          </div>
        </AdminCard>
      )}

      {/* Batch Enrichment Section */}
      <AdminCard icon={DetailIcon} title="Batch v3 Enrichment" color="from-blue-500 to-indigo-600">
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-slate-300 font-bold">Enrich v2 Records</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Automatically fetch deep forensics and observation clusters for networks discovered
                via v2 search that don't have v3 details yet.
              </p>
            </div>
            {pendingEnrichment !== null && (
              <div className="text-right px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-xl font-black text-blue-400">
                  {pendingEnrichment.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                  Pending
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="manual-enrich-toggle"
                checked={isManualMode}
                onChange={(e) => setIsManualMode(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500/20"
              />
              <label htmlFor="manual-enrich-toggle" className="text-xs text-slate-300 font-medium">
                Targeted Selection Mode (Select from Catalog)
              </label>
            </div>

            {isManualMode ? (
              <V3EnrichmentManagerTable
                onEnrich={async (bssids) => {
                  const data = await wigleApi.startEnrichment(bssids);
                  if (data?.ok) {
                    await refreshRuns();
                    void loadEnrichmentStats();
                  }
                }}
                onSelect={(bssid) => {
                  setNetid(bssid);
                  fetchDetail(bssid, false, detailType);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                isLoading={actionLoading}
              />
            ) : (
              <button
                onClick={handleStartEnrichment}
                disabled={runsLoading || actionLoading || (pendingEnrichment || 0) === 0}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-xs shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                Start Batch Enrichment (Full Backlog)
              </button>
            )}
          </div>
        </div>
      </AdminCard>

      {/* Progress Table */}
      {runs.some(
        (r) =>
          r.source === 'v3_batch' || r.source === 'v3_manual' || r.state?.includes('Enrichment')
      ) && (
        <WigleRunsCard
          runs={runs.filter(
            (r) =>
              r.source === 'v3_batch' || r.source === 'v3_manual' || r.state?.includes('Enrichment')
          )}
          loading={runsLoading}
          actionLoading={actionLoading}
          error={runsError}
          onRefresh={refreshRuns}
          onResume={resumeRun}
          onPause={pauseRun}
          onCancel={cancelRun}
        />
      )}
    </div>
  );
};
