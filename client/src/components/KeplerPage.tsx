import { usePageFilters } from '../hooks/usePageFilters';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { FilterPanel } from './FilterPanel';
import { ActiveFiltersSummary } from './ActiveFiltersSummary';
import { useFilterStore, useDebouncedFilters } from '../stores/filterStore';
import { useFilterURLSync } from '../hooks/useFilteredData';
import { useAdaptedFilters } from '../hooks/useAdaptedFilters';
import { getPageCapabilities } from '../utils/filterCapabilities';
import { logDebug, logError, logWarn } from '../logging/clientLogger';
import { HamburgerButton } from './HamburgerButton';
import { ControlPanel } from './ControlPanel';
import { KeplerFilterPanel } from './KeplerFilterPanel';
import { renderNetworkTooltip } from '../utils/geospatial/renderNetworkTooltip';

declare global {
  interface Window {
    deck?: any;
    mapboxgl?: any;
  }
}

type NetworkData = {
  position: [number, number];
  bssid: string;
  ssid: string;
  signal: number;
  level: number;
  encryption: string;
  channel: number;
  frequency: number;
  manufacturer: string;
  device_type: string;
  type: string;
  capabilities: string;
  timestamp: string;
  last_seen: string;
  device_id?: string;
  source_tag?: string;
  accuracy?: number;
  altitude?: number;
  obs_count?: number;
  threat_level?: string;
  threat_score?: number;
  is_suspicious?: boolean;
  distance_from_home?: number;
};

type LayerType = 'scatterplot' | 'heatmap' | 'hexagon';
type DrawMode = 'none' | 'rectangle' | 'polygon' | 'circle';

// Format security capabilities string into readable label
const formatSecurity = (capabilities: string | null | undefined): string => {
  const value = String(capabilities || '').toUpperCase();
  if (!value || value === 'UNKNOWN' || value === 'OPEN/UNKNOWN') {
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

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });

const loadCss = (href: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`link[href="${href}"]`)) {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load CSS ${href}`));
    document.head.appendChild(link);
  });

const KeplerPage: React.FC = () => {
  // Set current page for filter scoping
  usePageFilters('kepler');

  const mapRef = useRef<HTMLDivElement | null>(null);
  const deckRef = useRef<any>(null);
  const scriptsLoadedRef = useRef<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [networkData, setNetworkData] = useState<NetworkData[]>([]);
  const [selectedPoints, setSelectedPoints] = useState<NetworkData[]>([]);
  const [actualCounts, setActualCounts] = useState<{
    observations: number;
    networks: number;
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Universal filter system - memoize capabilities to prevent re-renders
  const capabilities = useMemo(() => getPageCapabilities('kepler'), []);
  const adaptedFilters = useAdaptedFilters(capabilities);
  useFilterURLSync();

  // Controls
  const [layerType, setLayerType] = useState<LayerType>('scatterplot');
  const [pointSize, setPointSize] = useState<number>(0.1);
  const [signalThreshold, setSignalThreshold] = useState<number>(-100);
  const [pitch, setPitch] = useState<number>(0);
  const [height3d, setHeight3d] = useState<number>(1);
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [datasetType, setDatasetType] = useState<'observations' | 'networks'>('observations');

  const initDeck = (token: string, data: NetworkData[]) => {
    if (!window.deck || !mapRef.current) return;

    let centerLon = -83.6968; // Default to Flint, MI
    let centerLat = 43.0234;
    let zoom = 10;

    // Validate data and calculate bounding box only if we have valid data
    if (data && data.length > 0) {
      // Filter for valid coordinates with both lon and lat values
      const validData = data.filter(
        (d) =>
          d.position &&
          d.position.length >= 2 &&
          typeof d.position[0] === 'number' &&
          typeof d.position[1] === 'number' &&
          !isNaN(d.position[0]) &&
          !isNaN(d.position[1])
      );

      if (validData.length > 0) {
        // Calculate bounds without spread operator to handle large datasets
        let minLon = Infinity,
          maxLon = -Infinity;
        let minLat = Infinity,
          maxLat = -Infinity;

        for (const d of validData) {
          const [lon, lat] = d.position;
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }

        const bounds = { minLon, maxLon, minLat, maxLat };

        centerLon = (bounds.minLon + bounds.maxLon) / 2;
        centerLat = (bounds.minLat + bounds.maxLat) / 2;

        // Calculate zoom to fit all points, prevent Math.log2(0)
        const lonDiff = bounds.maxLon - bounds.minLon;
        const latDiff = bounds.maxLat - bounds.minLat;
        const maxDiff = Math.max(lonDiff, latDiff, 0.01); // Prevent 0
        zoom = Math.max(1, Math.min(15, 10 - Math.log2(maxDiff)));
      }
    }

    const { DeckGL } = window.deck;
    const mapboxgl = window.mapboxgl;
    deckRef.current = new DeckGL({
      container: mapRef.current,
      mapLib: mapboxgl,
      mapboxApiAccessToken: token,
      mapStyle: 'mapbox://styles/mapbox/dark-v11',
      initialViewState: {
        longitude: centerLon,
        latitude: centerLat,
        zoom: zoom,
        pitch: pitch,
        bearing: 0,
        minZoom: 1,
        maxZoom: 24,
      },
      controller: drawMode === 'none',
      useDevicePixels: false,
      getTooltip: ({ object }: { object: any }) => {
        if (!object) return null;

        const tooltipHTML = renderNetworkTooltip({
          ssid: object.ssid,
          bssid: object.bssid,
          type: object.type,
          threat_level: object.threat_level,
          threat_score: object.threat_score,
          signal: object.signal || object.bestlevel,
          security: formatSecurity(object.capabilities || object.encryption),
          frequency: object.frequency,
          channel: object.channel,
          lat: object.position ? object.position[1] : null,
          lon: object.position ? object.position[0] : null,
          altitude: object.altitude,
          manufacturer: object.manufacturer,
          observation_count: object.obs_count || object.observation_count || object.observations,
          timespan_days: object.timespan_days,
          time: object.timestamp || object.time,
          first_seen: object.first_seen || object.timestamp,
          last_seen: object.last_seen,
          distance_from_home_km: object.distance_from_home,
          max_distance_km: object.max_distance_km,
          unique_days: object.unique_days,
          accuracy: object.accuracy,
        });

        return {
          html: tooltipHTML,
          style: {
            backgroundColor: 'transparent',
            border: 'none',
            boxShadow: 'none',
            padding: '0',
            fontSize: '12px',
          },
        };
      },
      onClick: ({ object }: { object: any }) => {
        if (object && !selectedPoints.find((p) => p.bssid === object.bssid)) {
          setSelectedPoints((prev) => [...prev, object]);
        }
      },
    });

    // Add orientation controls to the underlying Mapbox map
    // DeckGL wraps Mapbox, access it after a brief delay to ensure initialization
    setTimeout(() => {
      try {
        const mapboxMap = deckRef.current?.deck?.getMapboxMap?.();
        if (mapboxMap) {
          // Dynamically load orientation controls to reduce initial bundle size
          import('../utils/mapOrientationControls')
            .then(({ attachMapOrientationControls }) => {
              attachMapOrientationControls(mapboxMap, {
                scalePosition: 'bottom-right',
                scaleUnit: 'metric',
                ensureNavigation: true,
                navigationPosition: 'top-right',
              });
            })
            .catch((err) => {
              logWarn('Failed to load map orientation controls module', err);
            });
        }
      } catch (e) {
        logWarn('Could not attach map controls to DeckGL', e);
      }
    }, 100);

    setTimeout(() => {
      try {
        const attribList = mapRef.current?.querySelector(
          '.mapboxgl-ctrl-attrib-inner[role="list"]'
        );
        if (!attribList) return;
        attribList.querySelectorAll('a').forEach((anchor) => {
          anchor.setAttribute('role', 'listitem');
        });
      } catch {
        // Mapbox attribution markup is vendor-controlled; fail silently.
      }
    }, 150);
  };

  const updateVisualization = () => {
    if (!deckRef.current || !window.deck || networkData.length === 0) return;

    const filteredData = networkData.filter((d) => d.signal >= signalThreshold);
    let layer;

    if (layerType === 'scatterplot') {
      layer = new window.deck.ScatterplotLayer({
        id: 'networks',
        data: filteredData,
        getPosition: (d: NetworkData) => d.position,
        getRadius: pointSize * 10,
        getFillColor: (d: NetworkData) => {
          if (d.signal > -50) return [255, 0, 0, 180];
          if (d.signal > -70) return [255, 255, 0, 180];
          return [0, 255, 0, 180];
        },
        pickable: true,
        radiusMinPixels: 2,
        radiusMaxPixels: 50,
      });
    } else if (layerType === 'heatmap') {
      layer = new window.deck.HeatmapLayer({
        id: 'networks-heatmap',
        data: filteredData,
        getPosition: (d: NetworkData) => d.position,
        getWeight: (d: NetworkData) => Math.max(1, d.signal / 10),
        radiusPixels: 50,
      });
    } else if (layerType === 'hexagon') {
      layer = new window.deck.HexagonLayer({
        id: 'networks-hexagon',
        data: filteredData,
        getPosition: (d: NetworkData) => d.position,
        radius: 200,
        elevationScale: height3d * 4,
        extruded: true,
        pickable: true,
        getFillColor: [255, 140, 0, 180],
      });
    }

    deckRef.current.setProps({ layers: [layer] });
  };

  const clearSelection = () => {
    setSelectedPoints([]);
  };

  const loadData = async (type: 'observations' | 'networks') => {
    try {
      logDebug(`[Kepler] loadData called, type: ${type}`);
      setLoading(true);
      setError('');

      const endpoint =
        type === 'observations' ? '/api/kepler/observations' : '/api/kepler/networks';

      // Add adapted filters to request
      const { filtersForPage, enabledForPage } = adaptedFilters;
      const params = new URLSearchParams();
      params.set('filters', JSON.stringify(filtersForPage));
      params.set('enabled', JSON.stringify(enabledForPage));

      const endpointWithFilters = `${endpoint}?${params}`;
      logDebug(`[Kepler] Fetching from: ${endpointWithFilters}`);

      const [tokenRes, dataRes] = await Promise.all([
        fetch('/api/mapbox-token'),
        fetch(endpointWithFilters),
      ]);

      logDebug('[Kepler] Fetch complete, parsing...');
      const tokenData = await tokenRes.json();
      const geojson = await dataRes.json();

      logDebug(`[Kepler] Data received, features: ${geojson.features?.length || 0}`);

      if (!tokenData?.token) {
        throw new Error('Mapbox token missing. Set it in Admin.');
      }
      if (geojson.error) throw new Error(`API Error: ${geojson.error}`);
      if (!geojson.features || !Array.isArray(geojson.features))
        throw new Error(`Invalid data format`);
      if (geojson.features.length === 0) throw new Error('No network data found');

      const processedData: NetworkData[] = geojson.features
        .filter(
          (f: any) => f.geometry && f.geometry.coordinates && f.geometry.coordinates.length >= 2
        )
        .map((f: any) => ({
          position: f.geometry.coordinates,
          bssid: f.properties.bssid || 'Unknown',
          ssid: f.properties.ssid || 'Hidden Network',
          signal: f.properties.bestlevel || f.properties.signal || f.properties.level || -90,
          level: f.properties.bestlevel || f.properties.signal || f.properties.level || -90,
          encryption: f.properties.encryption || 'Unknown',
          channel: f.properties.channel || 0,
          frequency: f.properties.frequency || 0,
          manufacturer: f.properties.manufacturer || 'Unknown',
          device_type: f.properties.device_type || 'Unknown',
          type: f.properties.type || 'W',
          capabilities: f.properties.capabilities || '',
          timestamp: f.properties.first_seen || f.properties.timestamp,
          last_seen: f.properties.last_seen || f.properties.timestamp,
          device_id: f.properties.device_id,
          source_tag: f.properties.source_tag,
          accuracy: f.properties.accuracy,
          altitude: f.properties.altitude,
          obs_count:
            f.properties.obs_count ||
            f.properties.observation_count ||
            f.properties.observations ||
            0,
          threat_level: f.properties.threat_level,
          threat_score: f.properties.threat_score,
          is_suspicious: f.properties.is_suspicious,
          distance_from_home: f.properties.distance_from_home,
          max_distance_km: f.properties.max_distance_km,
          timespan_days: f.properties.timespan_days,
          unique_days: f.properties.unique_days,
        }));

      // Update counts first
      if (type === 'observations') {
        setActualCounts((prev) => ({
          observations: processedData.length,
          networks: prev?.networks || 0,
        }));
      } else {
        setActualCounts((prev) => ({
          observations: prev?.observations || 0,
          networks: processedData.length,
        }));
      }

      // Reinitialize deck if needed
      if (!deckRef.current || !window.deck) {
        await Promise.all([
          loadCss('https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css'),
          loadScript('https://cdn.jsdelivr.net/npm/deck.gl@8.9.0/dist.min.js'),
          loadScript('https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'),
        ]);
        try {
          initDeck(tokenData.token, processedData);
        } catch (initError) {
          throw new Error('Kepler failed to initialize. Check console.');
        }
      }

      // Set network data - useEffect will handle visualization update
      setNetworkData(processedData);
      setLoading(false);
    } catch (err: any) {
      logError('Error loading data', err);
      setError(err?.message || 'Failed to load network data');
      setLoading(false);
    }
  };

  // Stable filter key
  const filterKey = useMemo(() => JSON.stringify(adaptedFilters), [adaptedFilters]);

  // Load scripts once
  useEffect(() => {
    if (scriptsLoadedRef.current) return;

    const setup = async () => {
      try {
        logDebug('[Kepler] Loading scripts...');
        await Promise.all([
          loadCss('https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css'),
          loadScript('https://cdn.jsdelivr.net/npm/deck.gl@8.9.0/dist.min.js'),
          loadScript('https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'),
        ]);
        scriptsLoadedRef.current = true;
        logDebug('[Kepler] Scripts loaded');
        // Trigger data load after scripts are ready
        if (window.deck && window.mapboxgl) {
          loadData(datasetType);
        }
      } catch (err: any) {
        logError('Error loading scripts', err);
        setError('Failed to load required libraries');
      }
    };

    setup();
  }, []); // Only once

  // Load data when filters/dataset change (but only if scripts are ready)
  useEffect(() => {
    if (!scriptsLoadedRef.current || !window.deck || !window.mapboxgl) {
      return;
    }

    logDebug(`[Kepler] Loading data, filterKey: ${filterKey.substring(0, 100)}`);
    loadData(datasetType);
  }, [datasetType, filterKey]); // Stable dependencies

  // Update visualization when data or settings change
  useEffect(() => {
    if (deckRef.current && networkData.length > 0) {
      logDebug(`[Kepler] Updating visualization with ${networkData.length} points`);
      updateVisualization();
    }
  }, [networkData, layerType, pointSize, signalThreshold, height3d]);

  // Update pitch and controller
  useEffect(() => {
    if (deckRef.current) {
      deckRef.current.setProps({
        initialViewState: {
          ...deckRef.current.props.initialViewState,
          pitch: pitch,
        },
        controller: drawMode === 'none',
      });
    }
  }, [pitch, drawMode]);

  const filteredCount = networkData.filter((d) => d.signal >= signalThreshold).length;

  return (
    <div className="h-screen w-full text-white flex min-h-0">
      <HamburgerButton isOpen={showMenu} onClick={() => setShowMenu(!showMenu)} />

      <ControlPanel
        isOpen={showMenu}
        onShowFilters={() => setShowFilters(!showFilters)}
        showFilters={showFilters}
      >
        <div>
          <label className="block mb-1 text-xs text-slate-300">Dataset:</label>
          <label className="sr-only" htmlFor="dataset-select">
            Dataset
          </label>
          <select
            id="dataset-select"
            value={datasetType}
            onChange={(e) => setDatasetType(e.target.value as 'observations' | 'networks')}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs"
          >
            <option value="observations">
              Observations ({actualCounts ? actualCounts.observations.toLocaleString() : '416K'}{' '}
              raw)
            </option>
            <option value="networks">
              Networks ({actualCounts ? actualCounts.networks.toLocaleString() : '117K'}{' '}
              trilaterated)
            </option>
          </select>
        </div>

        <div>
          <label className="block mb-1 text-xs text-slate-300">3D View - Pitch: {pitch}°</label>
          <label className="sr-only" htmlFor="pitch-slider">
            3D view pitch
          </label>
          <input
            id="pitch-slider"
            type="range"
            min="0"
            max="60"
            value={pitch}
            onChange={(e) => setPitch(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block mb-1 text-xs text-slate-300">3D Height: {height3d}</label>
          <label className="sr-only" htmlFor="height-3d-slider">
            3D height
          </label>
          <input
            id="height-3d-slider"
            type="range"
            min="1"
            max="50"
            value={height3d}
            onChange={(e) => setHeight3d(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block mb-1 text-xs text-slate-300">Visualization Type:</label>
          <label className="sr-only" htmlFor="render-mode-select">
            Render mode
          </label>
          <select
            id="render-mode-select"
            value={layerType}
            onChange={(e) => setLayerType(e.target.value as LayerType)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs"
          >
            <option value="scatterplot">Points</option>
            <option value="heatmap">Heatmap</option>
            <option value="hexagon">Hexagon Clusters</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 text-xs text-slate-300">Point Size: {pointSize}</label>
          <label className="sr-only" htmlFor="point-size-slider">
            Point size
          </label>
          <input
            id="point-size-slider"
            type="range"
            min="0.1"
            max="10"
            step="0.1"
            value={pointSize}
            onChange={(e) => setPointSize(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block mb-1 text-xs text-slate-300">Drawing Mode:</label>
          <label className="sr-only" htmlFor="selection-mode-select">
            Selection tool
          </label>
          <select
            id="selection-mode-select"
            value={drawMode}
            onChange={(e) => setDrawMode(e.target.value as DrawMode)}
            className="w-full min-h-[44px] bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-xs"
          >
            <option value="none">None</option>
            <option value="rectangle">Rectangle Select</option>
            <option value="polygon">Polygon Select</option>
            <option value="circle">Circle Select</option>
          </select>
        </div>

        <button
          onClick={clearSelection}
          className="w-full min-h-[44px] px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-xs"
        >
          Clear Selection
        </button>

        <div>
          <label className="block mb-1 text-xs text-slate-300">
            Signal Threshold: {signalThreshold} dBm
          </label>
          <label className="sr-only" htmlFor="signal-threshold-slider">
            Signal threshold (dBm)
          </label>
          <input
            id="signal-threshold-slider"
            type="range"
            min="-100"
            max="-30"
            value={signalThreshold}
            onChange={(e) => setSignalThreshold(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="text-xs pt-3 mt-2 border-t border-blue-500/20 bg-gradient-to-b from-blue-500/5 to-transparent p-3 -mx-5 -mb-5 rounded-b-xl">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">DB Total:</span>
              <span className="text-blue-400 font-semibold">
                {actualCounts ? actualCounts.observations.toLocaleString() : 'Loading...'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Rendered:</span>
              <span className="text-blue-400 font-semibold">
                {filteredCount.toLocaleString()} / {networkData.length.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Selected:</span>
              <span className="text-emerald-400 font-semibold">{selectedPoints.length}</span>
            </div>
            <div className="text-slate-500 text-[10px] mt-2 pt-2 border-t border-slate-700/50">
              ⚡ WebGL • 📍 Interactive • 🔥 GPU Accelerated
            </div>
          </div>
        </div>
      </ControlPanel>

      <KeplerFilterPanel isOpen={showFilters && showMenu} adaptedFilters={adaptedFilters} />

      {/* Map Area */}
      <section className="flex-1 min-h-0 h-full relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-50">
            <div className="px-4 py-3 bg-slate-800 rounded-lg border border-slate-700">
              Loading network data…
            </div>
          </div>
        )}

        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900 text-red-100 px-4 py-2 rounded-lg border border-red-700 z-50">
            {error}
          </div>
        )}

        <div ref={mapRef} className="h-full w-full relative" />
      </section>
    </div>
  );
};

export default KeplerPage;
