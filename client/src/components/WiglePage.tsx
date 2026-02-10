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
import { useWigleLayers } from './wigle/useWigleLayers';
import type { WigleLayerState } from './wigle/useWigleLayers';
import { useWigleData } from './wigle/useWigleData';
import {
  macColor,
  dominantClusterColor,
  formatSecurity,
  rowsToGeoJSON,
  EMPTY_FEATURE_COLLECTION,
  CLUSTER_SAMPLE_LIMIT,
  DEFAULT_LIMIT,
  MAP_STYLES,
} from '../utils/wigle';
import type { WigleRow } from '../utils/wigle';

const WiglePage: React.FC = () => {
  // Set current page for filter scoping
  usePageFilters('wigle');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxglType.Map | null>(null);
  const mapboxRef = useRef<mapboxglType | null>(null);
  const clusterColorCache = useRef<Record<string, Record<number, string>>>({ v2: {}, v3: {} });
  const v2FCRef = useRef<any>(null);
  const v3FCRef = useRef<any>(null);
  const autoFetchedRef = useRef<{ v2: boolean; v3: boolean }>({ v2: false, v3: false });
  const styleEffectInitRef = useRef(false);
  const [limit, setLimit] = useState<number | null>(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [tilesReady, setTilesReady] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Universal filter system (must be before useWigleData)
  const capabilities = useMemo(() => getPageCapabilities('wigle'), []);
  const adaptedFilters = useAdaptedFilters(capabilities);
  useFilterURLSync();

  // Layer visibility state (persisted)
  const { layers, toggleLayer, setLayers } = useWigleLayers();
  const layersRef = useRef(layers);
  layersRef.current = layers;

  // Data fetching
  const { v2Loading, v3Loading, error, v2Rows, v3Rows, v2Total, v3Total, fetchPoints } =
    useWigleData({
      limit,
      offset,
      typeFilter,
      adaptedFilters,
      v2Enabled: layers.v2,
      v3Enabled: layers.v3,
    });

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
        data: v2FCRef.current || EMPTY_FEATURE_COLLECTION,
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
        data: v3FCRef.current || EMPTY_FEATURE_COLLECTION,
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

  // Apply layer visibility on the map (stable ref — reads current layers from layersRef)
  const applyLayerVisibility = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const setVis = (layerId: string, visible: boolean) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    };

    const { v2, v3 } = layersRef.current;
    setVis('wigle-v2-clusters', v2);
    setVis('wigle-v2-cluster-count', v2);
    setVis('wigle-v2-unclustered', v2);
    setVis('wigle-v3-clusters', v3);
    setVis('wigle-v3-cluster-count', v3);
    setVis('wigle-v3-unclustered', v3);
  }, []);

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
          if (v2Src) v2Src.setData((v2FCRef.current || EMPTY_FEATURE_COLLECTION) as any);
          const v3Src = map.getSource('wigle-v3-points') as mapboxglType.GeoJSONSource | undefined;
          if (v3Src) v3Src.setData((v3FCRef.current || EMPTY_FEATURE_COLLECTION) as any);

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
            source.setData((v2FCRef.current || EMPTY_FEATURE_COLLECTION) as any);
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
            source.setData((v3FCRef.current || EMPTY_FEATURE_COLLECTION) as any);
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
  }, [layers.v2, layers.v3, applyLayerVisibility]);

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

  // Auto-fetch when a data layer is toggled ON and has no data yet
  useEffect(() => {
    if (!mapReady) return;
    const needsV2 = layers.v2 && v2Rows.length === 0 && !v2Loading && !autoFetchedRef.current.v2;
    const needsV3 = layers.v3 && v3Rows.length === 0 && !v3Loading && !autoFetchedRef.current.v3;
    if (needsV2 || needsV3) {
      if (needsV2) autoFetchedRef.current.v2 = true;
      if (needsV3) autoFetchedRef.current.v3 = true;
      fetchPoints();
    }
  }, [
    layers.v2,
    layers.v3,
    mapReady,
    v2Rows.length,
    v3Rows.length,
    v2Loading,
    v3Loading,
    fetchPoints,
  ]);

  // Handle map style changes - use ref to get latest featureCollection without causing re-runs
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Skip on initial mount — initMap already set up the correct style and layers
    if (!styleEffectInitRef.current) {
      styleEffectInitRef.current = true;
      return;
    }

    const recreateLayers = () => {
      ensureAllLayers();
      attachClickHandlers();
      const v2Src = map.getSource('wigle-v2-points') as mapboxglType.GeoJSONSource | undefined;
      if (v2Src) v2Src.setData((v2FCRef.current || EMPTY_FEATURE_COLLECTION) as any);
      const v3Src = map.getSource('wigle-v3-points') as mapboxglType.GeoJSONSource | undefined;
      if (v3Src) v3Src.setData((v3FCRef.current || EMPTY_FEATURE_COLLECTION) as any);
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
        mapStyles={MAP_STYLES}
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
