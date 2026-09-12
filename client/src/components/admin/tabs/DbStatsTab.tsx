import React from 'react';
import { AdminCard } from '../components/AdminCard';
import { formatShortDate } from '../../../utils/formatDate';
import { useDbStats } from '../hooks/useDbStats';
import { useSiblingStats } from '../hooks/useSiblingStats';
import { useTableCategories } from '../hooks/useTableCategories';
import { DbTableList } from './db-stats/DbTableList';
import { DbMaterializedViewsList } from './db-stats/DbMaterializedViewsList';
import {
  UniqueEnforcementIndexesCard,
  DuplicateIndexGroupsCard,
  UnusedIndexReportCard,
  UsedIndexReportCard,
} from './db-stats/DbIndexReports';
import { DbSiblingStatsCard } from './db-stats/DbSiblingStatsCard';

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

export const DbStatsTab: React.FC = () => {
  const { stats, loading, error, fetchStats } = useDbStats();
  const {
    siblingStats,
    siblingByRule,
    purgingSiblings,
    purgeSiblings,
    runningSiblings,
    runRefresh,
    refreshError,
  } = useSiblingStats(fetchStats);
  const { coreAndInfra, wigle, kismet, uncategorized } = useTableCategories(stats);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-12 text-red-400">
        <div className="text-center">
          <p className="font-bold mb-2">Failed to load stats</p>
          <p className="text-xs opacity-75">{error}</p>
        </div>
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

        <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 flex flex-col justify-center items-center gap-2">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-bold rounded-lg transition-all border border-slate-700 uppercase tracking-widest"
          >
            {loading ? 'Refreshing...' : 'Refresh Stats'}
          </button>
          {stats?.stats_reset && (
            <div className="text-[10px] text-slate-500 font-medium text-center">
              Index scan data since: {formatShortDate(stats.stats_reset)}
            </div>
          )}
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
          <DbTableList tables={coreAndInfra} />
        </AdminCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* WiGLE Layer */}
          <AdminCard
            title="WiGLE Context Layer"
            icon={ActivityIcon}
            color="from-orange-500 to-red-600"
          >
            <DbTableList tables={wigle} />
          </AdminCard>

          {/* Kismet Sidecar */}
          <AdminCard
            title="Kismet Forensic Sidecar"
            icon={ActivityIcon}
            color="from-purple-600 to-indigo-600"
          >
            <DbTableList tables={kismet} />
          </AdminCard>
        </div>

        {/* Materialized View Health */}
        <AdminCard
          title="Materialized View Health"
          icon={ActivityIcon}
          color="from-emerald-600 to-teal-700"
        >
          {stats && <DbMaterializedViewsList mvs={stats.materialized_views} />}
        </AdminCard>

        {/* Unique / Constraint Indexes */}
        {stats && stats.unique_enforcement_indexes && (
          <AdminCard
            title="Unique &amp; Constraint Indexes"
            icon={TrendingUpIcon}
            color="from-blue-600 to-indigo-700"
          >
            <UniqueEnforcementIndexesCard indexes={stats.unique_enforcement_indexes} />
          </AdminCard>
        )}

        {/* Duplicate Index Groups */}
        {stats && stats.duplicate_index_groups && (
          <AdminCard
            title="Duplicate Index Detection"
            icon={TrendingUpIcon}
            color="from-amber-600 to-orange-700"
          >
            <DuplicateIndexGroupsCard groups={stats.duplicate_index_groups} />
          </AdminCard>
        )}

        {/* Unused Index Report */}
        <AdminCard
          title="Unused Index Report"
          icon={TrendingUpIcon}
          color="from-orange-600 to-red-700"
        >
          {stats && (
            <UnusedIndexReportCard
              unusedIndexes={stats.unused_indexes}
              summary={stats.unused_indexes_summary}
              statsReset={stats.stats_reset || undefined}
            />
          )}
        </AdminCard>

        {/* Used Index Report */}
        <AdminCard
          title="Used Index Report"
          icon={TrendingUpIcon}
          color="from-emerald-600 to-teal-700"
        >
          {stats && (
            <UsedIndexReportCard
              usedIndexes={stats.used_indexes}
              statsReset={stats.stats_reset || undefined}
            />
          )}
        </AdminCard>

        {/* Uncategorized Tables */}
        {uncategorized.length > 0 && (
          <AdminCard
            title="Uncategorized Tables"
            icon={DatabaseIcon}
            color="from-slate-600 to-slate-700"
          >
            <div className="mb-4 text-xs text-slate-500 italic">
              (not in any configured category)
            </div>
            <DbTableList tables={uncategorized} />
          </AdminCard>
        )}

        {/* Sibling Detection Stats */}
        <AdminCard
          title="Sibling Detection"
          icon={ActivityIcon}
          color="from-violet-600 to-purple-700"
        >
          <DbSiblingStatsCard
            siblingStats={siblingStats}
            siblingByRule={siblingByRule}
            purgingSiblings={purgingSiblings}
            purgeSiblings={purgeSiblings}
            runningSiblings={runningSiblings}
            runRefresh={runRefresh}
            refreshError={refreshError}
          />
        </AdminCard>
      </div>

      <div className="text-[10px] text-slate-600 italic px-2">
        * Rows shown are 'live' estimates from Postgres statistics. * Highlighted rows indicate
        write activity (Inserts/Updates) recorded since last statistics reset.
      </div>
    </div>
  );
};
