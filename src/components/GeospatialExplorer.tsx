import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import PageTitle from './PageTitle';

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
  distanceFromHome?: number | null;
  accuracy?: number | null;
  firstSeen?: string | null; // Add first seen
  lastSeen: string | null;
  timespanDays?: number | null; // Add timespan calculation
  threat?: ThreatInfo | null;
  // Enrichment fields (networks-v2 API)
  manufacturer?: string | null;
  manufacturer_address?: string | null;
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
  distanceFromHome: { label: 'Distance (km)', width: 100, sortable: true, default: true },
  accuracy: { label: 'Accuracy (m)', width: 90, sortable: true, default: false },
  firstSeen: { label: 'First Seen', width: 160, sortable: true, default: false },
  lastSeen: { label: 'Last Seen', width: 160, sortable: true, default: true },
  timespanDays: { label: 'Timespan (days)', width: 120, sortable: true, default: false },
  // Enrichment columns (networks-v2 API) - hidden by default
  manufacturer: { label: 'Manufacturer', width: 150, sortable: true, default: false },
  manufacturer_address: { label: 'Mfg. Address', width: 200, sortable: true, default: false },
  min_altitude_m: { label: 'Min Alt (m)', width: 90, sortable: true, default: false },
  max_altitude_m: { label: 'Max Alt (m)', width: 90, sortable: true, default: false },
  altitude_span_m: { label: 'Alt Span (m)', width: 100, sortable: true, default: false },
  max_distance_meters: { label: 'Max Dist (m)', width: 110, sortable: true, default: false },
  last_altitude_m: { label: 'Last Alt (m)', width: 90, sortable: true, default: false },
  is_sentinel: { label: 'Sentinel', width: 80, sortable: true, default: false },
};

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

const ThreatBadge = ({ threat }: { threat?: ThreatInfo | null }) => {
  if (!threat || threat.level === 'NONE') return null;

  const config = {
    HIGH: { label: 'HIGH', color: '#ef4444', bg: '#ef444420' },
    MED: { label: 'MED', color: '#f97316', bg: '#f9731620' },
    LOW: { label: 'LOW', color: '#eab308', bg: '#eab30820' },
    NONE: { label: '', color: '#6b7280', bg: '#6b728020' },
  };

  const levelConfig = config[threat.level];

  return (
    <span
      className="px-2 py-1 rounded text-xs font-semibold"
      style={{
        backgroundColor: levelConfig.bg,
        color: levelConfig.color,
        border: `1px solid ${levelConfig.color}40`,
        cursor: 'help',
      }}
      title={`${threat.summary}\nScore: ${(threat.score * 100).toFixed(0)}%`}
    >
      {levelConfig.label}
    </span>
  );
};

type SortState = { column: keyof NetworkRow; direction: 'asc' | 'desc' };

const INITIAL_VIEW = {
  center: [-83.69682688, 43.02345147] as [number, number],
  zoom: 12,
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
  if (!signalDbm || signalDbm === null) return 50;

  let freq = frequencyMhz;
  if (typeof freq === 'string') {
    freq = parseFloat((freq as any).replace(' GHz', '')) * 1000;
  }
  if (!freq || freq <= 0) freq = 2437; // Default to channel 6 (2.4GHz)

  // Signal strength to distance mapping (inverse relationship)
  let distanceM;
  if (signalDbm >= -30) distanceM = 10;
  else if (signalDbm >= -50) distanceM = 50;
  else if (signalDbm >= -70) distanceM = 150;
  else if (signalDbm >= -80) distanceM = 300;
  else distanceM = 500;

  // Frequency adjustment
  if (freq > 5000)
    distanceM *= 0.6; // 5GHz has shorter range
  else distanceM *= 0.8; // 2.4GHz adjustment

  // Convert to pixels for display (simplified)
  const pixelsPerMeter = Math.pow(2, zoom - 12) * 0.1;
  let radiusPixels = distanceM * pixelsPerMeter;

  // Zoom scaling
  const zoomScale = Math.pow(1.15, zoom - 10);
  radiusPixels *= Math.min(zoomScale, 4);

  // Clamp radius for display
  return Math.max(3, Math.min(radiusPixels, 250));
};

// Signal strength interpretation (from Kepler)
const interpretSignalStrength = (signal: number): { color: string; text: string } => {
  if (signal > -50) return { color: '#22c55e', text: 'Excellent' };
  if (signal > -60) return { color: '#84cc16', text: 'Good' };
  if (signal > -70) return { color: '#fbbf24', text: 'Fair' };
  if (signal > -80) return { color: '#f97316', text: 'Weak' };
  return { color: '#ef4444', text: 'Very Weak' };
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
] as const;

export default function GeospatialExplorer() {
  // All state declarations first
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [mapHeight, setMapHeight] = useState<number>(500);
  const [containerHeight, setContainerHeight] = useState<number>(800);
  const [mapStyle, setMapStyle] = useState<string>(() => {
    return localStorage.getItem('shadowcheck_map_style') || 'mapbox://styles/mapbox/dark-v11';
  });
  const [show3DBuildings, setShow3DBuildings] = useState<boolean>(false);
  const [showTerrain, setShowTerrain] = useState<boolean>(false);
  const [resizing, setResizing] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<(keyof NetworkRow | 'select')[]>(
    Object.keys(NETWORK_COLUMNS).filter(
      (k) => NETWORK_COLUMNS[k as keyof typeof NETWORK_COLUMNS].default
    ) as (keyof NetworkRow | 'select')[]
  );
  const [sort, setSort] = useState<SortState[]>([{ column: 'lastSeen', direction: 'desc' }]);
  const [selectedNetworks, setSelectedNetworks] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState(''); // For immediate UI updates
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [loadingNetworks, setLoadingNetworks] = useState(false);
  const [loadingObservations, setLoadingObservations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [observationsByBssid, setObservationsByBssid] = useState<Record<string, Observation[]>>({});
  const [pagination, setPagination] = useState({ page: 1, hasMore: true });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [homeButtonActive, setHomeButtonActive] = useState(false);
  const [fitButtonActive, setFitButtonActive] = useState(false);

  // Refs
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInitRef = useRef(false);
  const columnDropdownRef = useRef<HTMLDivElement | null>(null);
  const locationSearchRef = useRef<HTMLDivElement | null>(null);
  const searchMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null);

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
      console.error('Geocoding error:', error);
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

  // Debounce search input (500ms delay)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Reset pagination when search term changes
  useEffect(() => {
    setPagination({ page: 1, hasMore: true });
    setNetworks([]); // Clear existing results
  }, [searchTerm]);

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

  // Handle resize drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      console.log('Resize handle clicked!', e.clientY);
      e.preventDefault();
      e.stopPropagation();
      setResizing(true);

      const startY = e.clientY;
      const startHeight = mapHeight;

      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        const deltaY = e.clientY - startY;
        const newHeight = Math.max(150, Math.min(containerHeight - 150, startHeight + deltaY));
        console.log('Resizing to:', newHeight);
        setMapHeight(newHeight);

        // Force map resize if it exists
        if (mapRef.current) {
          setTimeout(() => mapRef.current?.resize(), 0);
        }
      };

      const handleMouseUp = (e: MouseEvent) => {
        console.log('Resize ended');
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
        const actualStyleUrl = mapStyle.startsWith('mapbox://styles/mapbox/standard')
          ? 'mapbox://styles/mapbox/standard'
          : mapStyle;

        const map = new mapboxgl.Map({
          container: mapContainerRef.current as HTMLDivElement,
          style: actualStyleUrl,
          center: INITIAL_VIEW.center,
          zoom: INITIAL_VIEW.zoom,
          attributionControl: false,
        });

        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');

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

            const popupHTML = `
              <div style="color: #1e293b; font-family: system-ui; max-width: 280px;">
                <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #0f172a;">
                  Observation #${props.number}
                </div>
                <div style="font-size: 12px; margin-bottom: 6px;">
                  <strong>BSSID:</strong> <span style="font-family: monospace; color: ${bssidColor};">${props.bssid}</span>
                </div>
                <div style="font-size: 12px; margin-bottom: 6px;">
                  <strong>Signal:</strong> 
                  <span style="color: ${signalClass === 'signal-strong' ? '#10b981' : signalClass === 'signal-medium' ? '#f59e0b' : '#ef4444'}; font-weight: 600;">
                    ${props.signal ? `${props.signal} dBm` : 'N/A'}
                  </span>
                </div>
                ${
                  props.signal
                    ? `
                  <div style="margin: 8px 0; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 11px; color: #64748b;">Signal Range:</span>
                    <div style="
                      width: ${Math.min(signalRadius / 3, 40)}px; 
                      height: ${Math.min(signalRadius / 3, 40)}px; 
                      border: 2px solid ${bssidColor}; 
                      border-radius: 50%; 
                      background: ${bssidColor}20; 
                      display: inline-block;
                    "></div>
                    <span style="font-size: 11px; color: #64748b;">${Math.round(signalRadius)}px radius</span>
                  </div>
                `
                    : ''
                }
                <div style="font-size: 11px; color: #64748b; margin-top: 8px;">
                  ${props.time ? new Date(props.time).toLocaleString() : 'Time unknown'}
                </div>
              </div>
            `;

            new mapboxgl.Popup({ offset: 15 }).setLngLat(e.lngLat).setHTML(popupHTML).addTo(map);
          });

          // Add hover circle source and layer
          map.addSource('hover-circle', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          });

          map.addLayer({
            id: 'hover-circle-fill',
            type: 'circle',
            source: 'hover-circle',
            paint: {
              'circle-radius': ['get', 'radius'],
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.15,
              'circle-stroke-width': 2,
              'circle-stroke-color': ['get', 'strokeColor'],
              'circle-stroke-opacity': 0.6,
            },
          });

          // Show tooltip and signal circle on hover
          map.on('mouseenter', 'observation-points', (e) => {
            map.getCanvas().style.cursor = 'pointer';

            if (!e.features || e.features.length === 0) return;

            const feature = e.features[0];
            const props = feature.properties;
            if (!props || !e.lngLat) return;

            // Remove existing hover popup
            if (hoverPopupRef.current) {
              hoverPopupRef.current.remove();
            }

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

            // Interpret signal strength
            const signalStrength = interpretSignalStrength(props.signal || 0);

            const popupHTML = `
              <div style="background: linear-gradient(135deg, rgba(17, 24, 39, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%); color: #f8fafc; padding: 16px; border-radius: 12px; max-width: 400px; font-size: 11px; border: 1px solid rgba(59, 130, 246, 0.3); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid rgba(59, 130, 246, 0.2);">
                  <div style="background: ${bssidColor}20; border: 2px solid ${bssidColor}; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; color: ${bssidColor};">
                    ${props.number}
                  </div>
                  <div style="flex: 1;">
                    <div style="color: #60a5fa; font-weight: bold; font-size: 14px;">Observation #${props.number}</div>
                    <div style="color: #94a3b8; font-size: 10px; margin-top: 2px;">${props.bssid}</div>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                  <div style="background: rgba(59, 130, 246, 0.08); padding: 8px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.15);">
                    <span style="color: #94a3b8; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">Signal</span>
                    <div style="margin-top: 3px;">
                      <span style="color: ${signalStrength.color}; font-weight: bold;">${props.signal ? `${props.signal} dBm` : 'N/A'}</span>
                      <div style="color: #64748b; font-size: 9px; margin-top: 2px;">${signalStrength.text}</div>
                    </div>
                  </div>
                  <div style="background: rgba(59, 130, 246, 0.08); padding: 8px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.15);">
                    <span style="color: #94a3b8; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">Range</span>
                    <div style="margin-top: 3px;">
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <div style="width: 16px; height: 16px; border: 2px solid ${bssidColor}; border-radius: 50%; background: ${bssidColor}20;"></div>
                        <span style="color: #e2e8f0; font-size: 10px; font-weight: 600;">${Math.round(signalRadius)}px</span>
                      </div>
                    </div>
                  </div>
                </div>

                ${
                  props.time
                    ? `
                <div style="background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%); padding: 10px; border-radius: 8px; border: 1px solid rgba(251, 191, 36, 0.3); margin-bottom: 10px;">
                  <div style="color: #fbbf24; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; font-weight: 600;">⏱️ Observed</div>
                  <div style="color: #fde68a; font-weight: 600; font-size: 11px;">${new Date(props.time).toLocaleString()}</div>
                </div>
                `
                    : ''
                }

                <div style="border-top: 1px solid rgba(59, 130, 246, 0.2); padding-top: 8px; margin-top: 8px;">
                  <div style="display: flex; align-items: center; gap: 6px; font-size: 10px;">
                    <span style="color: #94a3b8;">Network Color:</span>
                    <div style="display: flex; align-items: center; gap: 4px;">
                      <div style="width: 12px; height: 12px; background: ${bssidColor}; border-radius: 2px; border: 1px solid rgba(255, 255, 255, 0.2);"></div>
                      <span style="font-family: 'Courier New', monospace; color: #94a3b8;">${bssidColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            `;

            hoverPopupRef.current = new mapboxgl.Popup({
              offset: 15,
              closeButton: false,
              closeOnClick: false,
            })
              .setLngLat(e.lngLat)
              .setHTML(popupHTML)
              .addTo(map);
          });

          map.on('mouseleave', 'observation-points', () => {
            map.getCanvas().style.cursor = '';

            // Remove hover popup
            if (hoverPopupRef.current) {
              hoverPopupRef.current.remove();
              hoverPopupRef.current = null;
            }

            // Clear hover circle from map
            const hoverCircleSource = map.getSource('hover-circle') as mapboxgl.GeoJSONSource;
            if (hoverCircleSource) {
              hoverCircleSource.setData({
                type: 'FeatureCollection',
                features: [],
              });
            }
          });

          // Add home marker and circle
          map.addSource('home-location', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: INITIAL_VIEW.center,
                  },
                  properties: {
                    title: 'Home',
                  },
                },
              ],
            },
          });

          // Home circle (100 yard radius ≈ 91m)
          map.addLayer({
            id: 'home-circle',
            type: 'circle',
            source: 'home-location',
            paint: {
              'circle-radius': [
                'interpolate',
                ['exponential', 2],
                ['zoom'],
                10,
                1.8,
                15,
                45,
                18,
                180,
                20,
                360,
              ],
              'circle-color': '#10b981',
              'circle-opacity': 0.1,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#10b981',
              'circle-stroke-opacity': 0.8,
            },
          });

          // Home marker dot
          map.addLayer({
            id: 'home-dot',
            type: 'circle',
            source: 'home-location',
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
            source: 'home-location',
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
          console.error('Map error:', e);
          setMapError('Map failed to load');
        });
      } catch (err) {
        console.error('Map init failed', err);
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

  // Reset pagination when sort changes
  useEffect(() => {
    setPagination({ page: 1, hasMore: true });
    setNetworks([]); // Clear existing results immediately
  }, [JSON.stringify(sort)]); // Use JSON.stringify for deep comparison

  // Fetch networks
  useEffect(() => {
    const controller = new AbortController();
    const fetchNetworks = async () => {
      // Remove the loadingNetworks guard that was preventing initial fetch
      setLoadingNetworks(true);
      setError(null);
      try {
        // Build sort parameters for API (multi-column support)
        const sortColumns = sort.map((s) => s.column).join(',');
        const sortOrders = sort.map((s) => s.direction).join(',');

        const params = new URLSearchParams({
          page: pagination.page.toString(),
          limit: '500',
          sort: sortColumns,
          order: sortOrders,
        });
        if (searchTerm.trim()) params.set('search', searchTerm.trim());

        console.log('Fetching networks from:', `/api/explorer/networks-v2?${params.toString()}`);
        const res = await fetch(`/api/explorer/networks-v2?${params.toString()}`, {
          signal: controller.signal,
        });
        console.log('Networks response status:', res.status);
        if (!res.ok) throw new Error(`networks ${res.status}`);
        const data = await res.json();
        console.log('Networks data received:', data);
        const rows = data.rows || [];

        const mapped: NetworkRow[] = rows.map((row: any, idx: number) => {
          const securityValue = row.security || row.capabilities || row.encryption || 'OPEN';
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

          return {
            bssid: bssidValue,
            ssid: row.ssid || '(hidden)',
            type: networkType,
            signal: typeof row.signal === 'number' ? row.signal : null,
            security: securityValue,
            frequency: frequency,
            channel: isWiFi ? calculateChannel(frequency) : null, // Only show channels for WiFi
            observations: parseInt(String(row.observations || 0), 10),
            latitude: typeof row.lat === 'number' ? row.lat : null,
            longitude: typeof row.lon === 'number' ? row.lon : null,
            distanceFromHome:
              typeof row.distance_from_home_km === 'number' ? row.distance_from_home_km : null,
            accuracy: typeof row.accuracy_meters === 'number' ? row.accuracy_meters : null,
            firstSeen: row.first_seen || null,
            lastSeen: row.last_seen || row.observed_at || null,
            timespanDays: calculateTimespan(row.first_seen, row.last_seen || row.observed_at),
            threat: row.threat || null,
            // Enrichment fields (networks-v2 API)
            manufacturer: row.manufacturer || null,
            manufacturer_address: row.manufacturer_address || null,
            min_altitude_m: typeof row.min_altitude_m === 'number' ? row.min_altitude_m : null,
            max_altitude_m: typeof row.max_altitude_m === 'number' ? row.max_altitude_m : null,
            altitude_span_m: typeof row.altitude_span_m === 'number' ? row.altitude_span_m : null,
            max_distance_meters:
              typeof row.max_distance_meters === 'number' ? row.max_distance_meters : null,
            last_altitude_m: typeof row.last_altitude_m === 'number' ? row.last_altitude_m : null,
            is_sentinel: typeof row.is_sentinel === 'boolean' ? row.is_sentinel : null,
          };
        });

        // CRITICAL: Reset networks on page 1, append on subsequent pages
        if (pagination.page === 1) {
          setNetworks(mapped);
        } else {
          setNetworks((prev) => [...prev, ...mapped]);
        }

        setPagination((prev) => ({
          ...prev,
          hasMore: data.hasMore || mapped.length === 500,
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
  }, [pagination.page, searchTerm, JSON.stringify(sort)]); // Use JSON.stringify for deep comparison

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
          setPagination((prev) => ({ ...prev, page: prev.page + 1 }));

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

  // Fetch observations for selected networks
  useEffect(() => {
    const controller = new AbortController();
    const fetchObservations = async () => {
      if (!selectedNetworks.size) {
        setObservationsByBssid({});
        return;
      }

      setLoadingObservations(true);
      setError(null);
      try {
        const entries = await Promise.all(
          Array.from(selectedNetworks).map(async (bssid) => {
            const res = await fetch(`/api/networks/observations/${encodeURIComponent(bssid)}`, {
              signal: controller.signal,
            });
            if (!res.ok) throw new Error(`observations ${res.status}`);
            const data = await res.json();
            const obs: Observation[] = (data.observations || [])
              .filter((o: any) => typeof o.lat === 'number' && typeof o.lon === 'number')
              .map((o: any) => ({
                id: o.id || `${bssid}-${o.time}`,
                bssid,
                lat: o.lat,
                lon: o.lon,
                signal: typeof o.signal === 'number' ? o.signal : (o.signal ?? null),
                time: o.time,
                acc: o.acc ?? null,
                distance_from_home_km: o.distance_from_home_km ?? null,
              }));
            return [bssid, obs] as const;
          })
        );

        const newObservationsByBssid = Object.fromEntries(entries);
        setObservationsByBssid(newObservationsByBssid);
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
  }, [selectedNetworks]);

  // Server-side sorting - no client-side sorting needed
  const filteredNetworks = useMemo(() => networks, [networks]);

  const handleColumnSort = (column: keyof NetworkRow, shiftKey: boolean) => {
    if (!NETWORK_COLUMNS[column].sortable) return;

    setSort((prevSort) => {
      // Shift+click: Add to multi-column sort
      if (shiftKey) {
        const existing = prevSort.find((s) => s.column === column);
        if (existing) {
          // Toggle direction for existing sort column
          return prevSort.map((s) =>
            s.column === column ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' } : s
          );
        } else {
          // Add new sort column
          return [...prevSort, { column, direction: 'asc' }];
        }
      }
      // Regular click: Single column sort
      else {
        const existing = prevSort.find((s) => s.column === column);
        if (existing && prevSort.length === 1) {
          // Toggle direction if already sorting by this column only
          return [{ column, direction: existing.direction === 'asc' ? 'desc' : 'asc' }];
        } else {
          // Set as primary sort
          return [{ column, direction: 'asc' }];
        }
      }
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
    const features = activeObservationSets.flatMap((set) =>
      set.observations.map((obs, index) => ({
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
          number: index + 1, // Start at 1 for each network
          color: bssidColors[obs.bssid],
        },
      }))
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
  }, [activeObservationSets, mapReady]);

  const toggleColumn = (col: keyof NetworkRow | 'select') => {
    setVisibleColumns((v) => (v.includes(col) ? v.filter((c) => c !== col) : [...v, col]));
  };

  // Map style change handler
  const changeMapStyle = (styleUrl: string) => {
    if (!mapRef.current) return;

    const currentCenter = mapRef.current.getCenter();
    const currentZoom = mapRef.current.getZoom();

    // Save the style preference
    localStorage.setItem('shadowcheck_map_style', styleUrl);
    setMapStyle(styleUrl);

    // Find the style config for Standard variants
    const styleConfig = MAP_STYLES.find((s) => s.value === styleUrl);

    // Get the actual style URL (Standard variants all use the same base URL)
    const actualStyleUrl = styleUrl.startsWith('mapbox://styles/mapbox/standard')
      ? 'mapbox://styles/mapbox/standard'
      : styleUrl;

    mapRef.current.setStyle(actualStyleUrl);

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
          set.observations.map((obs) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [obs.lon, obs.lat],
            },
            properties: {
              bssid: obs.bssid,
              signal: obs.signal,
              time: obs.time,
            },
          }))
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
      <div className="flex flex-col gap-3 p-3 h-screen">
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
                  background: show3DBuildings ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.9)',
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
                  mapRef.current.flyTo({ center: INITIAL_VIEW.center, zoom: 17 }); // Higher zoom ~100-200m up
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
                      console.error('Geolocation error:', error);
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
            <div
              ref={mapContainerRef}
              className="w-full h-full"
              style={{ background: 'rgba(30, 41, 59, 0.8)' }}
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
              <input
                type="text"
                placeholder="Search SSID, BSSID, or manufacturer across entire database..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{
                  background: 'rgba(71, 85, 105, 0.6)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  fontSize: '11px',
                  color: 'white',
                  outline: 'none',
                  minWidth: '280px',
                }}
              />
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

                  return (
                    <th
                      key={col}
                      onClick={(e) =>
                        col !== 'select' && handleColumnSort(col as keyof NetworkRow, e.shiftKey)
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
                        cursor: column.sortable && col !== 'select' ? 'pointer' : 'default',
                        userSelect: 'none',
                        position: 'relative',
                      }}
                      title={
                        column.sortable && col !== 'select'
                          ? 'Click to sort, Shift+Click for multi-column sort'
                          : undefined
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
                      {error ? `Error: ${error}` : 'No networks found'}
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
                          content = <ThreatBadge threat={net.threat} />;
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
                            content = 'N/A';
                          }
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
                          // Format altitude values with 1 decimal place
                          const altValue = value as number | null;
                          content = altValue != null ? `${altValue.toFixed(1)} m` : 'N/A';
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
              <span>Selected: {selectedNetworks.size}</span>
              <span>Observations: {observationCount}</span>
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
  );
}
