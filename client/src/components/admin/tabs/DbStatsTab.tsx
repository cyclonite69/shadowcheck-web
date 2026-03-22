import React, { useEffect, useState } from 'react';
import { AdminCard } from '../components/AdminCard';
import { apiClient } from '../../../api/client';

const DatabaseIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
    <path d="M3 12A9 3 0 0 0 21 12" />
  </svg>
);

const ActivityIcon = ({ size = 20, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const TrendingUpIcon = ({ size = 20, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

interface TableStat {
  table_name: string;
  row_count: string;
  size_bytes: string;
  size_pretty: string;
  total_inserts: string;
  total_updates: string;
  total_deletes: string;
  last_active: string | null;
  index_reads: string;
  sequential_reads: string;
}

interface MVStat {
  view_name: string;
  is_populated: boolean;
  size_pretty: string;
  seq_scan: string;
  seq_tup_read: string;
  last_active: string | null;
}

interface UnusedIndex {
  table_name: string;
  index_name: string;
  scan_count: string;
  size_pretty: string;
  size_bytes: string;
}

interface DbStats {
  total_db_size: string;
  tables: TableStat[];
  categories: Record<string, string[]>;
  materialized_views: MVStat[];
  unused_indexes: UnusedIndex[];
}

export const DbStatsTab: React.FC = () => {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/db-stats');
      setStats(response);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch DB stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const getTablesByCategory = (category: string) => {
    if (!stats) return [];
    const tableNames = stats.categories[category] || [];
    return stats.tables.filter((t) => tableNames.includes(t.table_name));
  };

  const renderTableList = (tables: TableStat[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left border-collapse">
        <thead>
          <tr className="text-slate-500 border-b border-slate-800">
            <th className="py-2 pr-4 font-semibold uppercase tracking-wider">Table Name</th>
            <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">Rows</th>
            <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">Size</th>
            <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">
              Writes (I/U)
            </th>
            <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">
              Reads (Idx/Seq)
            </th>
            <th className="py-2 pl-4 font-semibold uppercase tracking-wider text-right">
              Last Active
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {tables.map((t) => {
            const hasActivity = parseInt(t.total_inserts) > 0 || parseInt(t.total_updates) > 0;
            return (
              <tr
                key={t.table_name}
                className={`hover:bg-slate-800/30 transition-colors ${hasActivity ? 'bg-blue-500/5' : ''}`}
              >
                <td className="py-2 pr-4 font-mono text-blue-400 font-medium">{t.table_name}</td>
                <td className="py-2 px-4 text-right tabular-nums text-slate-300">
                  {parseInt(t.row_count).toLocaleString()}
                </td>
                <td className="py-2 px-4 text-right tabular-nums text-slate-400 font-medium">
                  {t.size_pretty}
                </td>
                <td className="py-2 px-4 text-right tabular-nums">
                  <span className="text-emerald-500">
                    {parseInt(t.total_inserts).toLocaleString()}
                  </span>
                  <span className="text-slate-600 mx-1">/</span>
                  <span className="text-blue-400">
                    {parseInt(t.total_updates).toLocaleString()}
                  </span>
                </td>
                <td className="py-2 px-4 text-right tabular-nums">
                  <span className="text-purple-400">
                    {parseInt(t.index_reads).toLocaleString()}
                  </span>
                  <span className="text-slate-600 mx-1">/</span>
                  <span className="text-slate-500">
                    {parseInt(t.sequential_reads).toLocaleString()}
                  </span>
                </td>
                <td className="py-2 pl-4 text-right whitespace-nowrap text-slate-500">
                  {t.last_active
                    ? new Date(t.last_active).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Never'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderMVList = (mvs: MVStat[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left border-collapse">
        <thead>
          <tr className="text-slate-500 border-b border-slate-800">
            <th className="py-2 pr-4 font-semibold uppercase tracking-wider">View Name</th>
            <th className="py-2 px-4 font-semibold uppercase tracking-wider text-center">Status</th>
            <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">Size</th>
            <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">
              Scans (Seq)
            </th>
            <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">
              Tuples Read
            </th>
            <th className="py-2 pl-4 font-semibold uppercase tracking-wider text-right">
              Last Active
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {mvs.map((mv) => (
            <tr key={mv.view_name} className="hover:bg-slate-800/30 transition-colors">
              <td className="py-2 pr-4 font-mono text-emerald-400 font-medium">{mv.view_name}</td>
              <td className="py-2 px-4 text-center">
                {mv.is_populated ? (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">
                    POPULATED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-500 font-bold border border-red-500/20 animate-pulse">
                    UNPOPULATED
                  </span>
                )}
              </td>
              <td className="py-2 px-4 text-right tabular-nums text-slate-400 font-medium">
                {mv.size_pretty}
              </td>
              <td className="py-2 px-4 text-right tabular-nums text-purple-400">
                {parseInt(mv.seq_scan || '0').toLocaleString()}
              </td>
              <td className="py-2 px-4 text-right tabular-nums text-slate-500">
                {parseInt(mv.seq_tup_read || '0').toLocaleString()}
              </td>
              <td className="py-2 pl-4 text-right whitespace-nowrap text-slate-500">
                {mv.last_active
                  ? new Date(mv.last_active).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Never'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderUnusedIndexes = (indexes: UnusedIndex[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left border-collapse">
        <thead>
          <tr className="text-slate-500 border-b border-slate-800">
            <th className="py-2 pr-4 font-semibold uppercase tracking-wider">Index Name</th>
            <th className="py-2 px-4 font-semibold uppercase tracking-wider">Table</th>
            <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">Size</th>
            <th className="py-2 pl-4 font-semibold uppercase tracking-wider text-right">Scans</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {indexes.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-8 text-center text-slate-600 italic">
                No unused indexes detected.
              </td>
            </tr>
          ) : (
            indexes.map((idx) => (
              <tr key={idx.index_name} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-2 pr-4 font-mono text-orange-400 font-medium">
                  {idx.index_name}
                </td>
                <td className="py-2 px-4 font-mono text-slate-500">{idx.table_name}</td>
                <td className="py-2 px-4 text-right tabular-nums text-slate-400 font-medium">
                  {idx.size_pretty}
                </td>
                <td className="py-2 pl-4 text-right tabular-nums text-red-400 font-bold">
                  {idx.scan_count}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* DB Summary Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-blue-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <DatabaseIcon size={28} />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Total DB Size
            </div>
            <div className="text-2xl font-black text-white">{stats?.total_db_size}</div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-4 md:col-span-2">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <ActivityIcon size={28} />
          </div>
          <div className="flex-1 grid grid-cols-2">
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Core Networks
              </div>
              <div className="text-xl font-bold text-white">
                {parseInt(
                  stats?.tables.find((t) => t.table_name === 'networks')?.row_count || '0'
                ).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Total Observations
              </div>
              <div className="text-xl font-bold text-white">
                {parseInt(
                  stats?.tables.find((t) => t.table_name === 'observations')?.row_count || '0'
                ).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 flex flex-col justify-center">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-bold rounded-lg transition-all border border-slate-700 uppercase tracking-widest"
          >
            {loading ? 'Refreshing...' : 'Refresh Stats'}
          </button>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="space-y-6">
        {/* Core & Infrastructure */}
        <AdminCard
          title="Core Engine & Infrastructure"
          icon={DatabaseIcon}
          color="from-blue-600 to-indigo-700"
        >
          {renderTableList([...getTablesByCategory('core'), ...getTablesByCategory('infra')])}
        </AdminCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* WiGLE Layer */}
          <AdminCard
            title="WiGLE Context Layer"
            icon={ActivityIcon}
            color="from-orange-500 to-red-600"
          >
            {renderTableList(getTablesByCategory('wigle'))}
          </AdminCard>

          {/* Kismet Sidecar */}
          <AdminCard
            title="Kismet Forensic Sidecar"
            icon={ActivityIcon}
            color="from-purple-600 to-indigo-600"
          >
            {renderTableList(getTablesByCategory('kismet'))}
          </AdminCard>
        </div>

        {/* Materialized View Health */}
        <AdminCard
          title="Materialized View Health"
          icon={ActivityIcon}
          color="from-emerald-600 to-teal-700"
        >
          {stats && renderMVList(stats.materialized_views)}
        </AdminCard>

        {/* Unused Index Report */}
        <AdminCard
          title="Unused Index Report"
          icon={TrendingUpIcon}
          color="from-orange-600 to-red-700"
        >
          {stats && renderUnusedIndexes(stats.unused_indexes)}
        </AdminCard>
      </div>

      <div className="text-[10px] text-slate-600 italic px-2">
        * Rows shown are 'live' estimates from Postgres statistics. * Highlighted rows indicate
        write activity (Inserts/Updates) recorded since last statistics reset.
      </div>
    </div>
  );
};
