import React, { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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
const CLUSTER_SAMPLE_LIMIT = 50;

// BSSID-based color generation (from ShadowCheckLite)
const macColor = (mac: string): string => {
  if (!mac || mac.length < 6) return '#999999';

  const BASE_HUES = [0, 60, 120, 180, 240, 270, 300, 330];
  const stringToHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const cleanedMac = mac.replace(/[^0-9A-F]/gi, '');
  if (cleanedMac.length < 6) return '#999999';

  const oui = cleanedMac.substring(0, 6); // Manufacturer part
  const devicePart = cleanedMac.substring(6); // Device-specific part

  const hue = BASE_HUES[stringToHash(oui) % BASE_HUES.length];
  const saturation = 50 + (stringToHash(devicePart) % 41); // 50-90%
  const lightness = 40 + (stringToHash(devicePart) % 31); // 40-70%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const parseHsl = (value: string): { h: number; s: number; l: number } | null => {
  const match = value.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/i);
  if (!match) return null;
  return { h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) };
};

const dominantClusterColor = (bssids: string[]): string => {
  if (bssids.length === 0) return '#38bdf8';
  const buckets = new Map<number, { count: number; sTotal: number; lTotal: number }>();
  bssids.forEach((bssid) => {
    const hsl = parseHsl(macColor(bssid));
    if (!hsl) return;
    const hueBucket = hsl.h;
    const existing = buckets.get(hueBucket);
    if (existing) {
      existing.count += 1;
      existing.sTotal += hsl.s;
      existing.lTotal += hsl.l;
    } else {
      buckets.set(hueBucket, { count: 1, sTotal: hsl.s, lTotal: hsl.l });
    }
  });
  if (buckets.size === 0) return '#38bdf8';
  let bestHue = 0;
  let best = { count: 0, sTotal: 0, lTotal: 0 };
  buckets.forEach((entry, hue) => {
    if (entry.count > best.count) {
      bestHue = hue;
      best = entry;
    }
  });
  const avgS = Math.round(best.sTotal / best.count);
  const avgL = Math.round(best.lTotal / best.count);
  return `hsl(${bestHue}, ${avgS}%, ${avgL}%)`;
};

const WigleTestPage: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const clusterColorCache = useRef<Record<number, string>>({});
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<WigleRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [tilesReady, setTilesReady] = useState(false);

  const updateClusterColors = () => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource('wigle-points') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    const clusters = map.querySourceFeatures('wigle-points', { filter: ['has', 'point_count'] });
    clusters.forEach((feature) => {
      const clusterId = feature.properties?.cluster_id;
      const featureId = feature.id ?? clusterId;
      if (clusterId == null || featureId == null) return;
      const cached = clusterColorCache.current[clusterId];
      if (cached) {
        map.setFeatureState({ source: 'wigle-points', id: featureId }, { color: cached });
        return;
      }
      source.getClusterLeaves(clusterId, CLUSTER_SAMPLE_LIMIT, 0, (err, leaves) => {
        if (err || !leaves || leaves.length === 0) return;
        const bssids = leaves.map((leaf) => String(leaf.properties?.bssid || '')).filter(Boolean);
        const color = dominantClusterColor(bssids);
        clusterColorCache.current[clusterId] = color;
        map.setFeatureState({ source: 'wigle-points', id: featureId }, { color });
      });
    });
  };

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
          color: macColor(row.bssid),
        },
      })),
    };
  }, [rows]);

  useEffect(() => {
    let mounted = true;
    const updateSize = () => {
      if (!mapContainerRef.current) return;
      const rect = mapContainerRef.current.getBoundingClientRect();
      setMapSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      mapRef.current?.resize();
    };
    const initMap = async () => {
      try {
        if (!mapboxgl.supported()) {
          throw new Error('Mapbox GL not supported (WebGL unavailable)');
        }
        const tokenRes = await fetch('/api/mapbox-token');
        const tokenBody = await tokenRes.json();
        if (!tokenRes.ok || !tokenBody?.token) {
          throw new Error(tokenBody?.error || 'Mapbox token not available');
        }
        setTokenStatus('ok');
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
        updateSize();

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
              'circle-color': ['coalesce', ['feature-state', 'color'], '#38bdf8'],
              'circle-opacity': 0.75,
              'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
              'circle-stroke-width': 2.5,
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
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.8,
              'circle-radius': 3,
              'circle-stroke-width': 0.5,
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

          setMapReady(true);
          setTimeout(() => map.resize(), 0);
          updateClusterColors();
        });

        map.on('idle', () => {
          if (!mounted) return;
          setTilesReady(map.areTilesLoaded());
        });

        map.on('error', (event) => {
          if (!mounted) return;
          setError(event?.error?.message || 'Mapbox error');
        });
        map.on('moveend', updateClusterColors);
        map.on('zoomend', updateClusterColors);
        map.on('sourcedata', (event) => {
          if (event.sourceId === 'wigle-points' && event.isSourceLoaded) {
            updateClusterColors();
          }
        });
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to initialize map');
          setTokenStatus('error');
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
    clusterColorCache.current = {};
    map.removeFeatureState({ source: 'wigle-points' });
    source.setData(featureCollection as any);
    if (rows.length > 0) {
      const coords = rows.map(
        (row) => [Number(row.trilong), Number(row.trilat)] as [number, number]
      );
      const bounds = coords.reduce(
        (acc, coord) => acc.extend(coord),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 700 });
    }
    updateClusterColors();
  }, [featureCollection, rows]);

  useEffect(() => {
    const handleResize = () => {
      if (!mapContainerRef.current) return;
      const rect = mapContainerRef.current.getBoundingClientRect();
      setMapSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      mapRef.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      <div className="border-b border-slate-800 bg-slate-900/70 px-6 py-2">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-lg font-semibold">WiGLE v2 Test Map</div>
            <div className="text-xs text-slate-400">Source: public.wigle_v2_networks_search</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Mapbox:</span>
            <span style={{ color: mapReady ? '#34d399' : '#f59e0b' }}>
              {mapReady ? 'ready' : 'loading'}
            </span>
            <span>Token:</span>
            <span
              style={{
                color:
                  tokenStatus === 'ok'
                    ? '#34d399'
                    : tokenStatus === 'error'
                      ? '#f87171'
                      : '#f59e0b',
              }}
            >
              {tokenStatus === 'ok' ? 'ok' : tokenStatus === 'error' ? 'error' : 'pending'}
            </span>
            <span>Size:</span>
            <span>
              {mapSize.width}×{mapSize.height}
            </span>
            <span>Tiles:</span>
            <span style={{ color: tilesReady ? '#34d399' : '#f59e0b' }}>
              {tilesReady ? 'ready' : 'loading'}
            </span>
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
      <div
        className="flex-1"
        style={{
          minHeight: 600,
          height: '70vh',
          background: '#0b1220',
          position: 'relative',
        }}
      >
        <div ref={mapContainerRef} className="absolute inset-0" />
        {!mapReady && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              fontSize: '12px',
              pointerEvents: 'none',
            }}
          >
            Loading map…
          </div>
        )}
      </div>
    </div>
  );
};

export default WigleTestPage;
