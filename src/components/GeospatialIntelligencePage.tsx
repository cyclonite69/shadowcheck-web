import React, { useEffect, useMemo, useState } from 'react';
import NetworksExplorer from './NetworksExplorer';
import ThreatsExplorer from './ThreatsExplorer';

type HeatTile = {
  geometry: any;
  obs_count: number;
  avg_level: number;
  min_level: number;
  max_level: number;
  first_seen: string;
  last_seen: string;
};

type RouteRow = {
  device_id: string;
  point_count: number;
  start_at: string;
  end_at: string;
  geometry: any;
};

type TimelinePoint = {
  bucket: string;
  obs_count: number;
  avg_level: number;
  min_level: number;
  max_level: number;
};

type NetworkRow = {
  bssid: string;
  ssid: string;
  device_id: string;
  source_tag: string;
  observed_at: string;
  signal: number | null;
  lat: number | null;
  lon: number | null;
  external: boolean;
  observations: number;
  first_seen: string | null;
  last_seen: string | null;
  is_5ghz: boolean | null;
  is_6ghz: boolean | null;
  is_hidden: boolean | null;
  type: string | null;
  frequency: number | null;
  capabilities: string | null;
};

const Card = ({
  title,
  value,
  accent,
}: {
  title: string;
  value: string | number;
  accent: string;
}) => (
  <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 shadow-lg">
    <p className="text-slate-400 text-sm mb-1">{title}</p>
    <div className="text-2xl font-bold" style={{ color: accent }}>
      {value}
    </div>
  </div>
);

const Pill = ({ label, color }: { label: string; color: string }) => (
  <span
    className="px-2 py-1 rounded-full text-xs font-semibold"
    style={{ backgroundColor: `${color}22`, color }}
  >
    {label}
  </span>
);

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');

export default function GeospatialIntelligencePage() {
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [heatmap, setHeatmap] = useState<HeatTile[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBssid, setSelectedBssid] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError('');
        setLoading(true);
        const [netRes, heatRes, routeRes] = await Promise.all([
          fetch('/api/explorer/networks?limit=2000&order=desc&sort=observed_at'),
          fetch('/api/explorer/heatmap'),
          fetch('/api/explorer/routes'),
        ]);
        if (!netRes.ok) {
          throw new Error(`networks ${netRes.status}`);
        }
        if (!heatRes.ok) {
          throw new Error(`heatmap ${heatRes.status}`);
        }
        if (!routeRes.ok) {
          throw new Error(`routes ${routeRes.status}`);
        }
        const netData = await netRes.json();
        const heatData = await heatRes.json();
        const routeData = await routeRes.json();
        setNetworks(netData.rows || []);
        setHeatmap(heatData || []);
        setRoutes(routeData || []);
      } catch (err) {
        console.error(err);
        setError('Failed to load explorer data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const fetchTimeline = async () => {
      if (!selectedBssid) {
        setTimeline([]);
        return;
      }
      try {
        const res = await fetch(`/api/explorer/timeline/${encodeURIComponent(selectedBssid)}`);
        if (!res.ok) {
          throw new Error(`timeline ${res.status}`);
        }
        const data = await res.json();
        setTimeline(data || []);
      } catch (err) {
        console.error(err);
        setTimeline([]);
      }
    };
    fetchTimeline();
  }, [selectedBssid]);

  const selectedRoute = routes.find(
    (r) => r.device_id === networks.find((n) => n.bssid === selectedBssid)?.device_id
  );
  const threatish = useMemo(() => networks.filter((n) => (n.signal ?? -999) > -60), [networks]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Geospatial Intelligence
        </h1>
        <p className="text-slate-300 mt-1">
          Unified network, threat, and spatial intelligence backed by PostGIS materialized views.
        </p>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card title="Networks" value={networks.length} accent="#38bdf8" />
        <Card title="Heat Tiles" value={heatmap.length} accent="#f97316" />
        <Card title="Routes" value={routes.length} accent="#a78bfa" />
        <Card title="Threat-ish (>-60 dBm)" value={threatish.length} accent="#f43f5e" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <NetworksExplorer
            networks={networks}
            onSelect={(bssid) => setSelectedBssid(bssid)}
            selectedBssid={selectedBssid}
            title="Networks Explorer"
          />
        </div>

        <div className="space-y-4">
          <ThreatsExplorer
            networks={networks}
            onSelect={(bssid) => setSelectedBssid(bssid)}
            selectedBssid={selectedBssid}
            title="Threat Explorer"
          />

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Heatmap Tiles</h2>
              <Pill label="0.01° grid" color="#fb923c" />
            </div>
            <div className="space-y-2 max-h-48 overflow-auto pr-1">
              {heatmap.slice(0, 10).map((tile, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-slate-800/70 border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div className="text-slate-200 font-semibold">{tile.obs_count} obs</div>
                    <div className="text-xs text-slate-500">
                      Level {Math.round(tile.avg_level)} dBm avg
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 text-right">
                    {formatDate(tile.first_seen)} → {formatDate(tile.last_seen)}
                  </div>
                </div>
              ))}
              {heatmap.length === 0 && (
                <p className="text-slate-500 text-sm">No tiles available.</p>
              )}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Device Routes</h2>
              <Pill label="mv_device_routes" color="#a78bfa" />
            </div>
            <div className="space-y-2">
              {routes.map((route) => (
                <div
                  key={route.device_id}
                  className="p-2 rounded bg-slate-800/70 border border-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase">{route.device_id}</span>
                    <span className="text-xs text-slate-400">{route.point_count} points</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {formatDate(route.start_at)} → {formatDate(route.end_at)}
                  </div>
                </div>
              ))}
              {routes.length === 0 && <p className="text-slate-500 text-sm">No route geometry.</p>}
            </div>
            {selectedRoute && (
              <div className="mt-3 text-xs text-slate-400">
                Selected device route: {selectedRoute.device_id} ({selectedRoute.point_count}{' '}
                points)
              </div>
            )}
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Timeline</h2>
              <Pill label={selectedBssid ? selectedBssid : 'Select a network'} color="#22d3ee" />
            </div>
            <div className="space-y-2 max-h-48 overflow-auto pr-1">
              {timeline.length > 0 ? (
                timeline.slice(0, 24).map((t, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-slate-800/70 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-slate-200 font-semibold">
                        {new Date(t.bucket).toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500">Obs {t.obs_count}</div>
                    </div>
                    <div className="text-xs text-slate-400 text-right">
                      Avg {Math.round(t.avg_level)} dBm
                      <div>
                        Min/Max {t.min_level}/{t.max_level}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-sm">Select a network to view hourly timeline.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
