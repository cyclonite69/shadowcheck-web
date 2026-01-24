import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type mapboxglType from 'mapbox-gl';
import { useDebouncedFilters, useFilterStore } from '../stores/filterStore';
import { useFilterURLSync } from '../hooks/useFilteredData';
import { usePageFilters } from '../hooks/usePageFilters';
import { useNetworkData } from '../hooks/useNetworkData';
import { useObservations } from '../hooks/useObservations';
import { logError, logDebug } from '../logging/clientLogger';
import { renderNetworkTooltip } from '../utils/geospatial/renderNetworkTooltip';
import { MapToolbarActions } from './geospatial/MapToolbarActions';
import { MapSection } from './geospatial/MapSection';
import { GeospatialOverlays } from './geospatial/GeospatialOverlays';
import { GeospatialLayout } from './geospatial/GeospatialLayout';
import { NetworkExplorerSection } from './geospatial/NetworkExplorerSection';
import { useMapLayersToggle } from './geospatial/MapLayersToggle';
import { GeospatialFiltersPanel } from './geospatial/GeospatialFiltersPanel';
import { useLocationSearch } from './geospatial/useLocationSearch';
import { useHomeLocation } from './geospatial/useHomeLocation';
import { useMapDimensions } from './geospatial/useMapDimensions';
import { useBoundingBoxFilter } from './geospatial/useBoundingBoxFilter';
import { useHomeLocationLayer } from './geospatial/useHomeLocationLayer';
import { useObservationLayers } from './geospatial/useObservationLayers';
import { useNetworkInfiniteScroll } from './geospatial/useNetworkInfiniteScroll';

// Types
import type {
  ThreatInfo,
  ThreatEvidence,
  NetworkTag,
  NetworkRow,
  Observation,
  ContextMenuState,
  SortState,
} from '../types/network';

// Constants
import {
  NETWORK_COLUMNS,
  API_SORT_MAP,
  NETWORK_PAGE_LIMIT,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  DEFAULT_HOME_RADIUS,
  NETWORK_COLORS,
  MAP_STYLES,
} from '../constants/network';

// Utils
import {
  createCirclePolygon,
  calculateSignalRange,
  macColor,
  createGoogleStyle,
} from '../utils/mapHelpers';

// Components
import { TypeBadge, ThreatBadge } from './badges';

export default function GeospatialExplorer() {
  // Set current page for filter scoping
  usePageFilters('geospatial');
  const DEBUG_TIMEGRID = false;

  // Location mode and plan check state (needed by useNetworkData)
  const [locationMode, setLocationMode] = useState('latest_observation');
  const [planCheck, setPlanCheck] = useState(false);

  // Network data hook - handles fetching, pagination, sorting
  const {
    networks,
    loading: loadingNetworks,
    isLoadingMore,
    error,
    setError,
    networkTotal,
    networkTruncated,
    expensiveSort,
    pagination,
    sort,
    setSort,
    loadMore,
    resetPagination,
  } = useNetworkData({ locationMode, planCheck });

  // Selection state for observations
  const [selectedNetworks, setSelectedNetworks] = useState<Set<string>>(new Set());
  const [useObservationFilters, setUseObservationFilters] = useState(true);

  // Observations hook - handles fetching observations for selected networks
  const {
    observationsByBssid,
    loading: loadingObservations,
    total: observationsTotal,
    truncated: observationsTruncated,
    renderBudgetExceeded,
    renderBudget,
  } = useObservations(selectedNetworks, { useFilters: useObservationFilters });

  // UI state
  const [mapHeight, setMapHeight] = useState<number>(500);
  const [containerHeight, setContainerHeight] = useState<number>(800);
  const [mapStyle, setMapStyle] = useState<string>(() => {
    return localStorage.getItem('shadowcheck_map_style') || 'mapbox://styles/mapbox/dark-v11';
  });
  const [show3DBuildings, setShow3DBuildings] = useState<boolean>(() => {
    return localStorage.getItem('shadowcheck_show_3d_buildings') === 'true';
  });
  const [showTerrain, setShowTerrain] = useState<boolean>(() => {
    return localStorage.getItem('shadowcheck_show_terrain') === 'true';
  });
  const [embeddedView, setEmbeddedView] = useState<'street-view' | 'earth' | null>(null);
  const [resizing, setResizing] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<(keyof NetworkRow | 'select')[]>(() => {
    const saved = localStorage.getItem('shadowcheck_visible_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (key): key is keyof NetworkRow | 'select' =>
              typeof key === 'string' && key in NETWORK_COLUMNS
          );
          if (valid.length) return valid;
        }
      } catch {
        // Fall through to default
      }
    }
    return Object.keys(NETWORK_COLUMNS).filter(
      (k) => NETWORK_COLUMNS[k as keyof typeof NETWORK_COLUMNS].default
    ) as (keyof NetworkRow | 'select')[];
  });
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Map and location state
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [homeButtonActive, setHomeButtonActive] = useState(false);
  const [fitButtonActive, setFitButtonActive] = useState(false);
  const [homeLocation, setHomeLocation] = useState<{
    center: [number, number];
    radius: number;
  }>({ center: DEFAULT_CENTER, radius: DEFAULT_HOME_RADIUS });

  // Context menu state for network tagging
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    network: NetworkRow | null;
    tag: NetworkTag | null;
    position: 'below' | 'above';
  }>({
    visible: false,
    x: 0,
    y: 0,
    network: null,
    tag: null,
    position: 'below',
  });
  const [tagLoading, setTagLoading] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Note modal state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedBssid, setSelectedBssid] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [noteAttachments, setNoteAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Time-frequency modal state
  const [timeFreqModal, setTimeFreqModal] = useState<{ bssid: string; ssid: string } | null>(null);

  useFilterURLSync();
  const { getCurrentEnabled, setFilter } = useFilterStore();
  const enabled = getCurrentEnabled();

  // Set up debounced filter state
  const [debouncedFilterState, setDebouncedFilterState] = useState(() =>
    useFilterStore.getState().getAPIFilters()
  );
  useDebouncedFilters((payload) => setDebouncedFilterState(payload), 500);

  // Refs
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxglType.Map | null>(null);
  const mapboxRef = useRef<mapboxglType | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInitRef = useRef(false);
  const columnDropdownRef = useRef<HTMLDivElement | null>(null);
  const {
    locationSearch,
    setLocationSearch,
    searchResults,
    showSearchResults,
    setShowSearchResults,
    searchingLocation,
    locationSearchRef,
    flyToLocation,
  } = useLocationSearch({ mapRef, mapboxRef, logError });

  // Persist visible columns to localStorage
  useEffect(() => {
    localStorage.setItem('shadowcheck_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Location search moved into useLocationSearch hook

  // Reset pagination when filters change
  useEffect(() => {
    resetPagination();
  }, [JSON.stringify(debouncedFilterState), JSON.stringify(sort), locationMode, resetPagination]);

  useHomeLocation({ setHomeLocation, logError });

  useMapDimensions({ setContainerHeight, setMapHeight });
  useBoundingBoxFilter({
    mapReady,
    mapRef,
    enabled: enabled.boundingBox,
    setFilter,
  });

  useHomeLocationLayer({ mapReady, mapRef, homeLocation });

  // Apply persisted 3D buildings and terrain settings when map is ready
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    // Apply 3D buildings if persisted as enabled
    if (show3DBuildings) {
      add3DBuildings();
    }

    // Apply terrain if persisted as enabled
    if (showTerrain) {
      addTerrain();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]); // Only run when map becomes ready, not when settings change

  const activeObservationSets = useMemo(
    () =>
      Array.from(selectedNetworks).map((bssid) => ({
        bssid,
        observations: observationsByBssid[bssid] || [],
      })),
    [observationsByBssid, selectedNetworks]
  );
  const observationCount = useMemo(
    () => activeObservationSets.reduce((acc, set) => acc + set.observations.length, 0),
    [activeObservationSets]
  );
  const networkLookup = useMemo(() => {
    const map = new Map<string, NetworkRow>();
    networks.forEach((net) => {
      map.set(net.bssid, net);
    });
    return map;
  }, [networks]);

  // Handle resize drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      logDebug(`Resize handle clicked: ${e.clientY}`);
      e.preventDefault();
      e.stopPropagation();
      setResizing(true);

      const startY = e.clientY;
      const startHeight = mapHeight;

      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        const deltaY = e.clientY - startY;
        const newHeight = Math.max(150, Math.min(containerHeight - 150, startHeight + deltaY));
        logDebug(`Resizing to: ${newHeight}`);
        setMapHeight(newHeight);

        // Force map resize if it exists
        if (mapRef.current) {
          setTimeout(() => mapRef.current?.resize(), 0);
        }
      };

      const handleMouseUp = (e: MouseEvent) => {
        logDebug('Resize ended');
        e.preventDefault();
        setResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [mapHeight, containerHeight]
  );

  // Initialize map
  useEffect(() => {
    if (mapInitRef.current || !mapContainerRef.current) return;
    mapInitRef.current = true;

    const init = async () => {
      try {
        setMapReady(false);
        setMapError(null);

        const tokenRes = await fetch('/api/mapbox-token');
        if (!tokenRes.ok) {
          const text = await tokenRes.text();
          throw new Error(
            `Mapbox token fetch failed (${tokenRes.status}): ${text || 'invalid response'}`
          );
        }

        const tokenBody = await tokenRes.json();
        if (!tokenBody?.token) {
          throw new Error(tokenBody?.error || `Mapbox token not available`);
        }

        const mapboxgl = mapboxRef.current ?? (await import('mapbox-gl')).default;
        mapboxRef.current = mapboxgl;
        await import('mapbox-gl/dist/mapbox-gl.css');
        mapboxgl.accessToken = String(tokenBody.token).trim();

        if (mapContainerRef.current) {
          mapContainerRef.current.innerHTML = '';
        }

        // Find the style config for Standard variants
        const styleConfig = MAP_STYLES.find((s) => s.value === mapStyle);

        // Determine initial style (Google or Mapbox)
        let initialStyle;
        if (mapStyle.startsWith('google-')) {
          const googleType = mapStyle.replace('google-', '');
          initialStyle = createGoogleStyle(googleType);
        } else {
          initialStyle = mapStyle.startsWith('mapbox://styles/mapbox/standard')
            ? 'mapbox://styles/mapbox/standard'
            : mapStyle;
        }

        const map = new mapboxgl.Map({
          container: mapContainerRef.current as HTMLDivElement,
          style: initialStyle,
          center: homeLocation.center,
          zoom: DEFAULT_ZOOM,
          attributionControl: false,
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

        map.on('load', () => {
          // Apply light preset for Standard style variants
          if (styleConfig?.config?.lightPreset) {
            map.setConfigProperty('basemap', 'lightPreset', styleConfig.config.lightPreset);
          }

          // Add observation sources and layers
          map.addSource('observations', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          });

          map.addSource('observation-lines', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          });

          // Line layer connecting observations
          map.addLayer({
            id: 'observation-lines',
            type: 'line',
            source: 'observation-lines',
            paint: {
              'line-color': ['get', 'color'],
              'line-width': 2,
              'line-opacity': 0.6,
            },
          });

          // Circle layer for observation points (fixed size)
          map.addLayer({
            id: 'observation-points',
            type: 'circle',
            source: 'observations',
            paint: {
              'circle-radius': 7, // Fixed size - not based on signal
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.8,
            },
          });

          // Number labels on observation points
          map.addLayer({
            id: 'observation-labels',
            type: 'symbol',
            source: 'observations',
            layout: {
              'text-field': ['get', 'number'],
              'text-size': 12,
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            },
            paint: {
              'text-color': '#ffffff',
            },
          });

          // Add click handlers for observation points with signal circle tooltips
          map.on('click', 'observation-points', (e) => {
            if (!e.features || e.features.length === 0) return;

            const feature = e.features[0];
            const props = feature.properties;
            if (!props) return;

            const currentZoom = map.getZoom();
            const signalRadius = calculateSignalRange(props.signal, null, currentZoom);
            const bssidColor = macColor(props.bssid);

            // Create signal strength class
            let signalClass = 'signal-weak';
            if (props.signal >= -50) signalClass = 'signal-strong';
            else if (props.signal >= -70) signalClass = 'signal-medium';

            const formatFrequency = (freq) => {
              if (!freq) return 'N/A';
              if (freq >= 1000) return `${(freq / 1000).toFixed(1)} GHz`;
              return `${freq} MHz`;
            };
            const threatLevel = String(props.threatLevel || 'NONE').toUpperCase();
            const threatColor =
              threatLevel === 'HIGH'
                ? '#ef4444'
                : threatLevel === 'MED' || threatLevel === 'MEDIUM'
                  ? '#f59e0b'
                  : threatLevel === 'LOW'
                    ? '#eab308'
                    : '#10b981';
            const timespanText =
              typeof props.timespan_days === 'number'
                ? `${props.timespan_days} days`
                : props.first_seen && props.last_seen
                  ? `${Math.max(
                      1,
                      Math.ceil(
                        (new Date(props.last_seen).getTime() -
                          new Date(props.first_seen).getTime()) /
                          86400000
                      )
                    )} days`
                  : 'N/A';

            const popupHTML = renderNetworkTooltip({
              ssid: props.ssid,
              bssid: props.bssid,
              manufacturer: props.manufacturer,
              frequency: props.frequency,
              signal: props.signal,
              security: props.security,
              type: props.type,
              threat_level: threatLevel,
              threat_score: props.threat_score,
              lat: feature.geometry.coordinates[1],
              lon: feature.geometry.coordinates[0],
              altitude: props.altitude,
              distance_from_home_km: props.distance_from_home_km,
              observation_count: props.observation_count,
              unique_days: props.unique_days,
              unique_locations: props.unique_locations,
              max_distance_km: props.max_distance_km,
              first_seen: props.first_seen,
              last_seen: props.last_seen,
              time: props.time,
              timespan_days: props.timespan_days,
              accuracy: props.accuracy,
              channel: props.channel,
            });

            // Smart positioning using viewport bounds (similar to context menu logic)
            const popupWidth = 380;
            const popupHeight = 400;
            const padding = 10;

            // Get viewport dimensions
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            // Get click position in screen coordinates
            const mapContainer = map.getContainer();
            const mapRect = mapContainer.getBoundingClientRect();
            const screenX = mapRect.left + map.project(e.lngLat).x;
            const screenY = mapRect.top + map.project(e.lngLat).y;

            // Calculate optimal position
            let anchor = 'bottom';
            let offsetX = 0;
            let offsetY = -15;

            // Vertical positioning
            if (screenY + popupHeight + padding > viewportHeight) {
              // Flip to top if would overflow bottom
              anchor = 'top';
              offsetY = 15;
            }

            // Horizontal positioning
            if (screenX + popupWidth + padding > viewportWidth) {
              // Flip to left side if would overflow right
              if (anchor === 'top') {
                anchor = 'top-right';
              } else {
                anchor = 'bottom-right';
              }
              offsetX = 15;
            }

            // Ensure doesn't go off left edge
            if (screenX - popupWidth < padding && offsetX > 0) {
              offsetX = -15; // Reset to left side
              anchor = anchor.includes('top') ? 'top-left' : 'bottom-left';
            }

            new mapboxgl.Popup({
              offset: [offsetX, offsetY],
              className: 'sc-popup',
              anchor: anchor,
              maxWidth: '380px',
              closeOnClick: true,
              closeButton: true,
            })
              .setLngLat(e.lngLat)
              .setHTML(popupHTML)
              .addTo(map);
          });

          // Add hover circle source and layer (added BEFORE observation-points so it renders below)
          map.addSource('hover-circle', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          });

          // Insert hover circle layer BEFORE observation-lines so it appears below the points
          map.addLayer(
            {
              id: 'hover-circle-fill',
              type: 'circle',
              source: 'hover-circle',
              paint: {
                'circle-radius': ['get', 'radius'],
                'circle-color': ['get', 'color'],
                'circle-opacity': 0.35,
                'circle-stroke-width': 4,
                'circle-stroke-color': ['get', 'strokeColor'],
                'circle-stroke-opacity': 0.9,
              },
            },
            'observation-lines' // Insert before observation-lines layer
          );

          // Show signal circle on hover (tooltip removed - click for details)
          map.on('mouseenter', 'observation-points', (e) => {
            map.getCanvas().style.cursor = 'pointer';

            if (!e.features || e.features.length === 0) return;

            const feature = e.features[0];
            const props = feature.properties;
            if (!props || !e.lngLat) return;

            const currentZoom = map.getZoom();
            const signalRadius = calculateSignalRange(props.signal, props.frequency, currentZoom);
            const bssidColor = macColor(props.bssid);

            // Add signal range circle to map
            const hoverCircleSource = map.getSource('hover-circle') as mapboxglType.GeoJSONSource;
            if (hoverCircleSource) {
              hoverCircleSource.setData({
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: [e.lngLat.lng, e.lngLat.lat],
                    },
                    properties: {
                      radius: signalRadius,
                      color: bssidColor,
                      strokeColor: bssidColor,
                    },
                  },
                ],
              });
            }
          });

          map.on('mouseleave', 'observation-points', () => {
            map.getCanvas().style.cursor = '';

            // Clear hover circle from map
            const hoverCircleSource = map.getSource('hover-circle') as mapboxglType.GeoJSONSource;
            if (hoverCircleSource) {
              hoverCircleSource.setData({
                type: 'FeatureCollection',
                features: [],
              });
            }
          });

          map.on('mousemove', 'observation-points', (e) => {
            if (!e.features || e.features.length === 0 || !e.lngLat) return;
            const feature = e.features[0];
            const props = feature.properties;
            if (!props) return;

            const currentZoom = map.getZoom();
            const signalRadius = calculateSignalRange(props.signal, props.frequency, currentZoom);
            const bssidColor = macColor(props.bssid);

            const hoverCircleSource = map.getSource('hover-circle') as mapboxglType.GeoJSONSource;
            if (hoverCircleSource) {
              hoverCircleSource.setData({
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: [e.lngLat.lng, e.lngLat.lat],
                    },
                    properties: {
                      radius: signalRadius,
                      color: bssidColor,
                      strokeColor: bssidColor,
                    },
                  },
                ],
              });
            }
          });

          // Add home marker point source
          map.addSource('home-location-point', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: homeLocation.center,
                  },
                  properties: {
                    title: 'Home',
                  },
                },
              ],
            },
          });

          // Add home circle polygon source (proper geographic radius)
          map.addSource('home-location-circle', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [createCirclePolygon(homeLocation.center, homeLocation.radius)],
            },
          });

          // Home circle fill (proper meter-based radius)
          map.addLayer({
            id: 'home-circle-fill',
            type: 'fill',
            source: 'home-location-circle',
            paint: {
              'fill-color': '#10b981',
              'fill-opacity': 0.15,
            },
          });

          // Home circle outline
          map.addLayer({
            id: 'home-circle-outline',
            type: 'line',
            source: 'home-location-circle',
            paint: {
              'line-color': '#10b981',
              'line-width': 2,
              'line-opacity': 0.8,
            },
          });

          // Home marker dot
          map.addLayer({
            id: 'home-dot',
            type: 'circle',
            source: 'home-location-point',
            paint: {
              'circle-radius': 8,
              'circle-color': '#10b981',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          });

          // Home marker label
          map.addLayer({
            id: 'home-marker',
            type: 'symbol',
            source: 'home-location-point',
            layout: {
              'text-field': 'H',
              'text-size': 14,
              'text-anchor': 'center',
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            },
            paint: {
              'text-color': '#ffffff',
            },
          });

          setMapReady(true);
        });

        map.on('error', (e) => {
          // Suppress Google Maps tile errors (they spam the console)
          if (e?.error?.message === 'sn' || e?.sourceId === 'google-tiles') {
            // Google Maps tile loading error - likely API key issue
            if (mapStyle.startsWith('google-')) {
              setMapError('Google Maps tiles failed to load. Check API key configuration.');
            }
            return;
          }
          logError('Map error', e);
          setMapError('Map failed to load');
        });
      } catch (err) {
        logError('Map init failed', err);
        setMapError(err instanceof Error ? err.message : 'Map initialization failed');
      }
    };

    init();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      mapInitRef.current = false;
    };
  }, []);

  useNetworkInfiniteScroll({
    containerRef: tableContainerRef,
    hasMore: pagination.hasMore,
    isLoadingMore,
    onLoadMore: loadMore,
  });

  // Server-side sorting - no client-side sorting needed
  const filteredNetworks = useMemo(() => networks, [networks]);

  const handleColumnSort = (column: keyof NetworkRow, _shiftKey: boolean) => {
    const colConfig = NETWORK_COLUMNS[column as keyof typeof NETWORK_COLUMNS];
    if (!colConfig || !colConfig.sortable) return;
    if (!API_SORT_MAP[column]) {
      setError(`Sort not supported for ${String(column)}`);
      return;
    }

    setSort((prevSort) => {
      const existingIndex = prevSort.findIndex((s) => s.column === column);
      const nextDirection =
        existingIndex >= 0 && prevSort[existingIndex].direction === 'asc' ? 'desc' : 'asc';

      if (_shiftKey) {
        const next = [...prevSort];
        if (existingIndex >= 0) {
          next[existingIndex] = { column, direction: nextDirection };
        } else {
          next.push({ column, direction: 'asc' });
        }
        return next;
      }

      return [{ column, direction: existingIndex >= 0 ? nextDirection : 'asc' }];
    });
  };

  const toggleSelectNetwork = (bssid: string) => {
    setSelectedNetworks((prev) => {
      const ns = new Set(prev);
      ns.has(bssid) ? ns.delete(bssid) : ns.add(bssid);
      return ns;
    });
  };

  const selectNetworkExclusive = (bssid: string) => {
    setSelectedNetworks(new Set([bssid]));
  };

  // Context menu handlers for network tagging
  const openContextMenu = async (e: React.MouseEvent, network: NetworkRow) => {
    e.preventDefault();
    e.stopPropagation();

    const menuHeight = 320; // Height of context menu in pixels
    const menuWidth = 200; // Width of context menu in pixels
    const padding = 10; // Padding from screen edge

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let posX = e.clientX;
    let posY = e.clientY;
    let position: 'below' | 'above' = 'below';

    // ========== VERTICAL POSITIONING ==========
    // Check if menu would go off bottom of screen
    if (posY + menuHeight + padding > viewportHeight) {
      // Flip menu upward
      posY = e.clientY - menuHeight;
      position = 'above';
    }

    // Ensure menu doesn't go above top of screen
    if (posY < padding) {
      posY = padding;
      position = 'below'; // Reset to below if we hit top
    }

    // ========== HORIZONTAL POSITIONING ==========
    // Check if menu would go off right side of screen
    if (posX + menuWidth + padding > viewportWidth) {
      posX = viewportWidth - menuWidth - padding;
    }

    // Check if menu would go off left side of screen
    if (posX - padding < 0) {
      posX = padding;
    }

    // Fetch current tag state for this network
    try {
      const response = await fetch(`/api/network-tags/${encodeURIComponent(network.bssid)}`);
      const tag = await response.json();
      setContextMenu({
        visible: true,
        x: posX,
        y: posY,
        network,
        tag,
        position,
      });
    } catch (err) {
      logError('Failed to fetch network tag', err);
      setContextMenu({
        visible: true,
        x: posX,
        y: posY,
        network,
        tag: {
          bssid: network.bssid,
          is_ignored: false,
          ignore_reason: null,
          threat_tag: null,
          notes: null,
          exists: false,
        },
        position,
      });
    }
  };

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleTagAction = async (
    action: 'ignore' | 'threat' | 'suspect' | 'false_positive' | 'investigate' | 'clear',
    notes?: string
  ) => {
    if (!contextMenu.network) return;
    setTagLoading(true);
    try {
      const bssid = encodeURIComponent(contextMenu.network.bssid);
      let response;

      switch (action) {
        case 'ignore':
          response = await fetch(`/api/network-tags/${bssid}/ignore`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ignore_reason: 'known_friend' }),
          });
          break;
        case 'threat':
          response = await fetch(`/api/network-tags/${bssid}/threat`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threat_tag: 'THREAT', threat_confidence: 1.0 }),
          });
          break;
        case 'suspect':
          response = await fetch(`/api/network-tags/${bssid}/threat`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threat_tag: 'SUSPECT', threat_confidence: 0.7 }),
          });
          break;
        case 'false_positive':
          response = await fetch(`/api/network-tags/${bssid}/threat`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threat_tag: 'FALSE_POSITIVE', threat_confidence: 1.0 }),
          });
          break;
        case 'investigate':
          response = await fetch(`/api/network-tags/${bssid}/investigate`, { method: 'PATCH' });
          break;
        case 'clear':
          response = await fetch(`/api/network-tags/${bssid}`, { method: 'DELETE' });
          break;
      }

      if (response?.ok) {
        const result = await response.json();
        setContextMenu((prev) => ({ ...prev, tag: result.tag || { ...prev.tag, exists: false } }));
      }
    } catch (err) {
      logError('Failed to update network tag', err);
    } finally {
      setTagLoading(false);
      closeContextMenu();
    }
  };

  // Save note function
  const handleSaveNote = async () => {
    if (!noteContent.trim() || !selectedBssid) return;

    try {
      // Step 1: Create the note
      const response = await fetch('/api/admin/network-notes/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bssid: selectedBssid,
          content: noteContent,
          note_type: noteType,
          user_id: 'geospatial_user',
        }),
      });

      if (!response.ok) throw new Error('Failed to create note');

      const data = await response.json();
      const noteId = data.note_id;

      // Step 2: Upload attachments if any
      if (noteAttachments.length > 0) {
        for (const file of noteAttachments) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('bssid', selectedBssid);

          const mediaResponse = await fetch(`/api/admin/network-notes/${noteId}/media`, {
            method: 'POST',
            body: formData,
          });

          if (!mediaResponse.ok) {
            console.warn(`Failed to upload media: ${file.name}`);
          }
        }
      }

      // Success: Reset form
      setShowNoteModal(false);
      setNoteContent('');
      setNoteType('general');
      setSelectedBssid('');
      setNoteAttachments([]);
    } catch (err) {
      logError('Failed to save note', err);
    }
  };

  // Handle file selection for attachments
  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNoteAttachments((prev) => [...prev, ...files]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attachment from pending list
  const removeAttachment = (index: number) => {
    setNoteAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.visible]);

  const toggleSelectAll = () => {
    if (selectedNetworks.size === filteredNetworks.length) {
      // All selected, deselect all
      setSelectedNetworks(new Set());
    } else {
      // Some or none selected, select all visible
      setSelectedNetworks(new Set(filteredNetworks.map((n) => n.bssid)));
    }
  };

  const allSelected =
    filteredNetworks.length > 0 && selectedNetworks.size === filteredNetworks.length;
  const someSelected = selectedNetworks.size > 0 && selectedNetworks.size < filteredNetworks.length;

  useObservationLayers({
    mapReady,
    mapRef,
    mapboxRef,
    activeObservationSets,
    networkLookup,
  });

  const toggleColumn = (col: keyof NetworkRow | 'select') => {
    setVisibleColumns((v) => (v.includes(col) ? v.filter((c) => c !== col) : [...v, col]));
  };

  // Export KML for Google Earth
  const exportToGoogleEarth = async () => {
    // Require network selection first
    if (activeObservationSets.length === 0) {
      alert(
        'Please select one or more networks first.\n\n' +
          'Click the eye icon next to a network in the table below to show its observations, ' +
          'then select Google Earth to export only those networks.'
      );
      return;
    }

    try {
      // Export only the selected networks
      const bssids = activeObservationSets.map((set) => set.bssid).join(',');
      const url = `/api/kml?bssids=${encodeURIComponent(bssids)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to export KML');
      }

      const kmlData = await response.text();

      // Create a blob and download link
      const blob = new Blob([kmlData], { type: 'application/vnd.google-earth.kml+xml' });
      const downloadUrl = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = downloadUrl;
      const networkCount = activeObservationSets.length;
      link.download = `shadowcheck_${networkCount}_networks_${new Date().toISOString().split('T')[0]}.kml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      // Open Google Earth Web at current location
      const center = mapRef.current?.getCenter() || { lat: 43.0234, lng: -83.6968 };
      const zoom = mapRef.current?.getZoom() || 12;
      const altitude =
        (Math.pow(2, 22 - zoom) * 156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / 2;
      const earthUrl = `https://earth.google.com/web/@${center.lat},${center.lng},${altitude}a,${altitude}d,35y,0h,0t,0r`;

      // Show instruction to user
      const openEarth = window.confirm(
        `KML file with ${networkCount} network(s) downloaded!\n\n` +
          'To view in Google Earth:\n' +
          '1. Open Google Earth Pro (desktop) and File > Open the KML file, OR\n' +
          '2. Go to Google Earth Web and drag the KML file onto the map\n\n' +
          'Click OK to open Google Earth Web now.'
      );

      if (openEarth) {
        window.open(earthUrl, '_blank');
      }
    } catch (error) {
      logError('Failed to export KML', error);
      alert('Failed to export KML data. Please try again.');
    }
  };

  // Map style change handler
  const changeMapStyle = (styleUrl: string) => {
    // Handle Google Earth - generate KML with observations
    if (styleUrl === 'google-earth') {
      exportToGoogleEarth();
      return;
    }

    // Handle Street View embed
    if (styleUrl === 'google-street-view') {
      setEmbeddedView('street-view');
      localStorage.setItem('shadowcheck_map_style', styleUrl);
      setMapStyle(styleUrl);
      return;
    }

    // Clear embedded view when switching to regular map
    setEmbeddedView(null);

    if (!mapRef.current) return;

    const currentCenter = mapRef.current.getCenter();
    const currentZoom = mapRef.current.getZoom();

    // Save the style preference
    localStorage.setItem('shadowcheck_map_style', styleUrl);
    setMapStyle(styleUrl);

    // Find the style config for Standard variants
    const styleConfig = MAP_STYLES.find((s) => s.value === styleUrl);

    // Handle Google Maps styles
    if (styleUrl.startsWith('google-')) {
      const googleType = styleUrl.replace('google-', ''); // roadmap, satellite, hybrid, terrain
      const googleStyle = createGoogleStyle(googleType);

      // Clear any previous error when switching styles
      setMapError(null);

      mapRef.current.setStyle(googleStyle);
    } else {
      // Get the actual style URL (Standard variants all use the same base URL)
      const actualStyleUrl = styleUrl.startsWith('mapbox://styles/mapbox/standard')
        ? 'mapbox://styles/mapbox/standard'
        : styleUrl;
      mapRef.current.setStyle(actualStyleUrl);
    }

    mapRef.current.once('style.load', () => {
      if (!mapRef.current) return;

      mapRef.current.setCenter(currentCenter);
      mapRef.current.setZoom(currentZoom);

      // Apply light preset for Standard style variants
      if (styleConfig?.config?.lightPreset) {
        mapRef.current.setConfigProperty('basemap', 'lightPreset', styleConfig.config.lightPreset);
      }

      // Re-add observation sources and layers
      mapRef.current.addSource('observations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      mapRef.current.addSource('observation-lines', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Line layer connecting observations
      mapRef.current.addLayer({
        id: 'observation-lines',
        type: 'line',
        source: 'observation-lines',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.6,
        },
      });

      // Circle layer for observation points (fixed size)
      mapRef.current.addLayer({
        id: 'observation-points',
        type: 'circle',
        source: 'observations',
        paint: {
          'circle-radius': 7, // Fixed size - not based on signal
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.8,
        },
      });

      // Number labels on observation points
      mapRef.current.addLayer({
        id: 'observation-labels',
        type: 'symbol',
        source: 'observations',
        layout: {
          'text-field': ['get', 'number'],
          'text-size': 12,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // Re-add hover circle source and layer for signal range visualization
      mapRef.current.addSource('hover-circle', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Insert hover circle layer BEFORE observation-lines so it appears below the points
      mapRef.current.addLayer(
        {
          id: 'hover-circle-fill',
          type: 'circle',
          source: 'hover-circle',
          paint: {
            'circle-radius': ['get', 'radius'],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.35,
            'circle-stroke-width': 4,
            'circle-stroke-color': ['get', 'strokeColor'],
            'circle-stroke-opacity': 0.9,
          },
        },
        'observation-lines' // Insert before observation-lines layer
      );

      // Re-add home location sources and layers
      mapRef.current.addSource('home-location-point', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: homeLocation.center,
              },
              properties: {
                title: 'Home',
              },
            },
          ],
        },
      });

      mapRef.current.addSource('home-location-circle', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [createCirclePolygon(homeLocation.center, homeLocation.radius)],
        },
      });

      // Home circle fill
      mapRef.current.addLayer({
        id: 'home-circle-fill',
        type: 'fill',
        source: 'home-location-circle',
        paint: {
          'fill-color': '#10b981',
          'fill-opacity': 0.15,
        },
      });

      // Home circle outline
      mapRef.current.addLayer({
        id: 'home-circle-outline',
        type: 'line',
        source: 'home-location-circle',
        paint: {
          'line-color': '#10b981',
          'line-width': 2,
          'line-opacity': 0.8,
        },
      });

      // Home marker dot
      mapRef.current.addLayer({
        id: 'home-dot',
        type: 'circle',
        source: 'home-location-point',
        paint: {
          'circle-radius': 8,
          'circle-color': '#10b981',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Home marker label
      mapRef.current.addLayer({
        id: 'home-marker',
        type: 'symbol',
        source: 'home-location-point',
        layout: {
          'text-field': 'H',
          'text-size': 14,
          'text-anchor': 'center',
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // Restore layers if they were enabled
      if (show3DBuildings) {
        add3DBuildings();
      }
      if (showTerrain) {
        addTerrain();
      }

      // Re-render observations
      if (activeObservationSets.length > 0) {
        const features = activeObservationSets.flatMap((set) =>
          set.observations.map((obs, index) => {
            const network = networkLookup.get(obs.bssid);
            const threatLevel = network?.threat?.level ?? 'NONE';

            return {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [obs.lon, obs.lat],
              },
              properties: {
                bssid: obs.bssid,
                signal: obs.signal,
                time: obs.time,
                frequency: obs.frequency,
                altitude: obs.altitude,
                ssid: network?.ssid || '(hidden)',
                manufacturer: network?.manufacturer || null,
                security: network?.security || null,
                threatLevel,
                first_seen: network?.firstSeen || null,
                last_seen: network?.lastSeen || null,
                timespan_days:
                  typeof network?.timespanDays === 'number' ? network.timespanDays : null,
                type: network?.type || null,
                number: index + 1,
                color: macColor(obs.bssid),
              },
            };
          })
        );

        if (mapRef.current.getSource('observations')) {
          (mapRef.current.getSource('observations') as mapboxglType.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: features as any,
          });
        }
      }
    });
  };

  const { toggle3DBuildings, toggleTerrain } = useMapLayersToggle({
    mapRef,
    setShow3DBuildings,
    setShowTerrain,
  });

  // Helper functions for internal use
  const add3DBuildings = () => toggle3DBuildings(true);
  const addTerrain = () => toggleTerrain(true);

  return (
    <GeospatialLayout
      filtersOpen={filtersOpen}
      filterPanel={<GeospatialFiltersPanel />}
      content={
        <>
          {/* Map Card */}
          <MapSection
            mapHeight={mapHeight}
            title="ShadowCheck Geospatial Intelligence"
            toolbar={
              <MapToolbarActions
                locationSearchRef={locationSearchRef}
                locationSearch={locationSearch}
                setLocationSearch={setLocationSearch}
                searchingLocation={searchingLocation}
                showSearchResults={showSearchResults}
                setShowSearchResults={setShowSearchResults}
                searchResults={searchResults}
                onSelectSearchResult={flyToLocation}
                mapStyle={mapStyle}
                onMapStyleChange={changeMapStyle}
                mapStyles={MAP_STYLES}
                show3DBuildings={show3DBuildings}
                toggle3DBuildings={toggle3DBuildings}
                showTerrain={showTerrain}
                toggleTerrain={toggleTerrain}
                fitButtonActive={fitButtonActive}
                canFit={selectedNetworks.size > 0}
                mapboxRef={mapboxRef}
                mapRef={mapRef}
                activeObservationSets={activeObservationSets}
                setFitButtonActive={setFitButtonActive}
                homeButtonActive={homeButtonActive}
                setHomeButtonActive={setHomeButtonActive}
                homeLocation={homeLocation}
                logError={logError}
              />
            }
            mapReady={mapReady}
            mapError={mapError}
            embeddedView={embeddedView}
            mapRef={mapRef}
            mapContainerRef={mapContainerRef}
            onResizeMouseDown={handleMouseDown}
          />

          <NetworkExplorerSection
            expensiveSort={expensiveSort}
            planCheck={planCheck}
            onPlanCheckChange={setPlanCheck}
            locationMode={locationMode}
            onLocationModeChange={setLocationMode}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((open) => !open)}
            showColumnSelector={showColumnSelector}
            columnDropdownRef={columnDropdownRef}
            visibleColumns={visibleColumns}
            columns={NETWORK_COLUMNS}
            onToggleColumnSelector={() => setShowColumnSelector((v) => !v)}
            onToggleColumn={toggleColumn}
            sort={sort}
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleSelectAll={toggleSelectAll}
            onColumnSort={handleColumnSort}
            tableContainerRef={tableContainerRef}
            loadingNetworks={loadingNetworks}
            filteredNetworks={filteredNetworks}
            error={error}
            selectedNetworks={selectedNetworks}
            onSelectExclusive={selectNetworkExclusive}
            onOpenContextMenu={openContextMenu}
            onToggleSelectNetwork={toggleSelectNetwork}
            isLoadingMore={isLoadingMore}
            hasMore={pagination.hasMore}
            onLoadMore={loadMore}
            visibleCount={filteredNetworks.length}
            networkTruncated={networkTruncated}
            networkTotal={networkTotal}
            selectedCount={selectedNetworks.size}
            observationCount={observationCount}
            observationsTruncated={observationsTruncated}
            observationsTotal={observationsTotal}
            renderBudgetExceeded={renderBudgetExceeded}
            renderBudget={renderBudget}
            loadingObservations={loadingObservations}
          />
        </>
      }
      overlays={
        <GeospatialOverlays
          contextMenu={contextMenu}
          tagLoading={tagLoading}
          contextMenuRef={contextMenuRef}
          onTagAction={handleTagAction}
          onCloseContextMenu={closeContextMenu}
          onOpenTimeFrequency={() => {
            const n = contextMenu.network;
            const payload = n ? { bssid: String(n.bssid || ''), ssid: String(n.ssid || '') } : null;
            setTimeFreqModal(payload);
            closeContextMenu();
          }}
          onOpenNote={() => {
            setShowNoteModal(true);
            setSelectedBssid(contextMenu.network?.bssid || '');
            closeContextMenu();
          }}
          showNoteModal={showNoteModal}
          selectedBssid={selectedBssid}
          noteType={noteType}
          noteContent={noteContent}
          noteAttachments={noteAttachments}
          fileInputRef={fileInputRef}
          onNoteTypeChange={setNoteType}
          onNoteContentChange={setNoteContent}
          onAddAttachment={handleAddAttachment}
          onRemoveAttachment={removeAttachment}
          onCloseNoteOverlay={() => setShowNoteModal(false)}
          onCloseNote={() => {
            setShowNoteModal(false);
            setNoteContent('');
            setNoteAttachments([]);
          }}
          onCancelNote={() => {
            setShowNoteModal(false);
            setNoteContent('');
            setNoteType('general');
            setNoteAttachments([]);
          }}
          onSaveNote={handleSaveNote}
          timeFreqModal={timeFreqModal}
          onCloseTimeFrequency={() => setTimeFreqModal(null)}
        />
      }
    />
  );
}
