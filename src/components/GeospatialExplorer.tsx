import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { FilterPanel } from './FilterPanel';
import { useDebouncedFilters, useFilterStore } from '../stores/filterStore';
import { useFilterURLSync } from '../hooks/useFilteredData';
import { usePageFilters } from '../hooks/usePageFilters';
import { attachMapOrientationControls } from '../utils/mapOrientationControls';
import { logError, logDebug } from '../logging/clientLogger';

type ThreatInfo = {
  score: number;
  level: 'NONE' | 'LOW' | 'MED' | 'HIGH';
  summary: string;
  flags?: string[];
  signals?: Array<{
    code: string;
    weight: number;
    evidence: any;
  }>;
};

type ThreatEvidence = {
  rule: string;
  observedValue: number | string | null;
  threshold: number | string | null;
};

type NetworkTag = {
  bssid: string;
  is_ignored: boolean;
  ignore_reason: string | null;
  threat_tag: 'THREAT' | 'SUSPECT' | 'FALSE_POSITIVE' | 'INVESTIGATE' | null;
  notes: string | null;
  exists: boolean;
};

type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  network: NetworkRow | null;
  tag: NetworkTag | null;
};

type NetworkRow = {
  bssid: string;
  ssid: string;
  type: 'W' | 'E' | 'B' | 'G' | 'C' | 'D' | 'L' | 'N' | 'F' | '?' | null;
  signal: number | null;
  security: string | null;
  frequency: number | null;
  channel?: number | null;
  observations: number;
  latitude: number | null;
  longitude: number | null;
  rawLatitude?: number | null;
  rawLongitude?: number | null;
  distanceFromHome?: number | null;
  accuracy?: number | null;
  firstSeen?: string | null; // Add first seen
  lastSeen: string | null;
  timespanDays?: number | null; // Add timespan calculation
  threat?: ThreatInfo | null;
  threatReasons?: string[];
  threatEvidence?: ThreatEvidence[];
  stationaryConfidence?: number | null;
  // Enrichment fields (networks-v2 API)
  manufacturer?: string | null;
  min_altitude_m?: number | null;
  max_altitude_m?: number | null;
  altitude_span_m?: number | null;
  max_distance_meters?: number | null;
  last_altitude_m?: number | null;
  is_sentinel?: boolean | null;
};

type Observation = {
  id: string | number;
  bssid: string;
  lat: number;
  lon: number;
  signal?: number | null;
  time?: string;
  frequency?: number | null;
  altitude?: number | null;
  acc?: number | null;
  distance_from_home_km?: number | null;
};

const NETWORK_COLUMNS: Record<
  keyof NetworkRow | 'select',
  { label: string; width: number; sortable: boolean; default: boolean }
> = {
  select: { label: '✓', width: 40, sortable: false, default: true },
  type: { label: 'Type', width: 60, sortable: true, default: true },
  ssid: { label: 'SSID', width: 150, sortable: true, default: true },
  bssid: { label: 'BSSID', width: 140, sortable: true, default: true },
  threat: { label: 'Threat', width: 75, sortable: true, default: true },
  signal: { label: 'Signal (dBm)', width: 100, sortable: true, default: true },
  security: { label: 'Security', width: 80, sortable: true, default: true },
  frequency: { label: 'Frequency', width: 90, sortable: true, default: false },
  channel: { label: 'Channel', width: 70, sortable: true, default: false },
  observations: { label: 'Observations', width: 100, sortable: true, default: true },
  latitude: { label: 'Latitude', width: 100, sortable: true, default: false },
  longitude: { label: 'Longitude', width: 100, sortable: true, default: false },
  rawLatitude: { label: 'Raw Lat', width: 100, sortable: false, default: false },
  rawLongitude: { label: 'Raw Lon', width: 100, sortable: false, default: false },
  distanceFromHome: { label: 'Distance (km)', width: 100, sortable: true, default: true },
  accuracy: { label: 'Accuracy (m)', width: 90, sortable: true, default: false },
  stationaryConfidence: { label: 'Stationary Conf.', width: 110, sortable: true, default: false },
  firstSeen: { label: 'First Seen', width: 160, sortable: true, default: false },
  lastSeen: { label: 'Last Seen', width: 160, sortable: true, default: true },
  timespanDays: { label: 'Timespan (days)', width: 120, sortable: true, default: false },
  // Enrichment columns (networks-v2 API) - hidden by default
  manufacturer: { label: 'Manufacturer', width: 150, sortable: true, default: false },
  min_altitude_m: { label: 'Min Alt (m)', width: 90, sortable: true, default: false },
  max_altitude_m: { label: 'Max Alt (m)', width: 90, sortable: true, default: false },
  altitude_span_m: { label: 'Alt Span (m)', width: 100, sortable: true, default: false },
  max_distance_meters: { label: 'Max Dist (m)', width: 110, sortable: true, default: false },
  last_altitude_m: { label: 'Last Alt (m)', width: 90, sortable: true, default: false },
  is_sentinel: { label: 'Sentinel', width: 80, sortable: true, default: false },
};

const API_SORT_MAP: Partial<Record<keyof NetworkRow, string>> = {
  lastSeen: 'last_seen',
  firstSeen: 'first_observed_at',
  observed_at: 'observed_at',
  observations: 'obs_count',
  signal: 'signal',
  threat: 'threat',
  distanceFromHome: 'distance_from_home_km',
  ssid: 'ssid',
  bssid: 'bssid',
  frequency: 'frequency',
  accuracy: 'accuracy_meters',
  type: 'type',
  security: 'security',
  channel: 'channel',
  latitude: 'lat',
  longitude: 'lon',
  manufacturer: 'manufacturer',
  min_altitude_m: 'min_altitude_m',
  max_altitude_m: 'max_altitude_m',
  altitude_span_m: 'altitude_span_m',
  max_distance_meters: 'max_distance_meters',
  last_altitude_m: 'last_altitude_m',
  is_sentinel: 'is_sentinel',
  timespanDays: 'timespan_days',
};

const NETWORK_PAGE_LIMIT = 500;

const TypeBadge = ({ type }: { type: NetworkRow['type'] }) => {
  // WiGLE Network Type Classifications
  const types: Record<string, { label: string; color: string }> = {
    W: { label: 'WiFi', color: '#3b82f6' },
    E: { label: 'BLE', color: '#8b5cf6' },
    B: { label: 'BT', color: '#06b6d4' },
    G: { label: 'GSM', color: '#f59e0b' },
    C: { label: 'CDMA', color: '#f97316' },
    D: { label: '3G', color: '#84cc16' },
    L: { label: 'LTE', color: '#10b981' },
    N: { label: '5G', color: '#ec4899' },
    F: { label: 'NFC', color: '#6366f1' },
    '?': { label: 'Unknown', color: '#6b7280' },
  };
  const config = types[type || '?'] || types['?'];
  return (
    <span
      className="px-2 py-1 rounded text-xs font-semibold"
      style={{
        backgroundColor: config.color + '20',
        color: config.color,
        border: `1px solid ${config.color}40`,
      }}
    >
      {config.label}
    </span>
  );
};

const ThreatBadge = ({
  threat,
  reasons,
  evidence,
}: {
  threat?: ThreatInfo | null;
  reasons?: string[];
  evidence?: ThreatEvidence[];
}) => {
  if (!threat || threat.level === 'NONE') return null;

  const config = {
    HIGH: { label: 'HIGH', color: '#ef4444', bg: '#ef444420' },
    MED: { label: 'MED', color: '#f97316', bg: '#f9731620' },
    LOW: { label: 'LOW', color: '#eab308', bg: '#eab30820' },
    NONE: { label: '', color: '#6b7280', bg: '#6b728020' },
  };

  const levelConfig = config[threat.level];
  const reasonsList = (reasons || []).join(', ') || 'None';
  const evidenceLines =
    evidence && evidence.length > 0
      ? evidence
          .map(
            (e) =>
              `${e.rule}: observed=${e.observedValue ?? 'n/a'} threshold=${e.threshold ?? 'n/a'}`
          )
          .join('\n')
      : 'No evidence';

  return (
    <span
      className="px-2 py-1 rounded text-xs font-semibold"
      style={{
        backgroundColor: levelConfig.bg,
        color: levelConfig.color,
        border: `1px solid ${levelConfig.color}40`,
        cursor: 'help',
      }}
      title={`${threat.summary}\nScore: ${(threat.score * 100).toFixed(0)}%\nReasons: ${reasonsList}\n${evidenceLines}`}
    >
      {levelConfig.label}
    </span>
  );
};

type SortState = { column: keyof NetworkRow; direction: 'asc' | 'desc' };

// Default view - will be overridden by home location from API
const DEFAULT_CENTER: [number, number] = [-83.69682688, 43.02345147];
const DEFAULT_ZOOM = 12;
const DEFAULT_HOME_RADIUS = 100; // meters

// Helper to create a GeoJSON circle polygon from center and radius in meters
const createCirclePolygon = (
  center: [number, number],
  radiusMeters: number,
  steps = 64
): GeoJSON.Feature<GeoJSON.Polygon> => {
  const coords: [number, number][] = [];
  const km = radiusMeters / 1000;
  const distanceX = km / (111.32 * Math.cos((center[1] * Math.PI) / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * (2 * Math.PI);
    const x = center[0] + distanceX * Math.cos(theta);
    const y = center[1] + distanceY * Math.sin(theta);
    coords.push([x, y]);
  }
  coords.push(coords[0]); // Close the polygon

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
};

const NETWORK_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
];

// Signal range calculation (from ShadowCheckLite)
const calculateSignalRange = (
  signalDbm: number | null,
  frequencyMhz?: number | null,
  zoom: number = 10
): number => {
  if (!signalDbm || signalDbm === null) return 40;

  let freq = frequencyMhz;
  if (typeof freq === 'string') {
    freq = parseFloat((freq as any).replace(' GHz', '')) * 1000;
  }
  if (!freq || freq <= 0) freq = 2437; // Default to channel 6 (2.4GHz)

  // Signal strength to distance mapping (inverse relationship)
  // Stronger signal = closer = smaller circle, weaker signal = farther = larger circle
  let distanceM;
  if (signalDbm >= -30) distanceM = 15;
  else if (signalDbm >= -50) distanceM = 40;
  else if (signalDbm >= -60) distanceM = 80;
  else if (signalDbm >= -70) distanceM = 120;
  else if (signalDbm >= -80) distanceM = 180;
  else distanceM = 250;

  // Frequency adjustment (5GHz has shorter range)
  if (freq > 5000) distanceM *= 0.7;

  // Zoom-based scaling - make circle larger at higher zoom levels
  // At zoom 12, base scale is 1.0
  // At zoom 15, scale is ~2.0
  // At zoom 18, scale is ~4.0
  const zoomScale = Math.pow(1.25, zoom - 12);
  let radiusPixels = distanceM * Math.max(0.5, Math.min(zoomScale, 6));

  // Clamp radius for display - ensure minimum visibility
  return Math.max(20, Math.min(radiusPixels, 300));
};

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
  let saturation = 50 + (stringToHash(devicePart) % 41); // 50-90%
  let lightness = 40 + (stringToHash(devicePart) % 31); // 40-70%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const MAP_STYLES = [
  {
    value: 'mapbox://styles/mapbox/standard',
    label: 'Standard (Day)',
    config: { lightPreset: 'day' },
  },
  {
    value: 'mapbox://styles/mapbox/standard-dawn',
    label: 'Standard (Dawn)',
    config: { lightPreset: 'dawn' },
  },
  {
    value: 'mapbox://styles/mapbox/standard-dusk',
    label: 'Standard (Dusk)',
    config: { lightPreset: 'dusk' },
  },
  {
    value: 'mapbox://styles/mapbox/standard-night',
    label: 'Standard (Night)',
    config: { lightPreset: 'night' },
  },
  { value: 'mapbox://styles/mapbox/streets-v12', label: 'Streets' },
  { value: 'mapbox://styles/mapbox/outdoors-v12', label: 'Outdoors' },
  { value: 'mapbox://styles/mapbox/light-v11', label: 'Light' },
  { value: 'mapbox://styles/mapbox/dark-v11', label: 'Dark' },
  { value: 'mapbox://styles/mapbox/satellite-v9', label: 'Satellite' },
  { value: 'mapbox://styles/mapbox/satellite-streets-v12', label: 'Satellite Streets' },
  { value: 'mapbox://styles/mapbox/navigation-day-v1', label: 'Navigation Day' },
  { value: 'mapbox://styles/mapbox/navigation-night-v1', label: 'Navigation Night' },
  // Google Maps styles
  { value: 'google-roadmap', label: '🗺️ Google Roadmap', isGoogle: true },
  { value: 'google-satellite', label: '🛰️ Google Satellite', isGoogle: true },
  { value: 'google-hybrid', label: '🌐 Google Hybrid', isGoogle: true },
  { value: 'google-terrain', label: '⛰️ Google Terrain', isGoogle: true },
  // Google embedded views
  { value: 'google-street-view', label: '🚶 Google Street View', isGoogle: true },
  { value: 'google-earth', label: '🌍 Export to Google Earth', isGoogle: true },
] as const;

// Helper to create a Google Maps tile style for Mapbox GL
const createGoogleStyle = (type: string) => ({
  version: 8 as const,
  sources: {
    'google-tiles': {
      type: 'raster' as const,
      tiles: [`/api/google-maps-tile/${type}/{z}/{x}/{y}`],
      tileSize: 256,
      attribution: '© Google Maps',
    },
  },
  layers: [
    {
      id: 'google-tiles-layer',
      type: 'raster' as const,
      source: 'google-tiles',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
});

export default function GeospatialExplorer() {
  // Set current page for filter scoping
  usePageFilters('geospatial');

  // All state declarations first
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
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
        return JSON.parse(saved);
      } catch {
        // Fall through to default
      }
    }
    return Object.keys(NETWORK_COLUMNS).filter(
      (k) => NETWORK_COLUMNS[k as keyof typeof NETWORK_COLUMNS].default
    ) as (keyof NetworkRow | 'select')[];
  });
  const [sort, setSort] = useState<SortState[]>([{ column: 'lastSeen', direction: 'desc' }]);
  const [selectedNetworks, setSelectedNetworks] = useState<Set<string>>(new Set());
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [useObservationFilters, setUseObservationFilters] = useState(true);
  const [loadingNetworks, setLoadingNetworks] = useState(false);
  const [loadingObservations, setLoadingObservations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [observationsByBssid, setObservationsByBssid] = useState<Record<string, Observation[]>>({});
  const [observationsTotal, setObservationsTotal] = useState<number | null>(null);
  const [observationsTruncated, setObservationsTruncated] = useState(false);
  const [renderBudgetExceeded, setRenderBudgetExceeded] = useState(false);
  const [renderBudget, setRenderBudget] = useState<number | null>(null);
  const [expensiveSort, setExpensiveSort] = useState(false);
  const [networkTotal, setNetworkTotal] = useState<number | null>(null);
  const [networkTruncated, setNetworkTruncated] = useState(false);
  const [locationMode, setLocationMode] = useState('latest_observation');
  const [pagination, setPagination] = useState({ offset: 0, hasMore: true });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [homeButtonActive, setHomeButtonActive] = useState(false);
  const [fitButtonActive, setFitButtonActive] = useState(false);
  const [planCheck, setPlanCheck] = useState(false);
  const [homeLocation, setHomeLocation] = useState<{
    center: [number, number];
    radius: number;
  }>({ center: DEFAULT_CENTER, radius: DEFAULT_HOME_RADIUS });

  // Context menu state for network tagging
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    network: null,
    tag: null,
  });
  const [tagLoading, setTagLoading] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(() => {
    setPagination((prev) => ({ ...prev, offset: prev.offset + NETWORK_PAGE_LIMIT }));
  }, []);

  useFilterURLSync();
  const { getCurrentEnabled, setFilter } = useFilterStore();
  const enabled = getCurrentEnabled();
  const [debouncedFilterState, setDebouncedFilterState] = useState(() =>
    useFilterStore.getState().getAPIFilters()
  );
  useDebouncedFilters((payload) => setDebouncedFilterState(payload), 500);

  // Refs
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInitRef = useRef(false);
  const columnDropdownRef = useRef<HTMLDivElement | null>(null);
  const locationSearchRef = useRef<HTMLDivElement | null>(null);
  const searchMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Geocoding search function
  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim() || !mapboxgl.accessToken) return;

    setSearchingLocation(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&limit=5`
      );
      const data = await response.json();
      setSearchResults(data.features || []);
      setShowSearchResults(true);
    } catch (error) {
      logError('Geocoding error', error);
      setSearchResults([]);
    } finally {
      setSearchingLocation(false);
    }
  }, []);

  // Debounced location search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (locationSearch.trim()) {
        searchLocation(locationSearch);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [locationSearch, searchLocation]);

  // Persist visible columns to localStorage
  useEffect(() => {
    localStorage.setItem('shadowcheck_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Fetch home location from API
  useEffect(() => {
    const fetchHomeLocation = async () => {
      try {
        const response = await fetch('/api/home-location');
        if (response.ok) {
          const data = await response.json();
          if (data.latitude && data.longitude) {
            setHomeLocation({
              center: [data.longitude, data.latitude],
              radius: data.radius || DEFAULT_HOME_RADIUS,
            });
          }
        }
      } catch (error) {
        logError('Failed to fetch home location', error);
      }
    };
    fetchHomeLocation();
  }, []);

  // Click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationSearchRef.current && !locationSearchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fly to selected location
  const flyToLocation = useCallback((result: any) => {
    if (!mapRef.current) return;

    const [lng, lat] = result.center;

    // Remove existing search marker
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
    }

    // Add new marker
    searchMarkerRef.current = new mapboxgl.Marker({ color: '#3b82f6' })
      .setLngLat([lng, lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="color: #000; font-weight: 600;">${result.place_name}</div>`
        )
      )
      .addTo(mapRef.current);

    // Fly to location
    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: result.bbox ? undefined : 14,
      essential: true,
      duration: 2000,
    });

    // Fit to bbox if available
    if (result.bbox) {
      mapRef.current.fitBounds(result.bbox, {
        padding: 50,
        duration: 2000,
      });
    }

    setShowSearchResults(false);
    setLocationSearch('');
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setPagination({ offset: 0, hasMore: true });
    setNetworks([]);
  }, [JSON.stringify(debouncedFilterState), JSON.stringify(sort), locationMode]);

  // Update container height on window resize
  useEffect(() => {
    const updateHeight = () => {
      const height = window.innerHeight - 150; // More conservative padding for browser chrome
      setContainerHeight(height);
      setMapHeight(Math.floor(height * 0.75)); // Map takes 75% of available height (more space)
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Map-driven bounding box filter
  useEffect(() => {
    if (!mapReady || !mapRef.current || !enabled.boundingBox) return;

    const map = mapRef.current;
    const updateBounds = () => {
      const bounds = map.getBounds();
      setFilter('boundingBox', {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    };

    updateBounds();
    map.on('moveend', updateBounds);
    return () => {
      map.off('moveend', updateBounds);
    };
  }, [mapReady, enabled.boundingBox, setFilter]);

  // Update home location on map when it changes
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    // Update point source
    const pointSource = map.getSource('home-location-point') as mapboxgl.GeoJSONSource;
    if (pointSource) {
      pointSource.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: homeLocation.center,
            },
            properties: { title: 'Home' },
          },
        ],
      });
    }

    // Update circle source
    const circleSource = map.getSource('home-location-circle') as mapboxgl.GeoJSONSource;
    if (circleSource) {
      circleSource.setData({
        type: 'FeatureCollection',
        features: [createCirclePolygon(homeLocation.center, homeLocation.radius)],
      });
    }
  }, [mapReady, homeLocation]);

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
        attachMapOrientationControls(map, {
          scalePosition: 'bottom-right',
          scaleUnit: 'metric',
          ensureNavigation: false, // Already added above
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

            const popupHTML = `
              <div style="background: linear-gradient(145deg, #0f1419 0%, #1a1f2e 100%); color: #ffffff; border-radius: 12px; padding: 14px; box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 0 rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); font-size: 11px; line-height: 1.4; max-width: 280px; position: relative;">
                <div style="position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.5), transparent); border-radius: 16px 16px 0 0;"></div>
                <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
                  <span>${props.ssid || '(hidden)'}</span>
                  <span style="background: linear-gradient(135deg, ${bssidColor}55, ${bssidColor}22); border: 2px solid ${bssidColor}; border-radius: 10px; padding: 4px 10px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; color: #f8fafc; box-shadow: 0 0 12px ${bssidColor}33;">
                    Observation #${props.number}
                  </span>
                </div>

                <div style="margin-bottom: 3px; color: #d1d5db; display: flex; justify-content: space-between; font-size: 10.5px;">
                  <span style="color: #9ca3af; font-weight: 500;">MAC</span>
                  <span style="font-family: monospace; color: ${bssidColor}; font-weight: 600;">${props.bssid}</span>
                </div>
                <div style="margin-bottom: 3px; color: #d1d5db; display: flex; justify-content: space-between; font-size: 10.5px;">
                  <span style="color: #9ca3af; font-weight: 500;">Manufacturer</span>
                  <span style="font-family: monospace; color: #f3f4f6; font-weight: 500;">${props.manufacturer || 'Unknown'}</span>
                </div>
                <div style="margin-bottom: 3px; color: #d1d5db; display: flex; justify-content: space-between; font-size: 10.5px;">
                  <span style="color: #9ca3af; font-weight: 500;">Frequency</span>
                  <span style="font-family: monospace; color: #f3f4f6; font-weight: 500;">${formatFrequency(props.frequency)}</span>
                </div>
                <div style="margin-bottom: 3px; color: #d1d5db; display: flex; justify-content: space-between; font-size: 10.5px;">
                  <span style="color: #9ca3af; font-weight: 500;">Signal</span>
                  <span style="font-family: monospace; font-weight: 600; color: ${signalClass === 'signal-strong' ? '#10b981' : signalClass === 'signal-medium' ? '#f59e0b' : '#ef4444'};">
                    ${props.signal ? `${props.signal} dBm` : 'N/A'}
                  </span>
                </div>
                <div style="margin-bottom: 3px; color: #d1d5db; display: flex; justify-content: space-between; font-size: 10.5px;">
                  <span style="color: #9ca3af; font-weight: 500;">Encryption</span>
                  <span style="font-family: monospace; color: #f3f4f6; font-weight: 500;">${props.security || 'Unknown'}</span>
                </div>
                <div style="margin-bottom: 3px; color: #d1d5db; display: flex; justify-content: space-between; font-size: 10.5px;">
                  <span style="color: #9ca3af; font-weight: 500;">Threat Level</span>
                  <span style="font-family: monospace; color: ${threatColor}; font-weight: 600;">${threatLevel}</span>
                </div>

                <div style="margin: 10px 0; padding: 8px; background: rgba(99, 102, 241, 0.05); border-radius: 6px; border: 1px solid rgba(99, 102, 241, 0.15);">
                  <div style="display: flex; justify-content: space-between; font-size: 10px;">
                    <span style="color: #9ca3af;">Latitude</span>
                    <span style="color: #e5e7eb; font-weight: 600;">${feature.geometry.coordinates[1].toFixed(4)}°</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 10px;">
                    <span style="color: #9ca3af;">Longitude</span>
                    <span style="color: #e5e7eb; font-weight: 600;">${feature.geometry.coordinates[0].toFixed(4)}°</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 10px;">
                    <span style="color: #9ca3af;">Altitude</span>
                    <span style="color: #e5e7eb; font-weight: 600;">${props.altitude != null ? `${props.altitude.toFixed(0)} m` : 'N/A'}</span>
                  </div>
                </div>

                <div style="margin-top: 10px; padding: 10px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.2);">
                  <div style="display: flex; flex-direction: column; gap: 4px; font-size: 10px;">
                    ${props.time ? `<div style="display: flex; justify-content: space-between; padding-bottom: 6px; margin-bottom: 6px; border-bottom: 1px solid rgba(139, 92, 246, 0.15);"><span style="color: #a78bfa; font-weight: 600;">Observed</span><span style="color: #e9d5ff; font-weight: 700;">${new Date(props.time).toLocaleString()}</span></div>` : ''}
                    ${props.first_seen ? `<div style="display: flex; justify-content: space-between;"><span style="color: #9ca3af;">First</span><span style="color: #c4b5fd; font-weight: 600;">${new Date(props.first_seen).toLocaleString()}</span></div>` : ''}
                    ${props.last_seen ? `<div style="display: flex; justify-content: space-between;"><span style="color: #9ca3af;">Last</span><span style="color: #c4b5fd; font-weight: 600;">${new Date(props.last_seen).toLocaleString()}</span></div>` : ''}
                  </div>
                  <div style="padding-top: 6px; border-top: 1px solid rgba(139, 92, 246, 0.2); text-align: center; font-size: 11px; font-weight: 600; color: #a78bfa; letter-spacing: 0.3px; margin-top: 6px;">
                    <span style="font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.8px; display: block; margin-bottom: 2px;">Timespan</span>
                    ${timespanText}
                  </div>
                </div>
              </div>
            `;

            new mapboxgl.Popup({ offset: 15, className: 'sc-popup' })
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
            const hoverCircleSource = map.getSource('hover-circle') as mapboxgl.GeoJSONSource;
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
            const hoverCircleSource = map.getSource('hover-circle') as mapboxgl.GeoJSONSource;
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

            const hoverCircleSource = map.getSource('hover-circle') as mapboxgl.GeoJSONSource;
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

  const formatSecurity = (capabilities: string | null | undefined, fallback?: string | null) => {
    const value = String(capabilities || '').toUpperCase();
    if (!value || value === 'UNKNOWN') {
      return fallback || 'Open';
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
    return fallback || 'Open';
  };

  // Fetch networks
  useEffect(() => {
    const controller = new AbortController();
    const fetchNetworks = async () => {
      // Remove the loadingNetworks guard that was preventing initial fetch
      setLoadingNetworks(true);
      setError(null);
      setExpensiveSort(false);
      try {
        const sortKeys = sort
          .map((entry) => API_SORT_MAP[entry.column])
          .filter((value): value is string => Boolean(value));
        if (sortKeys.length !== sort.length) {
          setError('One or more sort columns are not supported by the API.');
          setLoadingNetworks(false);
          return;
        }

        const params = new URLSearchParams({
          limit: String(NETWORK_PAGE_LIMIT),
          offset: String(pagination.offset),
          sort: sortKeys.join(','),
          order: sort.map((entry) => entry.direction.toUpperCase()).join(','),
        });
        params.set('location_mode', locationMode);

        if (planCheck) {
          params.set('planCheck', '1');
        }

        const { filters, enabled } = debouncedFilterState;
        if (enabled.ssid && filters.ssid) {
          params.set('ssid', String(filters.ssid));
        }
        if (enabled.bssid && filters.bssid) {
          params.set('bssid', String(filters.bssid));
        }
        if (
          enabled.radioTypes &&
          Array.isArray(filters.radioTypes) &&
          filters.radioTypes.length > 0
        ) {
          params.set('radioTypes', filters.radioTypes.join(','));
        }
        if (
          enabled.encryptionTypes &&
          Array.isArray(filters.encryptionTypes) &&
          filters.encryptionTypes.length > 0
        ) {
          params.set('encryptionTypes', filters.encryptionTypes.join(','));
        }
        if (enabled.rssiMin && filters.rssiMin !== undefined) {
          params.set('min_signal', String(filters.rssiMin));
        }
        if (enabled.rssiMax && filters.rssiMax !== undefined) {
          params.set('max_signal', String(filters.rssiMax));
        }
        if (enabled.observationCountMin && filters.observationCountMin !== undefined) {
          params.set('min_obs_count', String(filters.observationCountMin));
        }
        if (enabled.observationCountMax && filters.observationCountMax !== undefined) {
          params.set('max_obs_count', String(filters.observationCountMax));
        }
        if (
          enabled.threatCategories &&
          Array.isArray(filters.threatCategories) &&
          filters.threatCategories.length > 0
        ) {
          params.set('threat_categories', JSON.stringify(filters.threatCategories));
        }
        const toFiniteNumber = (value: unknown) => {
          const parsed = typeof value === 'number' ? value : Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        };

        const maxDistance = toFiniteNumber(filters.distanceFromHomeMax);
        if (enabled.distanceFromHomeMax && maxDistance !== null) {
          params.set('distance_from_home_km_max', String(maxDistance / 1000));
        }
        const minDistance = toFiniteNumber(filters.distanceFromHomeMin);
        if (enabled.distanceFromHomeMin && minDistance !== null) {
          params.set('distance_from_home_km_min', String(minDistance / 1000));
        }

        // Bounding box filter
        if (enabled.boundingBox && filters.boundingBox) {
          const { north, south, east, west } = filters.boundingBox;
          const minLat = toFiniteNumber(south);
          const maxLat = toFiniteNumber(north);
          const minLng = toFiniteNumber(west);
          const maxLng = toFiniteNumber(east);

          if (
            minLat !== null &&
            maxLat !== null &&
            minLng !== null &&
            maxLng !== null &&
            minLat >= -90 &&
            maxLat <= 90 &&
            minLat <= maxLat &&
            minLng >= -180 &&
            maxLng <= 180 &&
            minLng <= maxLng
          ) {
            params.set('bbox_min_lat', String(minLat));
            params.set('bbox_max_lat', String(maxLat));
            params.set('bbox_min_lng', String(minLng));
            params.set('bbox_max_lng', String(maxLng));
          }
        }

        // Radius filter
        if (enabled.radiusFilter && filters.radiusFilter) {
          const { latitude, longitude, radiusMeters } = filters.radiusFilter;
          const centerLat = toFiniteNumber(latitude);
          const centerLng = toFiniteNumber(longitude);
          const radius = toFiniteNumber(radiusMeters);

          if (
            centerLat !== null &&
            centerLng !== null &&
            radius !== null &&
            centerLat >= -90 &&
            centerLat <= 90 &&
            centerLng >= -180 &&
            centerLng <= 180 &&
            radius > 0
          ) {
            params.set('radius_center_lat', String(centerLat));
            params.set('radius_center_lng', String(centerLng));
            params.set('radius_meters', String(radius));
          }
        }

        const liveState = useFilterStore.getState().getAPIFilters();
        const liveMaxDistance = toFiniteNumber(liveState.filters.distanceFromHomeMax);
        if (liveState.enabled.distanceFromHomeMax && liveMaxDistance !== null) {
          params.set('distance_from_home_km_max', String(liveMaxDistance / 1000));
        }
        const liveMinDistance = toFiniteNumber(liveState.filters.distanceFromHomeMin);
        if (liveState.enabled.distanceFromHomeMin && liveMinDistance !== null) {
          params.set('distance_from_home_km_min', String(liveMinDistance / 1000));
        }
        if (enabled.timeframe && filters.timeframe?.type === 'relative') {
          const window = filters.timeframe.relativeWindow || '30d';
          const unit = window.slice(-1);
          const value = parseInt(window.slice(0, -1), 10);
          if (!Number.isNaN(value)) {
            const ms =
              unit === 'h' ? value * 3600000 : unit === 'm' ? value * 60000 : value * 86400000;
            const since = new Date(Date.now() - ms).toISOString();
            params.set('last_seen', since);
          }
        }

        const res = await fetch(`/api/networks?${params.toString()}`, {
          signal: controller.signal,
        });
        logDebug(`Networks response status: ${res.status}`);
        if (!res.ok) throw new Error(`networks ${res.status}`);
        const data = await res.json();
        const rows = data.networks || [];
        setExpensiveSort(Boolean(data.expensive_sort));
        setNetworkTotal(typeof data.total === 'number' ? data.total : null);
        setNetworkTruncated(Boolean(data.truncated));

        const mapped: NetworkRow[] = rows.map((row: any, idx: number) => {
          const securityValue = formatSecurity(row.capabilities, row.security);
          const bssidValue = (row.bssid || `unknown-${idx}`).toString().toUpperCase();

          // Calculate WiFi channel from frequency
          const calculateChannel = (freq: number | null): number | null => {
            if (!freq || typeof freq !== 'number') return null;

            // 2.4GHz channels (1-14)
            if (freq >= 2412 && freq <= 2484) {
              if (freq === 2484) return 14; // Channel 14
              return Math.floor((freq - 2412) / 5) + 1;
            }

            // 5GHz channels
            if (freq >= 5000 && freq <= 5900) {
              return Math.floor((freq - 5000) / 5);
            }

            // 6GHz channels
            if (freq >= 5925 && freq <= 7125) {
              return Math.floor((freq - 5925) / 5);
            }

            return null; // Non-WiFi frequencies don't have channels
          };

          // Fallback type inference if database returns null/unknown
          const inferNetworkType = (
            dbType: string | null,
            frequency: number | null,
            ssid: string | null,
            capabilities: string | null
          ): NetworkRow['type'] => {
            // If database provided a valid type, use it
            if (dbType && dbType !== '?' && dbType !== 'Unknown' && dbType !== null) {
              return dbType as NetworkRow['type'];
            }

            const ssidUpper = String(ssid || '').toUpperCase();
            const capUpper = String(capabilities || '').toUpperCase();

            // Frequency-based inference (most reliable)
            if (frequency) {
              if (frequency >= 2412 && frequency <= 2484) return 'W'; // 2.4GHz WiFi
              if (frequency >= 5000 && frequency <= 5900) return 'W'; // 5GHz WiFi
              if (frequency >= 5925 && frequency <= 7125) return 'W'; // 6GHz WiFi
            }

            // Capability-based inference
            if (
              capUpper.includes('WPA') ||
              capUpper.includes('WEP') ||
              capUpper.includes('WPS') ||
              capUpper.includes('RSN') ||
              capUpper.includes('ESS') ||
              capUpper.includes('CCMP') ||
              capUpper.includes('TKIP')
            ) {
              return 'W';
            }

            // SSID-based inference
            if (ssidUpper.includes('5G') || capUpper.includes('NR')) return 'N';
            if (ssidUpper.includes('LTE') || ssidUpper.includes('4G')) return 'L';
            if (ssidUpper.includes('BLUETOOTH') || capUpper.includes('BLUETOOTH')) {
              if (capUpper.includes('LOW ENERGY') || capUpper.includes('BLE')) return 'E';
              return 'B';
            }

            return '?';
          };

          const frequency = typeof row.frequency === 'number' ? row.frequency : null;
          const networkType = inferNetworkType(row.type, frequency, row.ssid, row.capabilities);
          const isWiFi = networkType === 'W';

          // Calculate timespan in days
          const calculateTimespan = (first: string | null, last: string | null): number | null => {
            if (!first || !last) return null;
            const firstDate = new Date(first);
            const lastDate = new Date(last);
            if (isNaN(firstDate.getTime()) || isNaN(lastDate.getTime())) return null;
            const diffMs = lastDate.getTime() - firstDate.getTime();
            return Math.round(diffMs / (1000 * 60 * 60 * 24)); // Convert to days
          };

          // Parse threat info - handles both old boolean format and new JSONB format
          let threatInfo: ThreatInfo | null = null;
          if (row.threat === true) {
            // Old format: boolean true means HIGH threat
            threatInfo = {
              score: 1,
              level: 'HIGH',
              summary: 'Signal above threat threshold',
            };
          } else if (row.threat && typeof row.threat === 'object') {
            // New format: JSONB object with score, level, summary, etc.
            const t = row.threat as { score?: number; level?: string; summary?: string };
            if (t.level && t.level !== 'NONE') {
              threatInfo = {
                score: typeof t.score === 'number' ? t.score / 100 : 0.5, // Normalize 0-100 to 0-1
                level: t.level as 'HIGH' | 'MED' | 'LOW',
                summary: t.summary || `Threat level: ${t.level}`,
              };
            }
          }

          const channelValue =
            typeof row.channel === 'number'
              ? row.channel
              : isWiFi
                ? calculateChannel(frequency)
                : null;

          return {
            bssid: bssidValue,
            ssid: row.ssid || '(hidden)',
            type: networkType,
            signal: typeof row.signal === 'number' ? row.signal : null,
            security: securityValue,
            frequency: frequency,
            channel: channelValue, // Only show channels for WiFi
            observations: parseInt(String(row.obs_count || 0), 10),
            latitude: typeof row.lat === 'number' ? row.lat : null,
            longitude: typeof row.lon === 'number' ? row.lon : null,
            distanceFromHome:
              typeof row.distance_from_home_km === 'number' ? row.distance_from_home_km : null,
            accuracy: typeof row.accuracy_meters === 'number' ? row.accuracy_meters : null,
            firstSeen: row.first_observed_at || null,
            lastSeen: row.last_observed_at || row.observed_at || null,
            timespanDays: calculateTimespan(row.first_observed_at, row.last_observed_at),
            threat: threatInfo,
            threatReasons: [],
            threatEvidence: [],
            stationaryConfidence:
              typeof row.stationary_confidence === 'number' ? row.stationary_confidence : null,
            // Enrichment fields (networks-v2 API)
            manufacturer: row.manufacturer || null,
            min_altitude_m: typeof row.min_altitude_m === 'number' ? row.min_altitude_m : null,
            max_altitude_m: typeof row.max_altitude_m === 'number' ? row.max_altitude_m : null,
            altitude_span_m: typeof row.altitude_span_m === 'number' ? row.altitude_span_m : null,
            max_distance_meters:
              typeof row.max_distance_meters === 'number' ? row.max_distance_meters : null,
            last_altitude_m: typeof row.last_altitude_m === 'number' ? row.last_altitude_m : null,
            is_sentinel: typeof row.is_sentinel === 'boolean' ? row.is_sentinel : null,
            rawLatitude:
              typeof row.raw_lat === 'number'
                ? row.raw_lat
                : typeof row.lat === 'number'
                  ? row.lat
                  : null,
            rawLongitude:
              typeof row.raw_lon === 'number'
                ? row.raw_lon
                : typeof row.lon === 'number'
                  ? row.lon
                  : null,
          };
        });

        // CRITICAL: Reset networks on page 1, append on subsequent pages
        if (pagination.offset === 0) {
          setNetworks(mapped);
        } else {
          setNetworks((prev) => [...prev, ...mapped]);
        }

        setPagination((prev) => ({
          ...prev,
          hasMore: mapped.length === NETWORK_PAGE_LIMIT,
        }));
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setLoadingNetworks(false);
      }
    };

    fetchNetworks();
    return () => controller.abort();
  }, [
    pagination.offset,
    JSON.stringify(debouncedFilterState),
    JSON.stringify(sort),
    planCheck,
    locationMode,
  ]);

  // Infinite scroll with scroll position preservation
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container || !pagination.hasMore || isLoadingMore) return;

    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        if (scrollHeight - scrollTop <= clientHeight + 200) {
          // Trigger earlier
          const currentScrollTop = scrollTop; // Save scroll position
          setIsLoadingMore(true);
          loadMore();

          // Restore scroll position after a brief delay
          setTimeout(() => {
            if (container.scrollTop !== currentScrollTop) {
              container.scrollTop = currentScrollTop;
            }
          }, 50);
        }
      }, 100); // Reduced debounce time
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [pagination.hasMore, isLoadingMore]);

  // Reset loading state after fetch
  useEffect(() => {
    if (!loadingNetworks && isLoadingMore) {
      setIsLoadingMore(false);
    }
  }, [loadingNetworks, isLoadingMore]);

  // Fetch observations for selected networks (filtered)
  useEffect(() => {
    const controller = new AbortController();
    const fetchObservations = async () => {
      if (!selectedNetworks.size) {
        setObservationsByBssid({});
        setObservationsTotal(null);
        setObservationsTruncated(false);
        setRenderBudgetExceeded(false);
        setRenderBudget(null);
        return;
      }

      setLoadingObservations(true);
      setError(null);
      try {
        const selectedBssids = Array.from(selectedNetworks);
        const limit = 20000;
        let offset = 0;
        let total: number | null = null;
        let truncated = false;
        let renderBudgetLimit: number | null = null;
        let allRows: any[] = [];
        const observationFilters = useObservationFilters
          ? debouncedFilterState
          : { filters: {}, enabled: {} };

        while (true) {
          const params = new URLSearchParams({
            filters: JSON.stringify(observationFilters.filters),
            enabled: JSON.stringify(observationFilters.enabled),
            bssids: JSON.stringify(selectedBssids),
            limit: String(limit),
            offset: String(offset),
          });
          if (offset === 0) {
            params.set('include_total', '1');
          }

          const res = await fetch(`/api/v2/networks/filtered/observations?${params.toString()}`, {
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(`observations ${res.status}`);
          const data = await res.json();
          const rows = data.data || [];
          allRows = allRows.concat(rows);
          if (offset === 0 && typeof data.total === 'number') {
            total = data.total;
          }
          if (offset === 0 && typeof data.render_budget === 'number') {
            renderBudgetLimit = data.render_budget;
          }

          if (!data.truncated || rows.length === 0) {
            truncated = Boolean(data.truncated);
            break;
          }

          offset += limit;
          if (renderBudgetLimit !== null && allRows.length >= renderBudgetLimit) {
            truncated = true;
            break;
          }
          if (total !== null && allRows.length >= total) {
            truncated = false;
            break;
          }
          if (controller.signal.aborted) {
            return;
          }
        }

        const grouped = allRows.reduce((acc: Record<string, Observation[]>, row: any) => {
          const bssid = String(row.bssid || '').toUpperCase();
          const lat = typeof row.lat === 'number' ? row.lat : parseFloat(row.lat);
          const lon = typeof row.lon === 'number' ? row.lon : parseFloat(row.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return acc;
          }
          if (!acc[bssid]) acc[bssid] = [];
          acc[bssid].push({
            id: row.obs_number || `${bssid}-${row.time}`,
            bssid,
            lat,
            lon,
            signal: typeof row.level === 'number' ? row.level : (row.level ?? null),
            time: row.time,
            frequency: typeof row.radio_frequency === 'number' ? row.radio_frequency : null,
            acc: row.accuracy ?? null,
            altitude: typeof row.altitude === 'number' ? row.altitude : null,
          });
          return acc;
        }, {});

        setObservationsByBssid(grouped);
        setObservationsTotal(total);
        setObservationsTruncated(truncated || (total !== null && allRows.length < total));
        setRenderBudgetExceeded(Boolean(data.render_budget_exceeded));
        setRenderBudget(typeof data.render_budget === 'number' ? data.render_budget : null);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setLoadingObservations(false);
      }
    };

    fetchObservations();
    return () => {
      controller.abort();
    };
  }, [selectedNetworks, JSON.stringify(debouncedFilterState), useObservationFilters]);

  // Server-side sorting - no client-side sorting needed
  const filteredNetworks = useMemo(() => networks, [networks]);

  const handleColumnSort = (column: keyof NetworkRow, _shiftKey: boolean) => {
    if (!NETWORK_COLUMNS[column].sortable) return;
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

    // Fetch current tag state for this network
    try {
      const response = await fetch(`/api/network-tags/${encodeURIComponent(network.bssid)}`);
      const tag = await response.json();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        network,
        tag,
      });
    } catch (err) {
      logError('Failed to fetch network tag', err);
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        network,
        tag: {
          bssid: network.bssid,
          is_ignored: false,
          ignore_reason: null,
          threat_tag: null,
          notes: null,
          exists: false,
        },
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

  // Update map observations when selection changes
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;

    // Assign colors to each selected network using BSSID-based algorithm
    const bssidColors: Record<string, string> = {};
    activeObservationSets.forEach((set, index) => {
      bssidColors[set.bssid] = macColor(set.bssid); // Use BSSID-based color instead of fixed colors
    });

    // Create numbered point features for each observation (numbered per network)
    const jitterIndex = new Map<string, number>();
    const features = activeObservationSets.flatMap((set) =>
      set.observations.map((obs, index) => {
        const network = networkLookup.get(obs.bssid);
        const threatLevel = network?.threat?.level ?? 'NONE';
        const lat = obs.lat;
        const lon = obs.lon;
        const coordKey = `${lat.toFixed(6)}:${lon.toFixed(6)}`;
        const seenCount = jitterIndex.get(coordKey) ?? 0;
        jitterIndex.set(coordKey, seenCount + 1);
        let displayLat = lat;
        let displayLon = lon;
        if (seenCount > 0) {
          const angle = seenCount * 2.399963229728653; // golden angle in radians
          const radius = Math.min(0.00015, 0.00002 * Math.sqrt(seenCount));
          displayLat = lat + Math.sin(angle) * radius;
          displayLon = lon + Math.cos(angle) * radius;
        }

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [displayLon, displayLat],
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
            timespan_days: typeof network?.timespanDays === 'number' ? network.timespanDays : null,
            type: network?.type || null,
            number: index + 1, // Start at 1 for each network
            color: bssidColors[obs.bssid],
          },
        };
      })
    );

    // Create line features connecting observations for each network
    const lineFeatures = activeObservationSets
      .filter((set) => set.observations.length > 1)
      .map((set) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: set.observations.map((obs) => [obs.lon, obs.lat]),
        },
        properties: {
          bssid: set.bssid,
          color: bssidColors[set.bssid],
        },
      }));

    if (map.getSource('observations')) {
      (map.getSource('observations') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: features as any,
      });
    }

    if (map.getSource('observation-lines')) {
      (map.getSource('observation-lines') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: lineFeatures as any,
      });
    }

    // Auto-zoom to fit bounds of all observations
    if (features.length > 0) {
      const coords = features.map((f: any) => f.geometry.coordinates as [number, number]);
      const bounds = coords.reduce(
        (bounds, coord) => bounds.extend(coord),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 50, duration: 1000 });
    }
  }, [activeObservationSets, mapReady, networkLookup]);

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
          (mapRef.current.getSource('observations') as mapboxgl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: features as any,
          });
        }
      }
    });
  };

  // 3D Buildings toggle
  const toggle3DBuildings = (enabled: boolean) => {
    if (!mapRef.current) return;

    if (enabled) {
      add3DBuildings();
    } else {
      if (mapRef.current.getLayer('3d-buildings')) {
        mapRef.current.removeLayer('3d-buildings');
      }
    }
    localStorage.setItem('shadowcheck_show_3d_buildings', String(enabled));
    setShow3DBuildings(enabled);
  };

  const add3DBuildings = () => {
    if (!mapRef.current || mapRef.current.getLayer('3d-buildings')) return;

    const layers = mapRef.current.getStyle().layers;
    const labelLayerId = layers?.find(
      (layer: any) => layer.type === 'symbol' && layer.layout?.['text-field']
    )?.id;

    mapRef.current.addLayer(
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
      } as any,
      labelLayerId
    );
  };

  // Terrain toggle
  const toggleTerrain = (enabled: boolean) => {
    if (!mapRef.current) return;

    if (enabled) {
      addTerrain();
    } else {
      mapRef.current.setTerrain(null);
      if (mapRef.current.getSource('mapbox-dem')) {
        mapRef.current.removeSource('mapbox-dem');
      }
    }
    localStorage.setItem('shadowcheck_show_terrain', String(enabled));
    setShowTerrain(enabled);
  };

  const addTerrain = () => {
    if (!mapRef.current || mapRef.current.getSource('mapbox-dem')) return;

    mapRef.current.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14,
    });

    mapRef.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
  };

  return (
    <div
      className="relative w-full min-h-screen overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at 20% 20%, rgba(52, 211, 153, 0.06), transparent 25%), radial-gradient(circle at 80% 0%, rgba(59, 130, 246, 0.06), transparent 20%), linear-gradient(135deg, #0a1525 0%, #0d1c31 40%, #0a1424 100%)',
      }}
    >
      {filtersOpen && (
        <div
          style={{
            position: 'absolute',
            top: '52px',
            left: '12px',
            bottom: '12px',
            width: '320px',
            zIndex: 55,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              padding: '10px',
              borderRadius: '10px',
              border: '1px solid rgba(71, 85, 105, 0.4)',
              background: 'rgba(15, 23, 42, 0.9)',
              color: '#e2e8f0',
              fontSize: '12px',
            }}
          >
            <FilterPanel density="compact" />
          </div>
        </div>
      )}
      <div className="flex h-screen">
        <div
          className="flex flex-col gap-3 p-3 h-screen flex-1"
          style={{ marginLeft: filtersOpen ? '332px' : 0 }}
        >
          {/* Map Card */}
          <div
            className="overflow-hidden"
            style={{
              height: `${mapHeight}px`,
              background: 'rgba(30, 41, 59, 0.4)',
              borderRadius: '12px',
              border: '1px solid rgba(71, 85, 105, 0.3)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '12px 12px 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <h2
                style={{
                  fontSize: '22px',
                  fontWeight: '900',
                  margin: 0,
                  background: 'linear-gradient(to right, #1e293b, #64748b, #475569, #1e293b)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter:
                    'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 20px rgba(100, 116, 139, 0.3))',
                  letterSpacing: '-0.5px',
                }}
              >
                ShadowCheck Geospatial Intelligence
              </h2>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11px',
                  flexWrap: 'wrap',
                }}
              >
                {/* Location Search */}
                <div ref={locationSearchRef} style={{ position: 'relative', minWidth: '300px' }}>
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    placeholder="🔍 Search worldwide locations..."
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '11px',
                      background: 'rgba(30, 41, 59, 0.9)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '4px',
                      color: '#f1f5f9',
                      outline: 'none',
                    }}
                    onFocus={() => {
                      if (searchResults.length > 0) {
                        setShowSearchResults(true);
                      }
                    }}
                  />
                  {searchingLocation && (
                    <div
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#60a5fa',
                        fontSize: '10px',
                      }}
                    >
                      ⏳
                    </div>
                  )}
                  {showSearchResults && searchResults.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        background: 'rgba(30, 41, 59, 0.98)',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        borderRadius: '6px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                        zIndex: 1000,
                      }}
                    >
                      {searchResults.map((result, index) => (
                        <div
                          key={index}
                          onClick={() => flyToLocation(result)}
                          style={{
                            padding: '8px 10px',
                            cursor: 'pointer',
                            borderBottom:
                              index < searchResults.length - 1
                                ? '1px solid rgba(148, 163, 184, 0.1)'
                                : 'none',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <div style={{ fontSize: '12px', fontWeight: '600', color: '#f1f5f9' }}>
                            {result.text}
                          </div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                            {result.place_name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <select
                  value={mapStyle}
                  onChange={(e) => changeMapStyle(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    background: 'rgba(30, 41, 59, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    color: '#f8fafc',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {MAP_STYLES.map((style) => (
                    <option key={style.value} value={style.value}>
                      {style.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => toggle3DBuildings(!show3DBuildings)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    background: show3DBuildings
                      ? 'rgba(59, 130, 246, 0.2)'
                      : 'rgba(30, 41, 59, 0.9)',
                    border: show3DBuildings
                      ? '1px solid rgba(59, 130, 246, 0.5)'
                      : '1px solid rgba(148, 163, 184, 0.2)',
                    color: show3DBuildings ? '#60a5fa' : '#cbd5e1',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontWeight: show3DBuildings ? '600' : '400',
                  }}
                >
                  🏢 3D Buildings
                </button>
                <button
                  onClick={() => toggleTerrain(!showTerrain)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    background: showTerrain ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.9)',
                    border: showTerrain
                      ? '1px solid rgba(59, 130, 246, 0.5)'
                      : '1px solid rgba(148, 163, 184, 0.2)',
                    color: showTerrain ? '#60a5fa' : '#cbd5e1',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontWeight: showTerrain ? '600' : '400',
                  }}
                >
                  ⛰️ Terrain
                </button>
                <button
                  onClick={() => {
                    if (!mapRef.current || activeObservationSets.length === 0) return;
                    setFitButtonActive(true);
                    const allCoords = activeObservationSets.flatMap((set) =>
                      set.observations.map((obs) => [obs.lon, obs.lat] as [number, number])
                    );
                    if (allCoords.length === 0) return;
                    const bounds = allCoords.reduce(
                      (bounds, coord) => bounds.extend(coord),
                      new mapboxgl.LngLatBounds(allCoords[0], allCoords[0])
                    );
                    mapRef.current.fitBounds(bounds, { padding: 50 });
                    setTimeout(() => setFitButtonActive(false), 2000); // Light up for 2 seconds
                  }}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    background:
                      fitButtonActive || selectedNetworks.size > 0
                        ? 'rgba(59, 130, 246, 0.9)'
                        : 'rgba(30, 41, 59, 0.9)',
                    border:
                      fitButtonActive || selectedNetworks.size > 0
                        ? '1px solid #3b82f6'
                        : '1px solid rgba(148, 163, 184, 0.2)',
                    color: fitButtonActive || selectedNetworks.size > 0 ? '#ffffff' : '#cbd5e1',
                    borderRadius: '4px',
                    cursor: selectedNetworks.size > 0 ? 'pointer' : 'not-allowed',
                    opacity: selectedNetworks.size > 0 ? 1 : 0.5,
                  }}
                  disabled={selectedNetworks.size === 0}
                >
                  🎯 Fit
                </button>
                <button
                  onClick={() => {
                    if (!mapRef.current) return;
                    setHomeButtonActive(true);
                    mapRef.current.flyTo({ center: homeLocation.center, zoom: 17 }); // Higher zoom ~100-200m up
                    setTimeout(() => setHomeButtonActive(false), 2000); // Light up for 2 seconds
                  }}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    background: homeButtonActive
                      ? 'rgba(16, 185, 129, 0.9)'
                      : 'rgba(30, 41, 59, 0.9)',
                    border: homeButtonActive
                      ? '1px solid #10b981'
                      : '1px solid rgba(148, 163, 184, 0.2)',
                    color: homeButtonActive ? '#ffffff' : '#cbd5e1',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                >
                  🏠 Home
                </button>
                <button
                  onClick={() => {
                    if (!mapRef.current) return;
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        mapRef.current?.flyTo({
                          center: [position.coords.longitude, position.coords.latitude],
                          zoom: 15,
                        });
                      },
                      (error) => {
                        logError('Geolocation error', error);
                        alert('Unable to get your location. Please enable location services.');
                      }
                    );
                  }}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    background: 'rgba(30, 41, 59, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    color: '#cbd5e1',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  📍 GPS
                </button>
              </div>
            </div>

            <div className="relative" style={{ height: 'calc(100% - 49px)' }}>
              {!mapReady && !mapError && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ color: '#cbd5e1', background: 'rgba(30, 41, 59, 0.8)' }}
                >
                  Loading map...
                </div>
              )}
              {mapError && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ color: '#f87171', background: 'rgba(30, 41, 59, 0.8)' }}
                >
                  {mapError}
                </div>
              )}

              {/* Embedded Google Street View */}
              {embeddedView === 'street-view' && mapRef.current && (
                <iframe
                  src={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${mapRef.current.getCenter().lat},${mapRef.current.getCenter().lng}`}
                  className="w-full h-full"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              )}

              <div
                ref={mapContainerRef}
                className="w-full h-full"
                style={{
                  background: 'rgba(30, 41, 59, 0.8)',
                  display: embeddedView ? 'none' : 'block',
                }}
              />
            </div>
          </div>

          {/* Resize Handle */}
          <div
            className="cursor-row-resize hover:bg-blue-500/20 transition-colors flex items-center justify-center"
            style={{
              height: '8px',
              background: 'rgba(71, 85, 105, 0.3)',
              borderRadius: '4px',
              userSelect: 'none',
            }}
            onMouseDown={handleMouseDown}
          >
            <div
              style={{
                width: '24px',
                height: '2px',
                background: 'rgba(148, 163, 184, 0.6)',
                borderRadius: '1px',
              }}
            ></div>
          </div>

          {/* Networks Explorer Card */}
          <div
            className="flex-1 flex flex-col overflow-hidden min-h-0"
            style={{
              background: 'rgba(30, 41, 59, 0.4)',
              borderRadius: '12px',
              border: '1px solid rgba(71, 85, 105, 0.3)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '12px 12px 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f5f9', margin: 0 }}>
                Networks Explorer
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Filters apply across list + map.
                </span>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    color: '#cbd5e1',
                    padding: '4px 6px',
                    borderRadius: '6px',
                    border: '1px solid rgba(71, 85, 105, 0.4)',
                    background: 'rgba(15, 23, 42, 0.6)',
                  }}
                  title="Filters apply to both network list and observations on map"
                >
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    style={{ cursor: 'not-allowed' }}
                  />
                  Filters apply to list + map
                </label>
                {expensiveSort && (
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#fbbf24',
                      border: '1px solid rgba(251, 191, 36, 0.4)',
                      padding: '2px 6px',
                      borderRadius: '999px',
                      background: 'rgba(120, 53, 15, 0.3)',
                    }}
                  >
                    Expensive sort
                  </span>
                )}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    color: '#cbd5e1',
                    padding: '4px 6px',
                    borderRadius: '6px',
                    border: '1px solid rgba(71, 85, 105, 0.4)',
                    background: 'rgba(15, 23, 42, 0.6)',
                  }}
                  title="Adds planCheck=1 so the backend logs the query plan for debugging"
                >
                  <input
                    type="checkbox"
                    checked={planCheck}
                    onChange={(e) => setPlanCheck(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  PlanCheck (debug)
                </label>
                <select
                  value={locationMode}
                  onChange={(e) => setLocationMode(e.target.value)}
                  style={{
                    padding: '4px 6px',
                    fontSize: '11px',
                    background: 'rgba(30, 41, 59, 0.7)',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    color: '#e2e8f0',
                    borderRadius: '6px',
                  }}
                  title="Network location mode"
                >
                  <option value="latest_observation">Location: latest</option>
                  <option value="centroid">Location: centroid</option>
                  <option value="weighted_centroid">Location: weighted</option>
                  <option value="triangulated">Location: triangulated</option>
                </select>
                <button
                  onClick={() => setFiltersOpen((open) => !open)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '10px',
                    background: filtersOpen ? 'rgba(59, 130, 246, 0.9)' : 'rgba(30, 41, 59, 0.9)',
                    border: filtersOpen
                      ? '1px solid rgba(59, 130, 246, 0.8)'
                      : '1px solid rgba(148, 163, 184, 0.3)',
                    color: '#f8fafc',
                    borderRadius: '5px',
                    cursor: 'pointer',
                  }}
                >
                  {filtersOpen ? 'Hide Filters' : 'Show Filters'}
                </button>
                <div className="relative" ref={columnDropdownRef}>
                  <button
                    onClick={() => setShowColumnSelector((v) => !v)}
                    style={{
                      padding: '6px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: '#cbd5e1',
                    }}
                  >
                    ⚙️
                  </button>
                  {showColumnSelector && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '4px',
                        background: 'rgba(30, 41, 59, 0.95)',
                        border: '1px solid rgba(71, 85, 105, 0.5)',
                        borderRadius: '6px',
                        zIndex: 50,
                        minWidth: '200px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      {Object.entries(NETWORK_COLUMNS).map(([col, column]) => (
                        <label
                          key={col}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: '#e2e8f0',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns.includes(col as keyof NetworkRow | 'select')}
                            onChange={() => toggleColumn(col as keyof NetworkRow | 'select')}
                            style={{ marginRight: '8px' }}
                          />
                          {column.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Header Table - Never scrolls */}
            <table
              style={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontSize: '11px',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                  {visibleColumns.map((col) => {
                    const column = NETWORK_COLUMNS[col];
                    const sortIndex = sort.findIndex((s) => s.column === col);
                    const sortState = sortIndex >= 0 ? sort[sortIndex] : null;
                    const isSortable =
                      col !== 'select' &&
                      Boolean(API_SORT_MAP[col as keyof NetworkRow]) &&
                      column.sortable;

                    return (
                      <th
                        key={col}
                        onClick={(e) =>
                          isSortable && handleColumnSort(col as keyof NetworkRow, e.shiftKey)
                        }
                        style={{
                          width: column.width,
                          minWidth: column.width,
                          maxWidth: column.width,
                          padding: '8px 6px',
                          background: sortState
                            ? 'rgba(59, 130, 246, 0.15)'
                            : 'rgba(15, 23, 42, 0.98)',
                          backdropFilter: 'blur(8px)',
                          textAlign: 'left',
                          color: sortState ? '#93c5fd' : '#cbd5e1',
                          fontWeight: '600',
                          borderRight: '1px solid rgba(71, 85, 105, 0.2)',
                          cursor: isSortable ? 'pointer' : 'default',
                          userSelect: 'none',
                          position: 'relative',
                        }}
                        title={
                          isSortable
                            ? 'Click to sort (Shift+click for multi-sort)'
                            : col === 'select'
                              ? undefined
                              : 'Sorting unavailable (API does not support this column)'
                        }
                      >
                        {col === 'select' ? (
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected;
                            }}
                            onChange={toggleSelectAll}
                            style={{ cursor: 'pointer' }}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{column.label}</span>
                            {sortState && (
                              <span style={{ fontSize: '10px', opacity: 0.8 }}>
                                {sortState.direction === 'asc' ? '↑' : '↓'}
                                {sort.length > 1 && <sup>{sortIndex + 1}</sup>}
                              </span>
                            )}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
            </table>

            {/* Data Table - Only this scrolls */}
            <div ref={tableContainerRef} className="flex-1 overflow-auto min-h-0">
              <table
                style={{
                  width: '100%',
                  tableLayout: 'fixed',
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  fontSize: '11px',
                }}
              >
                <tbody>
                  {loadingNetworks && (
                    <tr>
                      <td
                        colSpan={visibleColumns.length}
                        style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}
                      >
                        Loading networks…
                      </td>
                    </tr>
                  )}
                  {!loadingNetworks && filteredNetworks.length === 0 && (
                    <tr>
                      <td
                        colSpan={visibleColumns.length}
                        style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}
                      >
                        {error ? `Error: ${error}` : 'No networks match current filters'}
                      </td>
                    </tr>
                  )}
                  {!loadingNetworks &&
                    filteredNetworks.map((net, idx) => (
                      <tr
                        key={`${net.bssid}-${idx}`}
                        style={{
                          borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
                          background: selectedNetworks.has(net.bssid)
                            ? 'rgba(59, 130, 246, 0.1)'
                            : 'transparent',
                          cursor: 'pointer',
                        }}
                        onClick={() => selectNetworkExclusive(net.bssid)}
                        onContextMenu={(e) => openContextMenu(e, net)}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = selectedNetworks.has(net.bssid)
                            ? 'rgba(59, 130, 246, 0.15)'
                            : 'rgba(71, 85, 105, 0.1)')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = selectedNetworks.has(net.bssid)
                            ? 'rgba(59, 130, 246, 0.1)'
                            : 'transparent')
                        }
                      >
                        {visibleColumns.map((col) => {
                          const column = NETWORK_COLUMNS[col];
                          const value = net[col as keyof NetworkRow];
                          let content: React.ReactNode = value ?? 'N/A';

                          if (col === 'select') {
                            return (
                              <td key={col} style={{ width: column.width, padding: '4px 6px' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedNetworks.has(net.bssid)}
                                  onChange={() => toggleSelectNetwork(net.bssid)}
                                  style={{ cursor: 'pointer' }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                            );
                          }
                          if (col === 'type') {
                            content = <TypeBadge type={(value as NetworkRow['type']) || '?'} />;
                          } else if (col === 'threat') {
                            content = (
                              <ThreatBadge
                                threat={net.threat}
                                reasons={net.threatReasons}
                                evidence={net.threatEvidence}
                              />
                            );
                          } else if (col === 'signal') {
                            const signalValue = value as number | null;
                            let color = '#6b7280';
                            if (signalValue != null) {
                              if (signalValue >= -50) color = '#10b981';
                              else if (signalValue >= -70) color = '#f59e0b';
                              else color = '#ef4444';
                            }
                            content = (
                              <span style={{ color, fontWeight: 600 }}>
                                {signalValue != null ? `${signalValue} dBm` : 'N/A'}
                              </span>
                            );
                          } else if (col === 'observations') {
                            content = (
                              <span
                                style={{
                                  background: 'rgba(59, 130, 246, 0.2)',
                                  color: '#93c5fd',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                }}
                              >
                                {value as number}
                              </span>
                            );
                          } else if (col === 'is_sentinel') {
                            // Boolean badge for sentinel flag
                            const isSentinel = value as boolean | null;
                            content = isSentinel ? (
                              <span
                                style={{
                                  background: 'rgba(234, 179, 8, 0.2)',
                                  color: '#facc15',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  border: '1px solid rgba(234, 179, 8, 0.3)',
                                }}
                              >
                                YES
                              </span>
                            ) : null;
                          } else if (col === 'timespanDays') {
                            const days = value as number | null;
                            if (days !== null && days >= 0) {
                              content = (
                                <span
                                  style={{
                                    background:
                                      days > 30
                                        ? 'rgba(239, 68, 68, 0.2)'
                                        : days > 7
                                          ? 'rgba(251, 191, 36, 0.2)'
                                          : 'rgba(34, 197, 94, 0.2)',
                                    color: days > 30 ? '#f87171' : days > 7 ? '#fbbf24' : '#4ade80',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    border: `1px solid ${days > 30 ? 'rgba(239, 68, 68, 0.3)' : days > 7 ? 'rgba(251, 191, 36, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                                  }}
                                >
                                  {days === 0 ? 'Same day' : `${days} days`}
                                </span>
                              );
                            } else {
                              content = 'Not computed';
                            }
                          } else if (
                            [
                              'stationaryConfidence',
                              'min_altitude_m',
                              'max_altitude_m',
                              'altitude_span_m',
                              'max_distance_meters',
                              'last_altitude_m',
                            ].includes(col as string)
                          ) {
                            content = value == null ? 'Not computed' : value;
                          } else if (col === 'channel') {
                            // Only show channel for WiFi networks
                            const channelValue = value as number | null;
                            const networkType = net.type;
                            if (networkType === 'W' && channelValue !== null) {
                              content = (
                                <span
                                  style={{
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    color: '#10b981',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                  }}
                                >
                                  {channelValue}
                                </span>
                              );
                            } else {
                              content = networkType === 'W' ? 'N/A' : '—'; // Show dash for non-WiFi
                            }
                          } else if (col === 'frequency') {
                            // Show frequency for all network types, but format differently
                            const freqValue = value as number | null;
                            if (freqValue !== null) {
                              const isWiFi = net.type === 'W';
                              content = (
                                <span
                                  style={{
                                    color: isWiFi ? '#10b981' : '#94a3b8',
                                    fontWeight: isWiFi ? '600' : '400',
                                  }}
                                >
                                  {freqValue} MHz
                                </span>
                              );
                            } else {
                              content = 'N/A';
                            }
                          } else if (col === 'stationaryConfidence') {
                            const conf = value as number | null;
                            content =
                              conf !== null && conf !== undefined
                                ? `${(conf * 100).toFixed(0)}%`
                                : 'N/A';
                          } else if (col === 'max_distance_meters') {
                            // Format distance in meters or km
                            const distValue = value as number | null;
                            if (distValue != null) {
                              content =
                                distValue >= 1000
                                  ? `${(distValue / 1000).toFixed(2)} km`
                                  : `${distValue.toFixed(0)} m`;
                            } else {
                              content = 'N/A';
                            }
                          }

                          return (
                            <td
                              key={col}
                              style={{
                                width: column.width,
                                minWidth: column.width,
                                maxWidth: column.width,
                                padding: '4px 6px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                borderRight: '1px solid rgba(71, 85, 105, 0.1)',
                                color: col === 'bssid' ? macColor(net.bssid) : '#f1f5f9',
                                fontFamily: col === 'bssid' ? 'monospace' : 'inherit',
                              }}
                            >
                              {content}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
              {isLoadingMore && (
                <div
                  style={{
                    padding: '16px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '12px',
                  }}
                >
                  Loading more networks...
                </div>
              )}
              {pagination.hasMore && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderTop: '1px solid rgba(71, 85, 105, 0.2)',
                    background: 'rgba(15, 23, 42, 0.65)',
                    textAlign: 'center',
                  }}
                >
                  <button
                    onClick={() => !isLoadingMore && loadMore()}
                    disabled={isLoadingMore}
                    style={{
                      padding: '6px 10px',
                      fontSize: '11px',
                      background: 'rgba(30, 41, 59, 0.7)',
                      border: '1px solid rgba(71, 85, 105, 0.4)',
                      color: '#e2e8f0',
                      borderRadius: '6px',
                      cursor: isLoadingMore ? 'not-allowed' : 'pointer',
                      opacity: isLoadingMore ? 0.6 : 1,
                    }}
                  >
                    {isLoadingMore ? 'Loading…' : 'Load more'}
                  </button>
                  {isLoadingMore && (
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>
                      Fetching more rows…
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '8px 12px',
                borderTop: '1px solid rgba(71, 85, 105, 0.3)',
                fontSize: '11px',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '0 0 12px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span>Visible: {filteredNetworks.length}</span>
                {networkTruncated && (
                  <span style={{ color: '#fbbf24' }}>
                    Networks truncated ({filteredNetworks.length}/{networkTotal ?? 'unknown'})
                  </span>
                )}
                <span>Selected: {selectedNetworks.size}</span>
                <span>Observations: {observationCount}</span>
                {observationsTruncated && (
                  <span style={{ color: '#fbbf24' }}>
                    Observations truncated ({observationCount}/{observationsTotal ?? 'unknown'})
                  </span>
                )}
                {renderBudgetExceeded && (
                  <span style={{ color: '#f59e0b' }}>
                    Render budget exceeded ({observationsTotal ?? 'unknown'}/{renderBudget ?? 0})
                  </span>
                )}
              </div>
              <div style={{ color: '#94a3b8' }}>
                {loadingNetworks
                  ? 'Loading networks…'
                  : loadingObservations
                    ? 'Loading observations…'
                    : selectedNetworks.size > 0 && observationCount === 0
                      ? 'No observations for selection'
                      : 'Ready'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Network Tagging Context Menu */}
      {contextMenu.visible && contextMenu.network && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 10000,
            background: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            minWidth: '200px',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #475569',
              background: '#334155',
            }}
          >
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
              {contextMenu.network.ssid || '<Hidden>'}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
              {contextMenu.network.bssid}
            </div>
          </div>

          {/* Current Status */}
          {contextMenu.tag?.exists && (
            <div
              style={{
                padding: '6px 12px',
                borderBottom: '1px solid #475569',
                background: '#334155',
                fontSize: '10px',
              }}
            >
              {contextMenu.tag.is_ignored && (
                <span style={{ color: '#94a3b8', marginRight: '8px' }}>✓ Ignored</span>
              )}
              {contextMenu.tag.threat_tag && (
                <span
                  style={{
                    color:
                      contextMenu.tag.threat_tag === 'THREAT'
                        ? '#ef4444'
                        : contextMenu.tag.threat_tag === 'SUSPECT'
                          ? '#f59e0b'
                          : contextMenu.tag.threat_tag === 'FALSE_POSITIVE'
                            ? '#22c55e'
                            : contextMenu.tag.threat_tag === 'INVESTIGATE'
                              ? '#3b82f6'
                              : '#94a3b8',
                  }}
                >
                  {contextMenu.tag.threat_tag}
                </span>
              )}
            </div>
          )}

          {/* Menu Items */}
          <div style={{ padding: '4px 0' }}>
            {/* Ignore/Unignore Toggle */}
            <button
              onClick={() => handleTagAction('ignore')}
              disabled={tagLoading}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: '#e2e8f0',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#475569')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {contextMenu.tag?.is_ignored ? '👁️ Unignore (Show)' : '👁️‍🗨️ Ignore (Known/Friendly)'}
            </button>

            <div style={{ height: '1px', background: '#475569', margin: '4px 0' }} />

            {/* Threat Classification */}
            <button
              onClick={() => handleTagAction('threat')}
              disabled={tagLoading}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                background:
                  contextMenu.tag?.threat_tag === 'THREAT'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'transparent',
                border: 'none',
                color: '#ef4444',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  contextMenu.tag?.threat_tag === 'THREAT'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'transparent')
              }
            >
              ⚠️ Mark as Threat
            </button>

            <button
              onClick={() => handleTagAction('suspect')}
              disabled={tagLoading}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                background:
                  contextMenu.tag?.threat_tag === 'SUSPECT'
                    ? 'rgba(245, 158, 11, 0.2)'
                    : 'transparent',
                border: 'none',
                color: '#f59e0b',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245, 158, 11, 0.3)')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  contextMenu.tag?.threat_tag === 'SUSPECT'
                    ? 'rgba(245, 158, 11, 0.2)'
                    : 'transparent')
              }
            >
              🔶 Mark as Suspect
            </button>

            <button
              onClick={() => handleTagAction('false_positive')}
              disabled={tagLoading}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                background:
                  contextMenu.tag?.threat_tag === 'FALSE_POSITIVE'
                    ? 'rgba(34, 197, 94, 0.2)'
                    : 'transparent',
                border: 'none',
                color: '#22c55e',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(34, 197, 94, 0.3)')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  contextMenu.tag?.threat_tag === 'FALSE_POSITIVE'
                    ? 'rgba(34, 197, 94, 0.2)'
                    : 'transparent')
              }
            >
              ✓ Mark as False Positive
            </button>

            <div style={{ height: '1px', background: '#475569', margin: '4px 0' }} />

            {/* WiGLE Investigation */}
            <button
              onClick={() => handleTagAction('investigate')}
              disabled={tagLoading}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                background:
                  contextMenu.tag?.threat_tag === 'INVESTIGATE'
                    ? 'rgba(59, 130, 246, 0.2)'
                    : 'transparent',
                border: 'none',
                color: '#3b82f6',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  contextMenu.tag?.threat_tag === 'INVESTIGATE'
                    ? 'rgba(59, 130, 246, 0.2)'
                    : 'transparent')
              }
            >
              🔍 Investigate (WiGLE Lookup)
            </button>

            {/* Clear Tags */}
            {contextMenu.tag?.exists && (
              <>
                <div style={{ height: '1px', background: '#475569', margin: '4px 0' }} />
                <button
                  onClick={() => handleTagAction('clear')}
                  disabled={tagLoading}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#475569')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  🗑️ Clear All Tags
                </button>
              </>
            )}
          </div>

          {/* Loading Indicator */}
          {tagLoading && (
            <div
              style={{
                padding: '8px 12px',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '11px',
              }}
            >
              Saving...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
