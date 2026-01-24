import { usePageFilters } from '../hooks/usePageFilters';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type mapboxglType from 'mapbox-gl';
import { HamburgerButton } from './HamburgerButton';
import { WigleControlPanel } from './WigleControlPanel';
import { WigleFilterPanel } from './WigleFilterPanel';
import { WigleMap } from './WigleMap';
import { useFilterStore, useDebouncedFilters } from '../stores/filterStore';
import { useFilterURLSync } from '../hooks/useFilteredData';
import { useAdaptedFilters } from '../hooks/useAdaptedFilters';
import { getPageCapabilities } from '../utils/filterCapabilities';
import { logDebug } from '../logging/clientLogger';

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

const WiglePage: React.FC = () => {
  // Set current page for filter scoping
  usePageFilters('wigle');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxglType.Map | null>(null);
  const mapboxRef = useRef<mapboxglType | null>(null);
  const clusterColorCache = useRef<Record<number, string>>({});
  const featureCollectionRef = useRef<any>(null); // Ref for latest featureCollection
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
  const [showMenu, setShowMenu] = useState(false);
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
    const source = map.getSource('wigle-points') as mapboxglType.GeoJSONSource | undefined;
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

  // Keep ref updated with latest featureCollection
  featureCollectionRef.current = featureCollection;

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
        const mapboxgl = mapboxRef.current ?? (await import('mapbox-gl')).default;
        mapboxRef.current = mapboxgl;
        await import('mapbox-gl/dist/mapbox-gl.css');

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
        // Dynamically load orientation controls to reduce initial bundle size
        import('../utils/mapOrientationControls').then(({ attachMapOrientationControls }) => {
          attachMapOrientationControls(map, {
            scalePosition: 'bottom-right',
            scaleUnit: 'metric',
            ensureNavigation: false, // Already added above
          });
        });

        updateSize();

        map.on('load', () => {
          map.addSource('wigle-points', {
            type: 'geojson',
            data: featureCollectionRef.current || { type: 'FeatureCollection', features: [] },
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
            const source = map.getSource('wigle-points') as mapboxglType.GeoJSONSource;
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
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || !map.getSource('wigle-points')) {
      logDebug(
        `[WiGLE] Map or source not ready, map: ${!!map} source: ${!!map?.getSource('wigle-points')}`
      );
      return;
    }
    logDebug(`[WiGLE] Updating map with ${rows.length} points`);
    const source = map.getSource('wigle-points') as mapboxglType.GeoJSONSource;
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
    logDebug('[WiGLE] Fetch triggered');
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
      logDebug(`[WiGLE] Received ${payload.data?.length || 0} rows`);
      setRows(payload.data || []); // REPLACE, not append
      setTotal(typeof payload.total === 'number' ? payload.total : null);
    } catch (err: any) {
      setError(err.message || 'Failed to load points');
    } finally {
      setLoading(false);
    }
  }, [limit, offset, typeFilter, adaptedFilters]);

  // Handle map style changes - use ref to get latest featureCollection without causing re-runs
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const recreateLayers = () => {
      // Recreate wigle-points source and layers after style change
      if (!map.getSource('wigle-points')) {
        map.addSource('wigle-points', {
          type: 'geojson',
          data: featureCollectionRef.current as any,
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
  }, [mapStyle, mapReady]); // Removed featureCollection - was causing style resets on data load

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
    <div className="min-h-screen w-full text-slate-100 flex flex-col relative">
      <HamburgerButton isOpen={showMenu} onClick={() => setShowMenu(!showMenu)} />

      <WigleControlPanel
        isOpen={showMenu}
        onShowFilters={() => setShowFilters(!showFilters)}
        showFilters={showFilters}
        mapStyle={mapStyle}
        onMapStyleChange={setMapStyle}
        mapStyles={mapStyles}
        show3dBuildings={show3dBuildings}
        onToggle3dBuildings={() => setShow3dBuildings(!show3dBuildings)}
        showTerrain={showTerrain}
        onToggleTerrain={() => setShowTerrain(!showTerrain)}
        onLoadPoints={fetchPoints}
        loading={loading}
        rowsLoaded={rows.length}
        totalRows={total}
      />

      <WigleFilterPanel isOpen={showFilters && showMenu} adaptedFilters={adaptedFilters} />

      <WigleMap
        mapContainerRef={mapContainerRef}
        loading={loading}
        error={error}
        mapReady={mapReady}
      />
    </div>
  );
};

export default WiglePage;
