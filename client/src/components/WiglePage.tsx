import { usePageFilters } from '../hooks/usePageFilters';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { Map, GeoJSONSource } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { HamburgerButton } from './HamburgerButton';
import { WigleControlPanel } from './WigleControlPanel';
import { FilterPanelContainer } from './FilterPanelContainer';
import { WigleMap } from './WigleMap';
import { useFilterURLSync } from '../hooks/useFilteredData';
import { useAdaptedFilters } from '../hooks/useAdaptedFilters';
import { getPageCapabilities } from '../utils/filterCapabilities';
import { logDebug } from '../logging/clientLogger';
import { useAgencyOffices } from './hooks/useAgencyOffices';
import type { AgencyVisibility } from './hooks/useAgencyOffices';
import { useWigleLayers } from './wigle/useWigleLayers';
import { useWigleData } from './wigle/useWigleData';
import { useWigleMapInit } from './wigle/useWigleMapInit';
import { ensureV2Layers, ensureV3Layers, applyLayerVisibility } from './wigle/mapLayers';
import { attachClickHandlers } from './wigle/mapHandlers';
import { updateClusterColors, updateAllClusterColors } from './wigle/clusterColors';
import { rowsToGeoJSON, EMPTY_FEATURE_COLLECTION, DEFAULT_LIMIT, MAP_STYLES } from '../utils/wigle';

const WiglePage: React.FC = () => {
  // Set current page for filter scoping
  usePageFilters('wigle');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const mapboxRef = useRef<typeof mapboxglType | null>(null);
  const clusterColorCache = useRef<Record<string, Record<number, string>>>({ v2: {}, v3: {} });
  const v2FCRef = useRef<any>(null);
  const v3FCRef = useRef<any>(null);
  const autoFetchedRef = useRef<{ v2: boolean; v3: boolean }>({ v2: false, v3: false });
  const styleEffectInitRef = useRef(false);
  const [limit] = useState<number | null>(DEFAULT_LIMIT);
  const [offset] = useState(0);
  const [typeFilter] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [, setTokenStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [, setMapSize] = useState({ width: 0, height: 0 });
  const [, setTilesReady] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Universal filter system (must be before useWigleData)
  const capabilities = useMemo(() => getPageCapabilities('wigle'), []);
  const adaptedFilters = useAdaptedFilters(capabilities);
  useFilterURLSync();

  // Layer visibility state (persisted)
  const { layers, toggleLayer } = useWigleLayers();
  const layersRef = useRef(layers);
  layersRef.current = layers;

  // Map initialization error state
  const [mapError, setError] = useState<string | null>(null);

  // Data fetching
  const {
    v2Loading,
    v3Loading,
    error: dataError,
    v2Rows,
    v3Rows,
    v2Total,
    v3Total,
    fetchPoints,
  } = useWigleData({
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

  const updateAllClusterColorsCallback = useCallback(() => {
    if (!mapRef.current) return;
    updateAllClusterColors(mapRef.current, clusterColorCache);
  }, []);

  const v2FeatureCollection = useMemo(() => rowsToGeoJSON(v2Rows), [v2Rows]);
  const v3FeatureCollection = useMemo(() => rowsToGeoJSON(v3Rows), [v3Rows]);

  // Keep refs updated with latest featureCollections
  v2FCRef.current = v2FeatureCollection;
  v3FCRef.current = v3FeatureCollection;

  const ensureV2LayersCallback = useCallback(() => {
    if (!mapRef.current) return;
    ensureV2Layers(mapRef.current, v2FCRef);
  }, []);

  const ensureV3LayersCallback = useCallback(() => {
    if (!mapRef.current) return;
    ensureV3Layers(mapRef.current, v3FCRef);
  }, []);

  const ensureAllLayers = useCallback(() => {
    ensureV2LayersCallback();
    ensureV3LayersCallback();
  }, [ensureV2LayersCallback, ensureV3LayersCallback]);

  // Apply layer visibility on the map (stable ref — reads current layers from layersRef)
  const applyLayerVisibilityCallback = useCallback(() => {
    if (!mapRef.current) return;
    applyLayerVisibility(mapRef.current, layersRef.current);
  }, []);

  // Attach click handlers once
  const attachClickHandlersCallback = useCallback(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;
    attachClickHandlers(map, mapboxgl, wigleHandlersAttachedRef);
  }, []);

  // Initialize map
  useWigleMapInit({
    mapContainerRef,
    mapRef,
    mapboxRef,
    v2FCRef,
    v3FCRef,
    mapStyle,
    setMapSize,
    setTokenStatus,
    setError,
    setMapReady,
    setTilesReady,
    ensureAllLayers,
    attachClickHandlersCallback,
    updateAllClusterColorsCallback,
  });

  // Sync v2 data to map
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;
    if (!map.getSource('wigle-v2-points')) {
      if (map.isStyleLoaded()) {
        ensureV2LayersCallback();
      } else {
        map.once('style.load', () => {
          ensureV2LayersCallback();
          const source = map.getSource('wigle-v2-points') as GeoJSONSource | undefined;
          if (source) {
            source.setData((v2FCRef.current || EMPTY_FEATURE_COLLECTION) as any);
            updateClusterColors(map, 'wigle-v2-points', 'v2', clusterColorCache);
          }
        });
        return;
      }
    }
    logDebug(`[WiGLE] Updating v2 map with ${v2Rows.length} points`);
    const source = map.getSource('wigle-v2-points') as GeoJSONSource | undefined;
    if (!source) return;
    clusterColorCache.current.v2 = {};
    map.removeFeatureState({ source: 'wigle-v2-points' });
    source.setData(v2FeatureCollection as any);
    updateClusterColors(map, 'wigle-v2-points', 'v2', clusterColorCache);
  }, [v2FeatureCollection, v2Rows, ensureV2LayersCallback]);

  // Sync v3 data to map
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!map || !mapboxgl) return;
    if (!map.getSource('wigle-v3-points')) {
      if (map.isStyleLoaded()) {
        ensureV3LayersCallback();
      } else {
        map.once('style.load', () => {
          ensureV3LayersCallback();
          const source = map.getSource('wigle-v3-points') as GeoJSONSource | undefined;
          if (source) {
            source.setData((v3FCRef.current || EMPTY_FEATURE_COLLECTION) as any);
            updateClusterColors(map, 'wigle-v3-points', 'v3', clusterColorCache);
          }
        });
        return;
      }
    }
    logDebug(`[WiGLE] Updating v3 map with ${v3Rows.length} points`);
    const source = map.getSource('wigle-v3-points') as GeoJSONSource | undefined;
    if (!source) return;
    clusterColorCache.current.v3 = {};
    map.removeFeatureState({ source: 'wigle-v3-points' });
    source.setData(v3FeatureCollection as any);
    updateClusterColors(map, 'wigle-v3-points', 'v3', clusterColorCache);
  }, [v3FeatureCollection, v3Rows, ensureV3LayersCallback]);

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
    applyLayerVisibilityCallback();
  }, [layers.v2, layers.v3, applyLayerVisibilityCallback]);

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
      attachClickHandlersCallback();
      const v2Src = map.getSource('wigle-v2-points') as GeoJSONSource | undefined;
      if (v2Src) v2Src.setData((v2FCRef.current || EMPTY_FEATURE_COLLECTION) as any);
      const v3Src = map.getSource('wigle-v3-points') as GeoJSONSource | undefined;
      if (v3Src) v3Src.setData((v3FCRef.current || EMPTY_FEATURE_COLLECTION) as any);
      applyLayerVisibilityCallback();
      updateAllClusterColorsCallback();
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
    attachClickHandlersCallback,
    applyLayerVisibilityCallback,
    updateAllClusterColorsCallback,
  ]);

  // Handle 3D buildings
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const toggleBuildings = () => {
      try {
        if (show3dBuildings) {
          if (!map.getLayer('3d-buildings')) {
            const styleLayers = map.getStyle().layers;
            const labelLayerId = styleLayers?.find(
              (layer: any) => layer.type === 'symbol' && layer.layout?.['text-field']
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
        error={mapError || dataError}
        mapReady={mapReady}
      />
    </div>
  );
};

export default WiglePage;
