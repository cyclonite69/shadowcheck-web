import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import type { GeocodingStats } from '../../types/admin.types';
import { MapIcon } from './GeocodingIcons';

const MetricLabel: React.FC<{ label: string; tooltip: string }> = ({ label, tooltip }) => (
  <div className="text-xs text-slate-400 flex items-center gap-1">
    <span>{label}</span>
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-slate-300 cursor-help"
      title={tooltip}
      aria-label={`${label} info`}
    >
      ?
    </span>
  </div>
);

export const GeocodingStatsCard: React.FC<{
  stats: GeocodingStats | null;
  isLoading: boolean;
  refreshStats: () => void | Promise<void>;
}> = ({ stats, isLoading, refreshStats }) => (
  <AdminCard icon={MapIcon} title="Geocoding Cache" color="from-indigo-500 to-indigo-600">
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
          <MetricLabel
            label="Observations"
            tooltip="Total rows in app.observations (raw datapoints, not deduplicated)."
          />
          <div className="text-lg font-semibold text-white">
            {stats?.observation_count?.toLocaleString() || '—'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
          <MetricLabel
            label="Unique Blocks"
            tooltip="Unique rounded latitude/longitude cells at this precision."
          />
          <div className="text-lg font-semibold text-white">
            {stats?.unique_blocks?.toLocaleString() || '—'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
          <MetricLabel
            label="Cached Blocks"
            tooltip="How many rounded cells already have a geocoding cache row."
          />
          <div className="text-lg font-semibold text-white">
            {stats?.cached_blocks?.toLocaleString() || '—'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
          <MetricLabel
            label="Missing Blocks"
            tooltip="Rounded cells seen in observations that still have no cache row."
          />
          <div className="text-lg font-semibold text-white">
            {stats?.missing_blocks?.toLocaleString() || '—'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
          <MetricLabel
            label="Resolved Rows"
            tooltip="Cache rows with a non-null resolved address."
          />
          <div className="text-lg font-semibold text-white">
            {stats?.resolved_address_rows?.toLocaleString() || '—'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
          <MetricLabel
            label="POI Hits"
            tooltip="Cache rows where a POI name was found (poi_name is not null)."
          />
          <div className="text-lg font-semibold text-white">
            {stats?.cached_with_poi?.toLocaleString() || '—'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
          <MetricLabel
            label="Pending Queue"
            tooltip="Unresolved cache rows that have not yet been attempted for address enrichment."
          />
          <div className="text-lg font-semibold text-white">
            {stats?.pending_address_queue?.toLocaleString() || '—'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
          <MetricLabel
            label="Attempted No Hit"
            tooltip="Unresolved cache rows that have already been attempted at least once."
          />
          <div className="text-lg font-semibold text-white">
            {stats?.attempted_without_address?.toLocaleString() || '—'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
          <MetricLabel
            label="Recent Activity"
            tooltip="Cache rows touched in the last 10 minutes."
          />
          <div className="text-lg font-semibold text-white">
            {stats?.recent_activity?.toLocaleString() || '—'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3">
          <MetricLabel
            label="Distinct Addresses"
            tooltip="Distinct non-null address strings currently stored in cache."
          />
          <div className="text-lg font-semibold text-white">
            {stats?.distinct_addresses?.toLocaleString() || '—'}
          </div>
        </div>
      </div>

      <button
        onClick={() => void refreshStats()}
        disabled={isLoading}
        className="w-full px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg font-medium hover:from-indigo-500 hover:to-indigo-600 transition-all disabled:opacity-50 text-sm"
      >
        {isLoading ? 'Refreshing...' : 'Refresh Stats'}
      </button>
    </div>
  </AdminCard>
);
