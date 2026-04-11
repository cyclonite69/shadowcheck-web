import React, { useEffect, useState } from 'react';
import { AdminCard } from '../components/AdminCard';
import { apiClient } from '../../../api/client';
import { useWigleRuns } from '../hooks/useWigleRuns';
import { formatShortDate } from '../../../utils/formatDate';

const TrophyIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const ChartIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 3v18h18" />
    <path d="m19 9-5 5-4-4-3 3" />
  </svg>
);

const BadgeIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
  </svg>
);

const RefreshIcon = ({ size = 16, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

const PlayIcon = ({ size = 16, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = ({ size = 16, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const CancelIcon = ({ size = 16, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

export const WigleStatsTab: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const {
    runs,
    report,
    loading: runsLoading,
    error: runsError,
    actionLoading,
    refresh: refreshRuns,
    resumeRun,
    pauseRun,
    cancelRun,
  } = useWigleRuns();

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/wigle/user-stats');
      if (response?.success) {
        setStats(response.stats);
        setStatsError(null);
      } else {
        setStatsError(response?.error || 'Failed to fetch stats');
      }
    } catch (err: any) {
      setStatsError(err.message || 'API request failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Helper to access stats that might be at root or under statistics sub-object
  const getStat = (key: string) => {
    // Map common aliases to raw WiGLE API field names
    const aliases: Record<string, string> = {
      discoveredBluetoothGPS: 'discoveredBtGPS',
      discoveredBluetooth: 'discoveredBt',
      firstTransID: 'first',
      lastTransID: 'last',
      totalWiFi: 'discoveredWiFi',
      totalBluetooth: 'discoveredBt',
      totalCell: 'discoveredCell',
      totalObservations: 'totalWiFiLocations',
      totalDiscovered: 'discoveredWiFiGPS', // Using WiFi GPS as proxy for total GPS if not aggregate
      eventDiscoveries: 'eventMonthCount',
    };

    const targetKey = aliases[key] || key;
    return stats?.[targetKey] ?? stats?.statistics?.[targetKey];
  };

  const badgeUrl = stats?.imageBadgeUrl
    ? `https://wigle.net${stats.imageBadgeUrl}`
    : `https://wigle.net/bi/${getStat('user')}.png`;

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {statsError && (
        <div className="p-6 bg-red-900/20 border border-red-700/50 rounded-lg text-red-400">
          <h3 className="font-bold mb-2">WiGLE API Error</h3>
          <p className="text-sm">{statsError}</p>
          <button
            onClick={fetchStats}
            className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors"
          >
            RETRY
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Ranking Card */}
        <AdminCard icon={TrophyIcon} title="User Ranking" color="from-yellow-500 to-yellow-600">
          <div className="flex flex-col items-center py-4">
            <div className="text-4xl font-black text-white mb-1">
              #{getStat('rank')?.toLocaleString() || '—'}
            </div>
            <div className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-6">
              Global Rank
            </div>

            <div className="w-full space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Username</span>
                <span className="text-white font-bold">{getStat('user') || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Class</span>
                <span className="text-white font-bold">{getStat('class') || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Points</span>
                <span className="text-white font-bold">
                  {getStat('points')?.toLocaleString() || '0'}
                </span>
              </div>
            </div>
          </div>
        </AdminCard>

        {/* Discovery Stats */}
        <AdminCard icon={ChartIcon} title="Discovery Totals" color="from-blue-500 to-blue-600">
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">WiFi</div>
                <div className="text-xl font-bold text-blue-400">
                  {getStat('discoveredWiFiGPS')?.toLocaleString() || '0'}
                </div>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Bluetooth</div>
                <div className="text-xl font-bold text-purple-400">
                  {getStat('discoveredBluetoothGPS')?.toLocaleString() || '0'}
                </div>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Cell</div>
                <div className="text-xl font-bold text-emerald-400">
                  {getStat('discoveredCellGPS')?.toLocaleString() || '0'}
                </div>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total GPS</div>
                <div className="text-xl font-bold text-white">
                  {getStat('totalDiscovered')?.toLocaleString() || '0'}
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-800">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">First Discovery</span>
                <span className="text-slate-300">
                  {getStat('firstTransID')?.substring(0, 8) || '—'}
                </span>
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-slate-500">Last Discovery</span>
                <span className="text-slate-300">
                  {getStat('lastTransID')?.substring(0, 8) || '—'}
                </span>
              </div>
            </div>
          </div>
        </AdminCard>

        {/* WiGLE Badge */}
        <AdminCard icon={BadgeIcon} title="Official Badge" color="from-purple-500 to-purple-600">
          <div className="flex flex-col items-center justify-center h-full py-4">
            <img
              src={badgeUrl}
              alt="WiGLE Badge"
              className="rounded-lg shadow-2xl border border-slate-700"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://wigle.net/bi/wigle.png';
              }}
            />
            <p className="text-[10px] text-slate-500 mt-4 text-center italic">
              Live ranking badge from WiGLE.net
            </p>
            <a
              href={`https://wigle.net/user/${getStat('user')}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 text-xs text-blue-400 hover:text-blue-300 underline"
            >
              View Full Profile
            </a>
          </div>
        </AdminCard>
      </div>

      {/* Additional Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800/20 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Observation Breakdown
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Total Observations</span>
              <span className="text-white font-mono">
                {getStat('totalObservations')?.toLocaleString() || '—'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Total WiFi</span>
              <span className="text-white font-mono">
                {getStat('totalWiFi')?.toLocaleString() || '—'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Total Bluetooth</span>
              <span className="text-white font-mono">
                {getStat('totalBluetooth')?.toLocaleString() || '—'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Total Cell</span>
              <span className="text-white font-mono">
                {getStat('totalCell')?.toLocaleString() || '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/20 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            Milestones & Totals
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Ever Found WiFi</span>
              <span className="text-white font-mono">
                {getStat('discoveredWiFi')?.toLocaleString() || '—'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Ever Found Bluetooth</span>
              <span className="text-white font-mono">
                {getStat('discoveredBluetooth')?.toLocaleString() || '—'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Ever Found Cell</span>
              <span className="text-white font-mono">
                {getStat('discoveredCell')?.toLocaleString() || '—'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">Event Discoveries</span>
              <span className="text-white font-mono">
                {getStat('eventDiscoveries')?.toLocaleString() || '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* WiGLE Import Runs Section */}
      <AdminCard
        icon={RefreshIcon}
        title="Recent WiGLE Imports & Resumption"
        color="from-rose-500 to-rose-600"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-400">
              Automated search loops. Resumable via cursor-based pagination.
            </p>
            <button
              onClick={refreshRuns}
              disabled={runsLoading || actionLoading}
              className="p-1.5 text-slate-400 hover:text-white transition-colors disabled:opacity-30"
              title="Refresh Runs"
            >
              <RefreshIcon className={runsLoading ? 'animate-spin' : ''} size={18} />
            </button>
          </div>

          {runsError && (
            <div className="p-3 bg-red-900/20 border border-red-700/50 rounded text-red-400 text-xs">
              {runsError}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-700/50">
            <table className="w-full text-[11px] text-left text-slate-300">
              <thead className="bg-slate-800/50 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Progress</th>
                  <th className="px-3 py-2">Last Active</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {runs.length === 0 && !runsLoading && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500 italic">
                      No recent import runs found.
                    </td>
                  </tr>
                )}
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-700/20 group">
                    <td className="px-3 py-2 font-mono text-slate-500">#{run.id}</td>
                    <td className="px-3 py-2">
                      <div className="font-bold text-slate-200">
                        {run.state || 'Global'} / {run.searchTerm}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-1.5 py-0.5 rounded-full font-bold uppercase text-[9px] border ${
                          run.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : run.status === 'running'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : run.status === 'failed'
                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500">
                            P{run.pagesFetched}/{run.totalPages || '?'}
                          </span>
                          <span className="text-slate-400 font-mono">
                            {run.rowsInserted.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              run.status === 'completed'
                                ? 'bg-emerald-500'
                                : run.status === 'failed'
                                  ? 'bg-red-500'
                                  : 'bg-blue-500'
                            }`}
                            style={{
                              width: `${
                                run.totalPages
                                  ? Math.min(100, (run.pagesFetched / run.totalPages) * 100)
                                  : 10
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                      {run.lastAttemptedAt
                        ? formatShortDate(run.lastAttemptedAt)
                        : formatShortDate(run.startedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center gap-1">
                        {(run.status === 'paused' || run.status === 'failed') && (
                          <button
                            onClick={() => resumeRun(run.id)}
                            disabled={actionLoading}
                            className="p-1.5 text-emerald-500 hover:bg-emerald-500/20 rounded transition-all disabled:opacity-20"
                            title="Resume Import"
                          >
                            <PlayIcon />
                          </button>
                        )}
                        {run.status === 'running' && (
                          <button
                            onClick={() => pauseRun(run.id)}
                            disabled={actionLoading}
                            className="p-1.5 text-amber-500 hover:bg-amber-500/20 rounded transition-all disabled:opacity-20"
                            title="Pause Import"
                          >
                            <PauseIcon />
                          </button>
                        )}
                        {(run.status === 'running' ||
                          run.status === 'paused' ||
                          run.status === 'failed') && (
                          <button
                            onClick={() => cancelRun(run.id)}
                            disabled={actionLoading}
                            className="p-1.5 text-red-500 hover:bg-red-500/20 rounded transition-all disabled:opacity-20"
                            title="Cancel/Archive Run"
                          >
                            <CancelIcon />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report && (
            <div className="mt-6 pt-4 border-t border-slate-700/30">
              <h4 className="text-xs font-bold text-slate-300 uppercase mb-3 flex items-center justify-between">
                <span>Coverage Snapshot</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Updated: {new Date(report.generatedAt).toLocaleTimeString()}
                </span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {report.states
                  .filter((s) => s.storedCount > 0 || s.runId)
                  .slice(0, 15)
                  .map((s) => (
                    <div
                      key={s.state}
                      className="p-2 bg-slate-900/40 rounded border border-slate-800/60 flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-black text-white">{s.state}</span>
                        <span
                          className={`text-[9px] px-1 rounded ${
                            s.status === 'completed'
                              ? 'text-emerald-400 bg-emerald-500/5'
                              : s.status === 'failed'
                                ? 'text-red-400 bg-red-500/5'
                                : s.status === 'running'
                                  ? 'text-blue-400 bg-blue-500/5'
                                  : 'text-slate-600'
                          }`}
                        >
                          {s.status === 'completed' ? '✓' : s.status ? '...' : ''}
                        </span>
                      </div>
                      <div className="text-lg font-bold text-slate-100">
                        {s.storedCount.toLocaleString()}
                      </div>
                      <div className="text-[9px] text-slate-500 uppercase font-semibold">
                        Networks
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </AdminCard>
    </div>
  );
};
