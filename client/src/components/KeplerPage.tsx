import { usePageFilters } from '../hooks/usePageFilters';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useFilterURLSync } from '../hooks/useFilteredData';
import { useAdaptedFilters } from '../hooks/useAdaptedFilters';
import { useKepler } from '../hooks/useKepler';
import { getPageCapabilities } from '../utils/filterCapabilities';
import { logDebug, logError, logWarn } from '../logging/clientLogger';
import { HamburgerButton } from './HamburgerButton';
import { ControlPanel } from './ControlPanel';
import { FilterPanelContainer } from './FilterPanelContainer';
import { renderNetworkTooltip } from '../utils/geospatial/renderNetworkTooltip';

import { formatSecurity } from '../utils/wigle';
import { NetworkData, LayerType, DrawMode } from './kepler/types';
import { loadScript, loadCss } from './kepler/utils';

declare global {
  interface Window {
    deck?: any;
    mapboxgl?: any;
  }
}

const KeplerPage: React.FC = () => {
  // Set current page for filter scoping
  usePageFilters('kepler');

  const mapRef = useRef<HTMLDivElement | null>(null);
  const deckRef = useRef<any>(null);
  const scriptsLoadedRef = useRef<boolean>(false);
  const [selectedPoints, setSelectedPoints] = useState<NetworkData[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

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

  // Load data using hook
  const { loading, error, networkData, mapboxToken, actualCounts } = useKepler(
    adaptedFilters,
    datasetType
  );

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
            .then(async ({ attachMapOrientationControls }) => {
              await attachMapOrientationControls(mapboxMap, {
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

  // Load scripts once and initialize deck when data is ready
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
      } catch (err: any) {
        logError('Error loading scripts', err);
        setScriptError('Failed to load required libraries');
      }
    };

    setup();
  }, []); // Only once

  // Initialize deck when data is ready
  useEffect(() => {
    if (!scriptsLoadedRef.current || !window.deck || !window.mapboxgl) {
      return;
    }

    if (networkData.length > 0 && mapboxToken && !deckRef.current) {
      logDebug(`[Kepler] Initializing deck with ${networkData.length} points`);
      initDeck(mapboxToken, networkData);
    }
  }, [networkData, mapboxToken]);

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

      <FilterPanelContainer
        isOpen={showFilters && showMenu}
        adaptedFilters={adaptedFilters}
        position="overlay"
      />

      {/* Map Area */}
      <section className="flex-1 min-h-0 h-full relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-50">
            <div className="px-4 py-3 bg-slate-800 rounded-lg border border-slate-700">
              Loading network data…
            </div>
          </div>
        )}

        {(error || scriptError) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900 text-red-100 px-4 py-2 rounded-lg border border-red-700 z-50">
            {error || scriptError}
          </div>
        )}

        <div ref={mapRef} className="h-full w-full relative" />
      </section>
    </div>
  );
};

export default KeplerPage;
