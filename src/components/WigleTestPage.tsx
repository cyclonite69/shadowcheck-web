import React, { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

type WigleRow = {
  bssid: string;
  ssid: string | null;
  trilat: number;
  trilong: number;
  type: string;
  encryption: string | null;
  lasttime: string;
};

const DEFAULT_LIMIT = 20000;

const WigleTestPage: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<WigleRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);

  const featureCollection = useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: rows.map((row) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [Number(row.trilong), Number(row.trilat)],
        },
        properties: {
          bssid: row.bssid,
          ssid: row.ssid || '(hidden)',
          type: row.type,
          encryption: row.encryption || 'Unknown',
          lasttime: row.lasttime,
        },
      })),
    };
  }, [rows]);

  useEffect(() => {
    let mounted = true;
    const initMap = async () => {
      try {
        const tokenRes = await fetch('/api/mapbox-token');
        const tokenBody = await tokenRes.json();
        if (!tokenRes.ok || !tokenBody?.token) {
          throw new Error(tokenBody?.error || 'Mapbox token not available');
        }
        mapboxgl.accessToken = String(tokenBody.token).trim();

        if (!mounted || !mapContainerRef.current) return;
        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [-98.5795, 39.8283],
          zoom: 3,
        });
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        map.on('load', () => {
          map.addSource('wigle-points', {
            type: 'geojson',
            data: featureCollection as any,
            cluster: true,
            clusterMaxZoom: 12,
            clusterRadius: 40,
          });

          map.addLayer({
            id: 'wigle-clusters',
            type: 'circle',
            source: 'wigle-points',
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': '#38bdf8',
              'circle-opacity': 0.7,
              'circle-radius': ['step', ['get', 'point_count'], 16, 100, 22, 750, 28],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#0f172a',
            },
          });

          map.addLayer({
            id: 'wigle-cluster-count',
            type: 'symbol',
            source: 'wigle-points',
            filter: ['has', 'point_count'],
            layout: {
              'text-field': ['get', 'point_count_abbreviated'],
              'text-size': 12,
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            },
            paint: {
              'text-color': '#0f172a',
            },
          });

          map.addLayer({
            id: 'wigle-unclustered',
            type: 'circle',
            source: 'wigle-points',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-color': '#a855f7',
              'circle-opacity': 0.8,
              'circle-radius': 5,
              'circle-stroke-width': 1,
              'circle-stroke-color': '#0f172a',
            },
          });

          map.on('click', 'wigle-unclustered', (e) => {
            const feature = e.features && e.features[0];
            const props = feature?.properties;
            if (!props || !e.lngLat) return;
            new mapboxgl.Popup({ offset: 12 })
              .setLngLat(e.lngLat)
              .setHTML(
                `<div style="font-size:12px;color:#e2e8f0;">
                  <div style="font-weight:700;margin-bottom:4px;">${props.ssid}</div>
                  <div>BSSID: ${props.bssid}</div>
                  <div>Type: ${props.type}</div>
                  <div>Encryption: ${props.encryption}</div>
                  <div>Last: ${props.lasttime}</div>
                </div>`
              )
              .addTo(map);
          });

          map.on('click', 'wigle-clusters', (e) => {
            const features = map.queryRenderedFeatures(e.point, { layers: ['wigle-clusters'] });
            const clusterId = features[0]?.properties?.cluster_id;
            const source = map.getSource('wigle-points') as mapboxgl.GeoJSONSource;
            if (!source || clusterId == null) return;
            source.getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err || zoom == null) return;
              map.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
            });
          });
        });
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to initialize map');
        }
      }
    };

    initMap();
    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('wigle-points')) return;
    const source = map.getSource('wigle-points') as mapboxgl.GeoJSONSource;
    source.setData(featureCollection as any);
  }, [featureCollection]);

  const fetchPoints = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        include_total: '1',
      });
      if (typeFilter.trim()) {
        params.set('type', typeFilter.trim());
      }
      const res = await fetch(`/api/wigle/networks-v2?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const payload = await res.json();
      setRows(payload.data || []);
      setTotal(typeof payload.total === 'number' ? payload.total : null);
    } catch (err: any) {
      setError(err.message || 'Failed to load points');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      <div className="border-b border-slate-800 bg-slate-900/70 px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-lg font-semibold">WiGLE v2 Test Map</div>
            <div className="text-xs text-slate-400">Source: public.wigle_v2_networks_search</div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-slate-400">Limit</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Number(e.target.value || 0)))}
              className="w-28 rounded-md bg-slate-800 px-2 py-1 text-slate-100"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-slate-400">Offset</label>
            <input
              type="number"
              value={offset}
              onChange={(e) => setOffset(Math.max(0, Number(e.target.value || 0)))}
              className="w-28 rounded-md bg-slate-800 px-2 py-1 text-slate-100"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-slate-400">Type</label>
            <input
              type="text"
              placeholder="W, B, E..."
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-28 rounded-md bg-slate-800 px-2 py-1 text-slate-100"
            />
          </div>
          <button
            onClick={fetchPoints}
            className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            {loading ? 'Loading…' : 'Load Points'}
          </button>
          <div className="text-xs text-slate-400">
            Loaded: {rows.length.toLocaleString()}
            {total != null && ` / ${total.toLocaleString()}`}
          </div>
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
      </div>
      <div className="flex-1">
        <div ref={mapContainerRef} className="h-full w-full" />
      </div>
    </div>
  );
};

export default WigleTestPage;
