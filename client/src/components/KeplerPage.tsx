import { usePageFilters } from '../hooks/usePageFilters';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useFilterURLSync } from '../hooks/useFilterURLSync';
import { useDebouncedAdaptedFilters } from '../hooks/useAdaptedFilters';
import { useKepler } from '../hooks/useKepler';
import { useKeplerDeck } from '../hooks/useKeplerDeck';
import { getPageCapabilities } from '../utils/filterCapabilities';
import { logError } from '../logging/clientLogger';
import { AppHeader } from './AppHeader';
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

  const scriptsLoadedRef = React.useRef<boolean>(false);
  const [selectedPoints, setSelectedPoints] = useState<NetworkData[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 960 : false
  );

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

  const { mapRef, deckRef, zoom, setZoom, handleFitBounds, initDeck, tooltipState, clearTooltip } =
    useKeplerDeck({
      layerType,
      pointSize,
      pitch,
      height3d,
    });

  const handleFitBoundsCallback = useCallback(
    () => handleFitBounds(networkData),
    [handleFitBounds, networkData]
  );

  // Auto-fit viewport once when data first loads. Uses a one-shot ref so
  // subsequent filter-driven reloads don't override the user's pan/zoom.
  const hasFitRef = React.useRef(false);
  useEffect(() => {
    if (networkData.length === 0 || hasFitRef.current) return;
    // Give initDeck one tick to finish creating the DeckGL instance
    const t = setTimeout(() => {
      handleFitBoundsCallback();
      hasFitRef.current = true;
    }, 150);
    return () => clearTimeout(t);
  }, [networkData, handleFitBoundsCallback]);

  useEffect(() => {
    if (scriptsLoadedRef.current) return;
    const loadAssets = async () => {
      try {
        await Promise.all([
          loadCss('https://api.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.css'),
          loadScript('https://cdn.jsdelivr.net/npm/deck.gl@latest/dist.min.js'),
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

  useEffect(() => {
    const updateViewportMode = () => {
      setIsMobile(window.innerWidth < 960);
    };

    updateViewportMode();
    window.addEventListener('resize', updateViewportMode);
    return () => window.removeEventListener('resize', updateViewportMode);
  }, []);

  return (
    <div className="relative w-full h-[calc(100vh-48px)] mt-[48px] bg-slate-950 overflow-hidden">
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
        tooltipState={tooltipState}
        onClearTooltip={clearTooltip}
      />

      <AppHeader
        pageLabel="Kepler"
        afterLabel={
          <>
            {(
              [
                {
                  key: 'layers',
                  active: showMenu,
                  toggle: () => setShowMenu(!showMenu),
                  icon: (
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                      <path
                        d="M8 1l7 3.5-7 3.5L1 4.5 8 1zm0 5.5l7 3.5-7 3.5-7-3.5 7-3.5zm0 5l7 3.5-7 3.5-7-3.5 7-3.5z"
                        opacity=".85"
                      />
                    </svg>
                  ),
                },
                {
                  key: 'filters',
                  active: showFilters,
                  toggle: () => setShowFilters(!showFilters),
                  icon: (
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                      <path d="M1 2h14l-5 6v5l-4-2V8L1 2z" />
                    </svg>
                  ),
                },
              ] as const
            ).map(({ key, active, toggle, icon }) => (
              <button
                key={key}
                aria-label={active ? `Close ${key}` : `Open ${key}`}
                onClick={toggle}
                title={key.charAt(0).toUpperCase() + key.slice(1)}
                style={{
                  height: '24px',
                  width: '28px',
                  borderRadius: '5px',
                  border: active
                    ? '0.5px solid rgba(59,130,246,0.4)'
                    : '0.5px solid rgba(255,255,255,0.10)',
                  background: active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                  color: active ? '#60a5fa' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {icon}
              </button>
            ))}
          </>
        }
      />

      <KeplerControls
        showMenu={showMenu}
        className={
          isMobile
            ? '!left-3 !right-3 !w-auto !max-h-[calc(100vh-92px)] !rounded-2xl !p-4'
            : undefined
        }
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
        onFitBounds={handleFitBoundsCallback}
      />

      <KeplerFilters
        showFilters={showFilters}
        className={
          isMobile
            ? '!left-3 !right-3 !top-[4.5rem] !w-auto !max-h-[calc(100vh-100px)]'
            : !showMenu
              ? '!left-4'
              : ''
        }
      />

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
