import { usePageFilters } from '../hooks/usePageFilters';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type mapboxglType from 'mapbox-gl';
import { HamburgerButton } from './HamburgerButton';
import { WigleControlPanel } from './WigleControlPanel';
import { FilterPanelContainer } from './FilterPanelContainer';
import { WigleMap } from './WigleMap';
import { useFilterURLSync } from '../hooks/useFilteredData';
import { useAdaptedFilters } from '../hooks/useAdaptedFilters';
import { getPageCapabilities } from '../utils/filterCapabilities';
import { logDebug } from '../logging/clientLogger';
import { renderNetworkTooltip } from '../utils/geospatial/renderNetworkTooltip';
import { useAgencyOffices } from './hooks/useAgencyOffices';
import type { AgencyVisibility } from './hooks/useAgencyOffices';

type WigleRow = {
  bssid: string;
  ssid: string | null;
  trilat: number;
  trilong: number;
  type: string;
  encryption: string | null;
  channel?: number | null;
  frequency?: number | null;
  firsttime?: string | null;
  lasttime: string;
  accuracy?: number | null;
};

export interface WigleLayerState {
  v2: boolean;
  v3: boolean;
  fieldOffices: boolean;
  residentAgencies: boolean;
}

const LAYER_STORAGE_KEY = 'shadowcheck_wigle_layers';

const DEFAULT_LAYERS: WigleLayerState = {
  v2: true,
  v3: false,
  fieldOffices: true,
  residentAgencies: true,
};

function loadLayerState(): WigleLayerState {
  try {
    const stored = localStorage.getItem(LAYER_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_LAYERS, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_LAYERS;
}

function saveLayerState(state: WigleLayerState) {
  localStorage.setItem(LAYER_STORAGE_KEY, JSON.stringify(state));
}

const DEFAULT_LIMIT: number | null = null;
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

// Format security capabilities string into readable label
const formatSecurity = (capabilities: string | null | undefined): string => {
  const value = String(capabilities || '').toUpperCase();
  if (!value || value === 'UNKNOWN' || value === 'OPEN/UNKNOWN' || value === 'NONE') {
    return 'Open';
  }
  const hasWpa3 = value.includes('WPA3');
  const hasWpa2 = value.includes('WPA2');
  const hasWpa = value.includes('WPA');
  const hasWep = value.includes('WEP');
  const hasPsk = value.includes('PSK');
  const hasEap = value.includes('EAP');
  const hasSae = value.includes('SAE');
  const hasOwe = value.includes('OWE');

  if (hasOwe) return 'OWE';
  if (hasWpa3 && hasSae) return 'WPA3-SAE';
  if (hasWpa3 && hasEap) return 'WPA3-EAP';
  if (hasWpa3) return 'WPA3';
  if (hasWpa2 && hasEap) return 'WPA2-EAP';
  if (hasWpa2 && hasPsk) return 'WPA2-PSK';
  if (hasWpa2) return 'WPA2';
  if (hasWpa && hasEap) return 'WPA-EAP';
  if (hasWpa && hasPsk) return 'WPA-PSK';
  if (hasWpa) return 'WPA';
  if (hasWep) return 'WEP';
  return 'Open';
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

function rowsToGeoJSON(rows: WigleRow[]) {
  return {
    type: 'FeatureCollection' as const,
    features: rows.map((row) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [Number(row.trilong), Number(row.trilat)],
      },
      properties: {
        bssid: row.bssid,
        ssid: row.ssid || '(hidden)',
        type: row.type,
        encryption: row.encryption || 'Unknown',
        channel: row.channel,
        frequency: row.frequency,
        firsttime: row.firsttime,
        lasttime: row.lasttime,
        accuracy: row.accuracy,
        color: macColor(row.bssid),
      },
    })),
  };
}

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] as any[] };

const WiglePage: React.FC = () => {
  // Set current page for filter scoping
  usePageFilters('wigle');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxglType.Map | null>(null);
  const mapboxRef = useRef<mapboxglType | null>(null);
  const clusterColorCache = useRef<Record<string, Record<number, string>>>({ v2: {}, v3: {} });
  const v2FCRef = useRef<any>(null);
  const v3FCRef = useRef<any>(null);
  const [limit, setLimit] = useState<number | null>(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [v2Loading, setV2Loading] = useState(false);
  const [v3Loading, setV3Loading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [v2Rows, setV2Rows] = useState<WigleRow[]>([]);
  const [v3Rows, setV3Rows] = useState<WigleRow[]>([]);
  const [v2Total, setV2Total] = useState<number | null>(null);
  const [v3Total, setV3Total] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [tilesReady, setTilesReady] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Layer visibility state (persisted)
  const [layers, setLayersState] = useState<WigleLayerState>(loadLayerState);
  const setLayers = useCallback(
    (updater: WigleLayerState | ((prev: WigleLayerState) => WigleLayerState)) => {
      setLayersState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        saveLayerState(next);
        return next;
      });
    },
    []
  );

  const toggleLayer = useCallback(
    (key: keyof WigleLayerState) => {
      setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [setLayers]
  );

  // Agency offices visibility derived from layer state
  const agencyVisibility = useMemo<AgencyVisibility>(
    () => ({
      fieldOffices: layers.fieldOffices,
      residentAgencies: layers.residentAgencies,
    }),
    [layers.fieldOffices, layers.residentAgencies]
  );

  // Agency offices layer
  useAgencyOffices(mapRef, mapReady, agencyVisibility);
  const [showMenu, setShowMenu] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [mapStyle, setMapStyleState] = useState(() => {
    return localStorage.getItem('wigle_map_style') || 'mapbox://styles/mapbox/dark-v11';
  });
  const [show3dBuildings, setShow3dBuildingsState] = useState(() => {
    return localStorage.getItem('wigle_3d_buildings') === 'true';
  });
  const [showTerrain, setShowTerrainState] = useState(() => {
    return localStorage.getItem('wigle_terrain') === 'true';
  });

  // Wrappers to persist preferences
  const setMapStyle = (style: string) => {
    localStorage.setItem('wigle_map_style', style);
    setMapStyleState(style);
  };
  const setShow3dBuildings = (enabled: boolean) => {
    localStorage.setItem('wigle_3d_buildings', String(enabled));
    setShow3dBuildingsState(enabled);
  };
  const setShowTerrain = (enabled: boolean) => {
    localStorage.setItem('wigle_terrain', String(enabled));
    setShowTerrainState(enabled);
  };
  const wigleHandlersAttachedRef = useRef(false);

  // Full Mapbox styles matching Geospatial Explorer (Google Maps styles omitted - require additional integration)
  const mapStyles = [
    { label: 'Standard (Day)', value: 'mapbox://styles/mapbox/standard' },
    { label: 'Standard (Dawn)', value: 'mapbox://styles/mapbox/standard-dawn' },
    { label: 'Standard (Dusk)', value: 'mapbox://styles/mapbox/standard-dusk' },
    { label: 'Standard (Night)', value: 'mapbox://styles/mapbox/standard-night' },
    { label: 'Streets', value: 'mapbox://styles/mapbox/streets-v12' },
    { label: 'Outdoors', value: 'mapbox://styles/mapbox/outdoors-v12' },
    { label: 'Light', value: 'mapbox://styles/mapbox/light-v11' },
    { label: 'Dark', value: 'mapbox://styles/mapbox/dark-v11' },
    { label: 'Satellite', value: 'mapbox://styles/mapbox/satellite-v9' },
    { label: 'Satellite Streets', value: 'mapbox://styles/mapbox/satellite-streets-v12' },
    { label: 'Navigation Day', value: 'mapbox://styles/mapbox/navigation-day-v1' },
    { label: 'Navigation Night', value: 'mapbox://styles/mapbox/navigation-night-v1' },
  ];

  // Universal filter system
  const capabilities = useMemo(() => getPageCapabilities('wigle'), []);
  const adaptedFilters = useAdaptedFilters(capabilities);
  useFilterURLSync();

  const updateClusterColors = (sourceId: string, cacheKey: 'v2' | 'v3') => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(sourceId) as mapboxglType.GeoJSONSource | undefined;
    if (!source) return;
    const clusterLayerId =
      sourceId === 'wigle-v2-points' ? 'wigle-v2-clusters' : 'wigle-v3-clusters';
    const clusters = map.querySourceFeatures(sourceId, { filter: ['has', 'point_count'] });
    clusters.forEach((feature) => {
      const clusterId = feature.properties?.cluster_id;
      const featureId = feature.id ?? clusterId;
      if (clusterId == null || featureId == null) return;
      const cached = clusterColorCache.current[cacheKey]?.[clusterId];
      if (cached) {
        map.setFeatureState({ source: sourceId, id: featureId }, { color: cached });
        return;
      }
      source.getClusterLeaves(clusterId, CLUSTER_SAMPLE_LIMIT, 0, (err, leaves) => {
        if (err || !leaves || leaves.length === 0) return;
        const bssids = leaves.map((leaf) => String(leaf.properties?.bssid || '')).filter(Boolean);
        const color = dominantClusterColor(bssids);
        if (!clusterColorCache.current[cacheKey]) clusterColorCache.current[cacheKey] = {};
        clusterColorCache.current[cacheKey][clusterId] = color;
        map.setFeatureState({ source: sourceId, id: featureId }, { color });
      });
    });
  };

  const updateAllClusterColors = useCallback(() => {
    updateClusterColors('wigle-v2-points', 'v2');
    updateClusterColors('wigle-v3-points', 'v3');
  }, []);

  const v2FeatureCollection = useMemo(() => rowsToGeoJSON(v2Rows), [v2Rows]);
  const v3FeatureCollection = useMemo(() => rowsToGeoJSON(v3Rows), [v3Rows]);

  // Keep refs updated with latest featureCollections
  v2FCRef.current = v2FeatureCollection;
  v3FCRef.current = v3FeatureCollection;

  const ensureV2Layers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!map.getSource('wigle-v2-points')) {
      map.addSource('wigle-v2-points', {
        type: 'geojson',
        data: v2FCRef.current || EMPTY_FC,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 40,
      });
    }

    if (!map.getLayer('wigle-v2-clusters')) {
      map.addLayer({
        id: 'wigle-v2-clusters',
        type: 'circle',
        source: 'wigle-v2-points',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['coalesce', ['feature-state', 'color'], '#3b82f6'],
          'circle-opacity': 0.75,
          'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#0f172a',
        },
      });
    }

    if (!map.getLayer('wigle-v2-cluster-count')) {
      map.addLayer({
        id: 'wigle-v2-cluster-count',
        type: 'symbol',
        source: 'wigle-v2-points',
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
    }

    if (!map.getLayer('wigle-v2-unclustered')) {
      map.addLayer({
        id: 'wigle-v2-unclustered',
        type: 'circle',
        source: 'wigle-v2-points',
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
  }, []);

  const ensureV3Layers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!map.getSource('wigle-v3-points')) {
      map.addSource('wigle-v3-points', {
        type: 'geojson',
        data: v3FCRef.current || EMPTY_FC,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 40,
      });
    }

    if (!map.getLayer('wigle-v3-clusters')) {
      map.addLayer({
        id: 'wigle-v3-clusters',
        type: 'circle',
        source: 'wigle-v3-points',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['coalesce', ['feature-state', 'color'], '#8b5cf6'],
          'circle-opacity': 0.75,
          'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#0f172a',
        },
      });
    }

    if (!map.getLayer('wigle-v3-cluster-count')) {
      map.addLayer({
        id: 'wigle-v3-cluster-count',
        type: 'symbol',
        source: 'wigle-v3-points',
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
    }

    if (!map.getLayer('wigle-v3-unclustered')) {
      map.addLayer({
        id: 'wigle-v3-unclustered',
        type: 'circle',
        source: 'wigle-v3-points',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.8,
          'circle-radius': 3,
          'circle-stroke-width': 0.5,
          'circle-stroke-color': '#1e1b4b',
        },
      });
    }
  }, []);

  const ensureAllLayers = useCallback(() => {
    ensureV2Layers();
    ensureV3Layers();
  }, [ensureV2Layers, ensureV3Layers]);

  // Apply layer visibility on the map
  const applyLayerVisibility = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const setVis = (layerId: string, visible: boolean) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    };

    setVis('wigle-v2-clusters', layers.v2);
    setVis('wigle-v2-cluster-count', layers.v2);
    setVis('wigle-v2-unclustered', layers.v2);
    setVis('wigle-v3-clusters', layers.v3);
    setVis('wigle-v3-cluster-count', layers.v3);
    setVis('wigle-v3-unclustered', layers.v3);
  }, [layers.v2, layers.v3]);

  // Attach click handlers once
  const attachClickHandlers = useCallback(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl || wigleHandlersAttachedRef.current) return;

    const handleUnclustered = (e: any) => {
      const feature = e.features && e.features[0];
      const props = feature?.properties;
      if (!props || !e.lngLat) return;

      const tooltipHTML = renderNetworkTooltip({
        ssid: props.ssid,
        bssid: props.bssid,
        type: props.type,
        security: formatSecurity(props.encryption),
        frequency: props.frequency,
        channel: props.channel,
        time: props.lasttime,
        first_seen: props.firsttime,
        last_seen: props.lasttime,
        lat: e.lngLat.lat,
        lon: e.lngLat.lng,
        accuracy: props.accuracy,
        threat_level: 'NONE',
        threat_score: 0,
      });

      new mapboxgl.Popup({ offset: 12, className: 'sc-popup', maxWidth: '340px' })
        .setLngLat(e.lngLat)
        .setHTML(tooltipHTML)
        .addTo(map);
    };

    const handleClusterClick = (sourceId: string, clusterLayerId: string) => (e: any) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [clusterLayerId] });
      const clusterId = features[0]?.properties?.cluster_id;
      const source = map.getSource(sourceId) as mapboxglType.GeoJSONSource;
      if (!source || clusterId == null) return;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom == null) return;
        map.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
      });
    };

    map.on('click', 'wigle-v2-unclustered', handleUnclustered);
    map.on('click', 'wigle-v3-unclustered', handleUnclustered);
    map.on(
      'click',
      'wigle-v2-clusters',
      handleClusterClick('wigle-v2-points', 'wigle-v2-clusters')
    );
    map.on(
      'click',
      'wigle-v3-clusters',
      handleClusterClick('wigle-v3-points', 'wigle-v3-clusters')
    );

    wigleHandlersAttachedRef.current = true;
  }, []);

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

        // Standard style variants all use the same base URL
        const initialStyleUrl = mapStyle.startsWith('mapbox://styles/mapbox/standard')
          ? 'mapbox://styles/mapbox/standard'
          : mapStyle;

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: initialStyleUrl,
          center: [-98.5795, 39.8283],
          zoom: 3,
        });
        mapRef.current = map;

        // Add navigation control (compass + zoom) and scale bar
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        // Dynamically load orientation controls to reduce initial bundle size
        import('../utils/mapOrientationControls').then(async ({ attachMapOrientationControls }) => {
          await attachMapOrientationControls(map, {
            scalePosition: 'bottom-right',
            scaleUnit: 'metric',
            ensureNavigation: false, // Already added above
          });
        });

        updateSize();

        map.on('load', () => {
          // Apply lightPreset for Standard style variants
          const lightPresetMap: Record<string, string> = {
            'mapbox://styles/mapbox/standard': 'day',
            'mapbox://styles/mapbox/standard-dawn': 'dawn',
            'mapbox://styles/mapbox/standard-dusk': 'dusk',
            'mapbox://styles/mapbox/standard-night': 'night',
          };
          const lightPreset = lightPresetMap[mapStyle];
          if (lightPreset && typeof map.setConfigProperty === 'function') {
            try {
              map.setConfigProperty('basemap', 'lightPreset', lightPreset);
            } catch (e) {
              // setConfigProperty may not be available on all versions
            }
          }

          ensureAllLayers();
          attachClickHandlers();

          // Set initial data on sources
          const v2Src = map.getSource('wigle-v2-points') as mapboxglType.GeoJSONSource | undefined;
          if (v2Src) v2Src.setData((v2FCRef.current || EMPTY_FC) as any);
          const v3Src = map.getSource('wigle-v3-points') as mapboxglType.GeoJSONSource | undefined;
          if (v3Src) v3Src.setData((v3FCRef.current || EMPTY_FC) as any);

          setMapReady(true);
          setTimeout(() => map.resize(), 0);
          updateAllClusterColors();
        });

        map.on('idle', () => {
          if (!mounted) return;
          setTilesReady(map.areTilesLoaded());
        });

        map.on('error', (event) => {
          if (!mounted) return;
          const errorMsg = event?.error?.message || '';

          // Ignore layer/source not found errors - they're expected for some styles
          if (
            errorMsg.includes('source') ||
            errorMsg.includes('layer') ||
            errorMsg.includes('composite') ||
            errorMsg.includes('building')
          ) {
            logDebug('[Wigle] Map style incompatibility (ignored):', errorMsg);
            return;
          }

          // Only show actual errors to user
          setError(errorMsg || 'Mapbox error');
        });
        map.on('moveend', updateAllClusterColors);
        map.on('zoomend', updateAllClusterColors);
        map.on('sourcedata', (event) => {
          if (
            (event.sourceId === 'wigle-v2-points' || event.sourceId === 'wigle-v3-points') &&
            event.isSourceLoaded
          ) {
            updateAllClusterColors();
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

  // Sync v2 data to map
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;
    if (!map.getSource('wigle-v2-points')) {
      if (map.isStyleLoaded()) {
        ensureV2Layers();
      } else {
        map.once('style.load', () => {
          ensureV2Layers();
          const source = map.getSource('wigle-v2-points') as mapboxglType.GeoJSONSource | undefined;
          if (source) {
            source.setData((v2FCRef.current || EMPTY_FC) as any);
            updateClusterColors('wigle-v2-points', 'v2');
          }
        });
        return;
      }
    }
    logDebug(`[WiGLE] Updating v2 map with ${v2Rows.length} points`);
    const source = map.getSource('wigle-v2-points') as mapboxglType.GeoJSONSource | undefined;
    if (!source) return;
    clusterColorCache.current.v2 = {};
    map.removeFeatureState({ source: 'wigle-v2-points' });
    source.setData(v2FeatureCollection as any);
    updateClusterColors('wigle-v2-points', 'v2');
  }, [v2FeatureCollection, v2Rows]);

  // Sync v3 data to map
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;
    if (!map.getSource('wigle-v3-points')) {
      if (map.isStyleLoaded()) {
        ensureV3Layers();
      } else {
        map.once('style.load', () => {
          ensureV3Layers();
          const source = map.getSource('wigle-v3-points') as mapboxglType.GeoJSONSource | undefined;
          if (source) {
            source.setData((v3FCRef.current || EMPTY_FC) as any);
            updateClusterColors('wigle-v3-points', 'v3');
          }
        });
        return;
      }
    }
    logDebug(`[WiGLE] Updating v3 map with ${v3Rows.length} points`);
    const source = map.getSource('wigle-v3-points') as mapboxglType.GeoJSONSource | undefined;
    if (!source) return;
    clusterColorCache.current.v3 = {};
    map.removeFeatureState({ source: 'wigle-v3-points' });
    source.setData(v3FeatureCollection as any);
    updateClusterColors('wigle-v3-points', 'v3');
  }, [v3FeatureCollection, v3Rows]);

  // Fit bounds when new data arrives
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;
    const allRows = [...v2Rows, ...v3Rows];
    if (allRows.length === 0) return;
    const coords = allRows.map(
      (row) => [Number(row.trilong), Number(row.trilat)] as [number, number]
    );
    const bounds = coords.reduce(
      (acc, coord) => acc.extend(coord),
      new mapboxgl.LngLatBounds(coords[0], coords[0])
    );
    map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 700 });
  }, [v2Rows, v3Rows]);

  // Apply layer visibility whenever layers toggle
  useEffect(() => {
    applyLayerVisibility();
  }, [applyLayerVisibility]);

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
    setError(null);

    const params = new URLSearchParams({ include_total: '1' });
    if (limit !== null) params.set('limit', String(limit));
    if (offset > 0) params.set('offset', String(offset));
    if (typeFilter.trim()) params.set('type', typeFilter.trim());
    const { filtersForPage, enabledForPage } = adaptedFilters;
    params.set('filters', JSON.stringify(filtersForPage));
    params.set('enabled', JSON.stringify(enabledForPage));

    const doFetch = async (endpoint: string) => {
      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const rows =
        payload.data?.map((row: any) => ({
          ...row,
          accuracy: row.accuracy || row.acc || null,
        })) || [];
      return { rows, total: typeof payload.total === 'number' ? payload.total : null };
    };

    // Fetch enabled sources in parallel
    const promises: Promise<void>[] = [];

    if (layers.v2) {
      setV2Loading(true);
      promises.push(
        doFetch('/api/wigle/networks-v2')
          .then(({ rows, total }) => {
            setV2Rows(rows);
            setV2Total(total);
          })
          .catch((err) => setError(err.message || 'Failed to load v2 points'))
          .finally(() => setV2Loading(false))
      );
    }

    if (layers.v3) {
      setV3Loading(true);
      promises.push(
        doFetch('/api/wigle/networks-v3')
          .then(({ rows, total }) => {
            setV3Rows(rows);
            setV3Total(total);
          })
          .catch((err) => setError(err.message || 'Failed to load v3 points'))
          .finally(() => setV3Loading(false))
      );
    }

    if (promises.length === 0) {
      setError('Enable at least one data layer (v2 or v3) to load points');
    }

    await Promise.all(promises);
  }, [limit, offset, typeFilter, adaptedFilters, layers.v2, layers.v3]);

  // Handle map style changes - use ref to get latest featureCollection without causing re-runs
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const recreateLayers = () => {
      ensureAllLayers();
      attachClickHandlers();
      const v2Src = map.getSource('wigle-v2-points') as mapboxglType.GeoJSONSource | undefined;
      if (v2Src) v2Src.setData((v2FCRef.current || EMPTY_FC) as any);
      const v3Src = map.getSource('wigle-v3-points') as mapboxglType.GeoJSONSource | undefined;
      if (v3Src) v3Src.setData((v3FCRef.current || EMPTY_FC) as any);
      applyLayerVisibility();
      updateAllClusterColors();
    };

    // Standard style variants all use the same base URL
    const actualStyleUrl = mapStyle.startsWith('mapbox://styles/mapbox/standard')
      ? 'mapbox://styles/mapbox/standard'
      : mapStyle;

    // Determine lightPreset for Standard style variants
    const lightPresetMap: Record<string, string> = {
      'mapbox://styles/mapbox/standard': 'day',
      'mapbox://styles/mapbox/standard-dawn': 'dawn',
      'mapbox://styles/mapbox/standard-dusk': 'dusk',
      'mapbox://styles/mapbox/standard-night': 'night',
    };
    const lightPreset = lightPresetMap[mapStyle];

    map.setStyle(actualStyleUrl);
    map.once('style.load', () => {
      // Apply lightPreset for Standard style variants
      if (lightPreset && typeof map.setConfigProperty === 'function') {
        try {
          map.setConfigProperty('basemap', 'lightPreset', lightPreset);
        } catch (e) {
          // setConfigProperty may not be available on all versions
        }
      }
      // Reset click handlers flag so they get re-attached after style change
      wigleHandlersAttachedRef.current = false;
      recreateLayers();
    });
  }, [
    mapStyle,
    mapReady,
    ensureAllLayers,
    attachClickHandlers,
    applyLayerVisibility,
    updateAllClusterColors,
  ]);

  // Handle 3D buildings
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const toggleBuildings = () => {
      try {
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
      } catch (err) {
        // Silently fail - some map styles don't have building layer
        logDebug('[Wigle] 3D buildings not available for this map style');
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
      try {
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
      } catch (err) {
        // Silently fail - terrain may not be available for all map styles
        logDebug('[Wigle] Terrain not available for this map style');
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

  const loading = v2Loading || v3Loading;
  const totalLoaded = v2Rows.length + v3Rows.length;

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
        rowsLoaded={totalLoaded}
        totalRows={v2Total !== null || v3Total !== null ? (v2Total ?? 0) + (v3Total ?? 0) : null}
        layers={layers}
        onToggleLayer={toggleLayer}
      />

      <FilterPanelContainer
        isOpen={showFilters && showMenu}
        adaptedFilters={adaptedFilters}
        position="overlay"
      />

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
