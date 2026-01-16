import { usePageFilters } from '../hooks/usePageFilters';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { attachMapOrientationControls } from '../utils/mapOrientationControls';
import { FilterPanel } from './FilterPanel';
import { ActiveFiltersSummary } from './ActiveFiltersSummary';
import { useFilterStore, useDebouncedFilters } from '../stores/filterStore';
import { useFilterURLSync } from '../hooks/useFilteredData';
import { useAdaptedFilters } from '../hooks/useAdaptedFilters';
import { getPageCapabilities } from '../utils/filterCapabilities';

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
  // Set current page for filter scoping
  usePageFilters('wigle');
  const isDev = import.meta.env.DEV;

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
  const [showFilters, setShowFilters] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/dark-v11');
  const [show3dBuildings, setShow3dBuildings] = useState(false);
  const [showTerrain, setShowTerrain] = useState(false);

  const mapStyles = [
    { label: 'Dark', value: 'mapbox://styles/mapbox/dark-v11' },
    { label: 'Light', value: 'mapbox://styles/mapbox/light-v11' },
    { label: 'Streets', value: 'mapbox://styles/mapbox/streets-v12' },
    { label: 'Outdoors', value: 'mapbox://styles/mapbox/outdoors-v12' },
    { label: 'Satellite', value: 'mapbox://styles/mapbox/satellite-v9' },
    { label: 'Satellite Streets', value: 'mapbox://styles/mapbox/satellite-streets-v12' },
  ];

  // Universal filter system
  const capabilities = useMemo(() => getPageCapabilities('wigle'), []);
  const adaptedFilters = useAdaptedFilters(capabilities);
  useFilterURLSync();

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
          style: mapStyle,
          center: [-98.5795, 39.8283],
          zoom: 3,
        });
        mapRef.current = map;

        // Add navigation control (compass + zoom) and scale bar
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        attachMapOrientationControls(map, {
          scalePosition: 'bottom-right',
          scaleUnit: 'metric',
          ensureNavigation: false, // Already added above
        });

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
    if (!map || !map.getSource('wigle-points')) {
      if (isDev) {
        console.log(
          '[WiGLE] Map or source not ready, map:',
          !!map,
          'source:',
          !!map?.getSource('wigle-points')
        );
      }
      return;
    }
    if (isDev) {
      console.log('[WiGLE] Updating map with', rows.length, 'points');
    }
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

  const fetchPoints = useCallback(async () => {
    if (isDev) {
      console.log('[WiGLE] Fetch triggered');
    }
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
      // Add adapted filters
      const { filtersForPage, enabledForPage } = adaptedFilters;
      params.set('filters', JSON.stringify(filtersForPage));
      params.set('enabled', JSON.stringify(enabledForPage));

      const res = await fetch(`/api/wigle/networks-v2?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const payload = await res.json();
      if (isDev) {
        console.log('[WiGLE] Received', payload.data?.length, 'rows');
      }
      setRows(payload.data || []); // REPLACE, not append
      setTotal(typeof payload.total === 'number' ? payload.total : null);
    } catch (err: any) {
      setError(err.message || 'Failed to load points');
    } finally {
      setLoading(false);
    }
  }, [limit, offset, typeFilter, adaptedFilters]);

  // Handle map style changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const recreateLayers = () => {
      // Recreate wigle-points source and layers after style change
      if (!map.getSource('wigle-points')) {
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
      }
    };

    map.setStyle(mapStyle);
    map.once('style.load', recreateLayers);
  }, [mapStyle, mapReady, featureCollection]);

  // Handle 3D buildings
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const toggleBuildings = () => {
      if (show3dBuildings) {
        if (!map.getLayer('3d-buildings')) {
          const layers = map.getStyle().layers;
          const labelLayerId = layers?.find(
            (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
          )?.id;

          map.addLayer(
            {
              id: '3d-buildings',
              source: 'composite',
              'source-layer': 'building',
              filter: ['==', 'extrude', 'true'],
              type: 'fill-extrusion',
              minzoom: 15,
              paint: {
                'fill-extrusion-color': '#aaa',
                'fill-extrusion-height': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  15,
                  0,
                  15.05,
                  ['get', 'height'],
                ],
                'fill-extrusion-base': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  15,
                  0,
                  15.05,
                  ['get', 'min_height'],
                ],
                'fill-extrusion-opacity': 0.6,
              },
            },
            labelLayerId
          );
        }
      } else {
        if (map.getLayer('3d-buildings')) {
          map.removeLayer('3d-buildings');
        }
      }
    };

    if (map.isStyleLoaded()) {
      toggleBuildings();
    } else {
      map.once('style.load', toggleBuildings);
    }
  }, [show3dBuildings, mapReady, mapStyle]);

  // Handle terrain
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const toggleTerrain = () => {
      if (showTerrain) {
        if (!map.getSource('mapbox-dem')) {
          map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 512,
            maxzoom: 14,
          });
        }
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      } else {
        map.setTerrain(null);
        if (map.getSource('mapbox-dem')) {
          map.removeSource('mapbox-dem');
        }
      }
    };

    if (map.isStyleLoaded()) {
      toggleTerrain();
    } else {
      map.once('style.load', toggleTerrain);
    }
  }, [showTerrain, mapReady, mapStyle]);

  // Stable filter key for change detection
  const filterKey = useMemo(
    () => JSON.stringify({ limit, offset, typeFilter, filters: adaptedFilters }),
    [limit, offset, typeFilter, adaptedFilters]
  );

  // Remove useDebouncedFilters - it causes loops
  // User must click "Load Points" button to fetch

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col relative">
      {/* Filter Panel */}
      {showFilters && (
        <div
          className="fixed top-20 right-4 max-w-md space-y-2"
          style={{
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
            zIndex: 100000,
            pointerEvents: 'auto',
          }}
        >
          <ActiveFiltersSummary adaptedFilters={adaptedFilters} compact />
          <FilterPanel density="compact" />
        </div>
      )}

      {/* SC Icon Button */}
      <button
        onClick={() => setShowControls(!showControls)}
        className="fixed top-4 left-4 w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg transition-all hover:scale-110"
        style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          zIndex: 100000,
          pointerEvents: 'auto',
        }}
      >
        SC
      </button>

      {/* Control Panel */}
      {showControls && (
        <div
          className="fixed top-20 left-4 rounded-xl p-4 space-y-3 text-sm"
          style={{
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            zIndex: 100000,
            pointerEvents: 'auto',
            maxWidth: '280px',
          }}
        >
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl"
            style={{
              background: showFilters
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            }}
          >
            {showFilters ? '✕ Hide Filters' : '🔍 Show Filters'}
          </button>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Map Style</label>
            <select
              value={mapStyle}
              onChange={(e) => setMapStyle(e.target.value)}
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
            >
              {mapStyles.map((style) => (
                <option key={style.value} value={style.value}>
                  {style.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShow3dBuildings(!show3dBuildings)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                show3dBuildings
                  ? 'bg-cyan-500 text-slate-900 shadow-lg'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {show3dBuildings ? '✓ ' : ''}3D Buildings
            </button>
            <button
              onClick={() => setShowTerrain(!showTerrain)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                showTerrain
                  ? 'bg-cyan-500 text-slate-900 shadow-lg'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {showTerrain ? '✓ ' : ''}Terrain
            </button>
          </div>

          <button
            onClick={fetchPoints}
            className="w-full rounded-lg px-4 py-2 text-sm font-semibold shadow-lg transition-all hover:shadow-xl"
            style={{
              background: loading
                ? 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
                : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
            }}
            disabled={loading}
          >
            {loading ? 'Loading...' : '📍 Load Points'}
          </button>

          <div className="pt-2 border-t border-slate-700 text-xs text-slate-400">
            <div>Loaded: {rows.length.toLocaleString()}</div>
            {total != null && <div>Total: {total.toLocaleString()}</div>}
          </div>
        </div>
      )}
      <div
        className="flex-1"
        style={{
          minHeight: '100vh',
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
