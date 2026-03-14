import { usePageFilters } from '../hooks/usePageFilters';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useFilterURLSync } from '../hooks/useFilterURLSync';
import { useDebouncedAdaptedFilters } from '../hooks/useAdaptedFilters';
import { useKepler } from '../hooks/useKepler';
import { getPageCapabilities } from '../utils/filterCapabilities';
import { logDebug, logError } from '../logging/clientLogger';
import { HamburgerButton } from './HamburgerButton';
import { renderNetworkTooltip } from '../utils/geospatial/renderNetworkTooltip';
import { normalizeTooltipData } from '../utils/geospatial/tooltipDataNormalizer';
import { NetworkData, LayerType, DrawMode } from './kepler/types';
import { loadScript, loadCss } from './kepler/utils';
import { KeplerVisualization } from './kepler/KeplerVisualization';
import { KeplerControls } from './kepler/KeplerControls';
import { KeplerFilters } from './kepler/KeplerFilters';

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
  const [showMenu, setShowMenu] = useState(true);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // Universal filter system
  const capabilities = useMemo(() => getPageCapabilities('kepler'), []);
  const adaptedFilters = useDebouncedAdaptedFilters(capabilities, 700);
  useFilterURLSync();

  // Control State
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

  const initDeck = useCallback(
    (token: string, data: NetworkData[]) => {
      if (!window.deck || !mapRef.current) return;

      let centerLon = -83.6968; // Default
      let centerLat = 43.0234;
      let zoom = 10;

      if (data && data.length > 0) {
        const validData = data.filter((d) => d.position && !isNaN(d.position[0]));
        if (validData.length > 0) {
          let minLon = Infinity,
            maxLon = -Infinity,
            minLat = Infinity,
            maxLat = -Infinity;
          for (const d of validData) {
            const [lon, lat] = d.position;
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }
          centerLon = (minLon + maxLon) / 2;
          centerLat = (minLat + maxLat) / 2;
          const maxDiff = Math.max(maxLon - minLon, maxLat - minLat, 0.01);
          zoom = Math.max(1, Math.min(15, 10 - Math.log2(maxDiff)));
        }
      }

      const INITIAL_VIEW_STATE = {
        longitude: centerLon,
        latitude: centerLat,
        zoom,
        pitch,
        bearing: 0,
      };

      const layers = [];
      if (layerType === 'scatterplot') {
        layers.push(
          new window.deck.ScatterplotLayer({
            id: 'points',
            data,
            getPosition: (d: NetworkData) => d.position,
            getFillColor: (d: NetworkData) => d.color || [0, 128, 255, 200],
            getRadius: pointSize * 50,
            pickable: true,
            autoHighlight: true,
          })
        );
      } else if (layerType === 'heatmap') {
        layers.push(
          new window.deck.HeatmapLayer({
            id: 'heatmap',
            data,
            getPosition: (d: NetworkData) => d.position,
            getWeight: (d: NetworkData) => (d.signal ? (d.signal + 120) / 120 : 0.5),
            radiusPixels: pointSize * 100,
          })
        );
      }

      if (deckRef.current) {
        deckRef.current.setProps({ layers, initialViewState: INITIAL_VIEW_STATE });
      } else {
        deckRef.current = new window.deck.DeckGL({
          container: mapRef.current,
          initialViewState: INITIAL_VIEW_STATE,
          controller: true,
          mapStyle: 'mapbox://styles/mapbox/dark-v11',
          mapboxApiAccessToken: token,
          layers,
          getTooltip: ({ object }: any) => {
            if (!object) return null;
            const normalized = normalizeTooltipData(object);
            return {
              html: renderNetworkTooltip(normalized),
              style: {
                backgroundColor: '#0f172a',
                color: '#f8fafc',
                padding: '12px',
                borderRadius: '8px',
              },
            };
          },
        });
      }
    },
    [layerType, pointSize, pitch]
  );

  useEffect(() => {
    if (scriptsLoadedRef.current) return;
    const loadAssets = async () => {
      try {
        await Promise.all([
          loadCss('https://api.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.css'),
          loadScript('https://unpkg.com/deck.gl@latest/dist.min.js'),
          loadScript('https://api.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.js'),
        ]);
        scriptsLoadedRef.current = true;
        if (mapboxToken && networkData.length > 0) initDeck(mapboxToken, networkData);
      } catch (err) {
        setScriptError('Failed to load map engine.');
        logError('DeckGL scripts fail', err);
      }
    };
    loadAssets();
  }, [mapboxToken, networkData, initDeck]);

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden">
      <KeplerVisualization
        mapRef={mapRef}
        mapboxToken={mapboxToken}
        networkData={networkData}
        layerType={layerType}
        pointSize={pointSize}
        signalThreshold={signalThreshold}
        pitch={pitch}
        height3d={height3d}
        drawMode={drawMode}
        onSelectPoints={setSelectedPoints}
        initDeck={initDeck}
      />

      <HamburgerButton isOpen={showMenu} onClick={() => setShowMenu(!showMenu)} />

      <KeplerControls
        showMenu={showMenu}
        onShowFilters={() => setShowFilters(!showFilters)}
        showFilters={showFilters}
        layerType={layerType}
        setLayerType={setLayerType}
        pointSize={pointSize}
        setPointSize={setPointSize}
        signalThreshold={signalThreshold}
        setSignalThreshold={setSignalThreshold}
        pitch={pitch}
        setPitch={setPitch}
        height3d={height3d}
        setHeight3d={setHeight3d}
        drawMode={drawMode}
        setDrawMode={setDrawMode}
        datasetType={datasetType}
        setDatasetType={setDatasetType}
        loading={loading}
        error={error}
        actualCounts={actualCounts}
      />

      <KeplerFilters showFilters={showFilters} />

      {scriptError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-50">
          <div className="bg-slate-900 border border-red-500/50 p-8 rounded-2xl shadow-2xl max-w-md text-center">
            <h2 className="text-xl font-bold text-red-400 mb-2">Engine Error</h2>
            <p className="text-slate-400">{scriptError}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeplerPage;
