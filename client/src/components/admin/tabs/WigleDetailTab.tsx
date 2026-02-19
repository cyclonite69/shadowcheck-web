import React, { useState } from 'react';
import { AdminCard } from '../components/AdminCard';
import { useWigleDetail, type WigleDetailType } from '../hooks/useWigleDetail';
import { useWigleFileUpload } from '../../../hooks/useWigleFileUpload';
import { renderNetworkTooltip } from '../../../utils/geospatial/renderNetworkTooltip';

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
  const { loading, error, data, observations, imported, fetchDetail } = useWigleDetail();
  const { uploadError, uploadSuccess, uploadFile, reset } = useWigleFileUpload();

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
                  {data.ssid || data.name || '<Hidden>'}
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

            {/* Tooltip Preview (Unified Design) */}
            <div className="bg-slate-900/40 p-4 rounded border border-slate-700/50">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">
                Forensic Tooltip Preview
              </h4>
              <div className="flex justify-center bg-slate-950/50 p-6 rounded-lg border border-slate-800 shadow-inner">
                <div
                  dangerouslySetInnerHTML={{
                    __html: renderNetworkTooltip({
                      ssid: data.ssid || data.name,
                      bssid: data.networkId,
                      encryption: data.encryption,
                      security: data.encryption,
                      frequency: data.frequency,
                      channel: data.channel,
                      lat: data.trilateratedLatitude,
                      lon: data.trilateratedLongitude,
                      first_seen: data.firstSeen,
                      last_seen: data.lastSeen,
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
                    }),
                  }}
                />
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
                <div className="text-sm text-white">
                  {new Date(data.firstSeen).toLocaleDateString()}
                </div>
              </div>
              <div className="bg-slate-800/30 p-3 rounded">
                <div className="text-xs text-slate-500 mb-1">Last Seen</div>
                <div className="text-sm text-white">
                  {new Date(data.lastSeen).toLocaleDateString()}
                </div>
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
                              {new Date(obs.observed_at).toLocaleString()}
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
                Successfully imported to database ✓
                {observations.length > 0 && ` (${observations.length} observations)`}
              </div>
            )}
          </div>
        </AdminCard>
      )}
    </div>
  );
};
