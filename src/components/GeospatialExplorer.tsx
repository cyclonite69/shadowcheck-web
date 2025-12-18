import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type NetworkRow = {
  bssid: string;
  ssid: string;
  type: 'W' | 'E' | 'B' | 'L' | null;
  signal: number | null;
  security: string | null;
  frequency: number | null;
  channel?: number | null;
  observations: number;
  latitude: number | null;
  longitude: number | null;
  distanceFromHome?: number | null;
  accuracy?: number | null;
  lastSeen: string | null;
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
  signal: { label: 'Signal (dBm)', width: 100, sortable: true, default: true },
  security: { label: 'Security', width: 80, sortable: true, default: true },
  frequency: { label: 'Frequency', width: 90, sortable: true, default: false },
  channel: { label: 'Channel', width: 70, sortable: true, default: false },
  observations: { label: 'Observations', width: 100, sortable: true, default: true },
  latitude: { label: 'Latitude', width: 100, sortable: true, default: false },
  longitude: { label: 'Longitude', width: 100, sortable: true, default: false },
  distanceFromHome: { label: 'Distance (km)', width: 100, sortable: true, default: true },
  accuracy: { label: 'Accuracy (m)', width: 90, sortable: true, default: false },
  lastSeen: { label: 'Last Seen', width: 160, sortable: true, default: true },
};

const TypeBadge = ({ type }: { type: NetworkRow['type'] }) => {
  const types: Record<string, { label: string; color: string }> = {
    W: { label: 'WiFi', color: '#3b82f6' },
    E: { label: 'BLE', color: '#8b5cf6' },
    B: { label: 'BT', color: '#06b6d4' },
    L: { label: 'LTE', color: '#10b981' },
  };
  const config = types[type || 'W'] || types.W;
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

type SortState = { column: keyof NetworkRow; direction: 'asc' | 'desc' };

const INITIAL_VIEW = {
  center: [-83.69682688, 43.02345147] as [number, number],
  zoom: 12,
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
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [mapHeight, setMapHeight] = useState<number>(500);
  const [containerHeight, setContainerHeight] = useState<number>(800);
  const [mapStyle, setMapStyle] = useState<string>(() => {
    return localStorage.getItem('shadowcheck_map_style') || 'mapbox://styles/mapbox/dark-v11';
  });
  const [show3DBuildings, setShow3DBuildings] = useState<boolean>(false);
  const [showTerrain, setShowTerrain] = useState<boolean>(false);

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
  const [resizing, setResizing] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<(keyof NetworkRow | 'select')[]>(
    Object.keys(NETWORK_COLUMNS).filter(
      (k) => NETWORK_COLUMNS[k as keyof typeof NETWORK_COLUMNS].default
    ) as (keyof NetworkRow | 'select')[]
  );
  const [sort, setSort] = useState<SortState[]>([{ column: 'lastSeen', direction: 'desc' }]);
  const [selectedNetworks, setSelectedNetworks] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  const [loadingNetworks, setLoadingNetworks] = useState(false);
  const [loadingObservations, setLoadingObservations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [observationsByBssid, setObservationsByBssid] = useState<Record<string, Observation[]>>({});
  const [pagination, setPagination] = useState({ page: 1, hasMore: true });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInitRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const columnDropdownRef = useRef<HTMLDivElement | null>(null);
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

          // Add observation source and layer
          map.addSource('observations', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [],
            },
          });

          map.addLayer({
            id: 'observation-points',
            type: 'circle',
            source: 'observations',
            paint: {
              'circle-radius': 6,
              'circle-color': '#3b82f6',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
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

  // Fetch networks
  useEffect(() => {
    const controller = new AbortController();
    const fetchNetworks = async () => {
      if (loadingNetworks) return;

      setLoadingNetworks(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: pagination.page.toString(),
          limit: '500',
        });
        if (searchTerm.trim()) params.set('search', searchTerm.trim());

        console.log('Fetching networks from:', `/api/explorer/networks?${params.toString()}`);
        const res = await fetch(`/api/explorer/networks?${params.toString()}`, {
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

          return {
            bssid: bssidValue,
            ssid: row.ssid || '(hidden)',
            type: (row.type || 'W') as NetworkRow['type'],
            signal: typeof row.signal === 'number' ? row.signal : null,
            security: securityValue,
            frequency: typeof row.frequency === 'number' ? row.frequency : null,
            channel: typeof row.channel === 'number' ? row.channel : null,
            observations: parseInt(String(row.observations || 0), 10),
            latitude: typeof row.lat === 'number' ? row.lat : null,
            longitude: typeof row.lon === 'number' ? row.lon : null,
            distanceFromHome:
              typeof row.distance_from_home_km === 'number' ? row.distance_from_home_km : null,
            accuracy: typeof row.accuracy_meters === 'number' ? row.accuracy_meters : null,
            lastSeen: row.last_seen || row.observed_at || null,
          };
        });

        if (pagination.page === 1) {
          setNetworks(mapped);
        } else {
          setNetworks((prev) => [...prev, ...mapped]);
        }

        setPagination((prev) => ({
          ...prev,
          hasMore: mapped.length === 500,
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
  }, [pagination.page, searchTerm]);

  // Infinite scroll with debouncing
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container || !pagination.hasMore || isLoadingMore) return;

    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        if (scrollHeight - scrollTop <= clientHeight + 100) {
          setIsLoadingMore(true);
          setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
        }
      }, 150);
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

  const filteredNetworks = useMemo(() => networks, [networks]);

  const toggleSelectNetwork = (bssid: string) => {
    setSelectedNetworks((prev) => {
      const ns = new Set(prev);
      ns.has(bssid) ? ns.delete(bssid) : ns.add(bssid);
      return ns;
    });
  };

  // Update map observations when selection changes
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;
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

    if (map.getSource('observations')) {
      (map.getSource('observations') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: features as any,
      });
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

      // Re-add observation source and layer
      mapRef.current.addSource('observations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      mapRef.current.addLayer({
        id: 'observation-points',
        type: 'circle',
        source: 'observations',
        paint: {
          'circle-radius': 6,
          'circle-color': '#3b82f6',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
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
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f5f9', margin: 0 }}>
              📍 Map
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
              <select
                value={mapStyle}
                onChange={(e) => changeMapStyle(e.target.value)}
                style={{
                  padding: '4px 8px',
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
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  color: '#cbd5e1',
                }}
              >
                <input
                  type="checkbox"
                  checked={show3DBuildings}
                  onChange={(e) => toggle3DBuildings(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>🏢 3D Buildings</span>
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  color: '#cbd5e1',
                }}
              >
                <input
                  type="checkbox"
                  checked={showTerrain}
                  onChange={(e) => toggleTerrain(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>⛰️ Terrain</span>
              </label>
            </div>
          </div>

          <div className="relative" style={{ height: 'calc(100% - 49px)' }}>
            <div
              className="absolute top-3 left-3 z-10 flex gap-2"
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                borderRadius: '6px',
                padding: '4px 8px',
              }}
            >
              <button
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                🎯 Fit
              </button>
              <button
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: 'rgba(71, 85, 105, 0.6)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                🏠 Home
              </button>
            </div>
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
                placeholder="Search SSID or BSSID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  background: 'rgba(71, 85, 105, 0.6)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  fontSize: '11px',
                  color: 'white',
                  outline: 'none',
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

          {/* Table */}
          <div ref={tableContainerRef} className="flex-1 overflow-auto min-h-0">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  background: 'rgba(15, 23, 42, 0.95)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                  {visibleColumns.map((col) => {
                    const column = NETWORK_COLUMNS[col];
                    return (
                      <th
                        key={col}
                        style={{
                          width: column.width,
                          minWidth: column.width,
                          padding: '8px 6px',
                          textAlign: 'left',
                          color: '#cbd5e1',
                          fontWeight: '600',
                          borderRight: '1px solid rgba(71, 85, 105, 0.2)',
                        }}
                      >
                        {column.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
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
                      onClick={() => toggleSelectNetwork(net.bssid)}
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
                          content = <TypeBadge type={(value as NetworkRow['type']) || 'W'} />;
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
                        }

                        return (
                          <td
                            key={col}
                            style={{
                              width: column.width,
                              minWidth: column.width,
                              padding: '4px 6px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              borderRight: '1px solid rgba(71, 85, 105, 0.1)',
                              color: col === 'bssid' ? '#cbd5e1' : '#f1f5f9',
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
