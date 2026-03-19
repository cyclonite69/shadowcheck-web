import React, { useEffect, useState } from 'react';
import { AdminCard } from '../components/AdminCard';
import { apiClient } from '../../../api/client';

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

export const WigleStatsTab: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/wigle/user-stats');
      if (response?.success) {
        setStats(response.stats);
        setError(null);
      } else {
        setError(response?.error || 'Failed to fetch stats');
      }
    } catch (err: any) {
      setError(err.message || 'API request failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Helper to access stats that might be at root or under statistics sub-object
  const getStat = (key: string) => stats?.[key] ?? stats?.statistics?.[key];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-900/20 border border-red-700/50 rounded-lg text-red-400">
        <h3 className="font-bold mb-2">WiGLE API Error</h3>
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchStats}
          className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors"
        >
          RETRY
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
              src={`https://wigle.net/bi/${getStat('user')}.png`}
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
    </div>
  );
};
