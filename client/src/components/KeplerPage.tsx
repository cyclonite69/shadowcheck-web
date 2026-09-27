import { usePageFilters } from '../hooks/usePageFilters';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useFilterURLSync } from '../hooks/useFilterURLSync';
import { useDebouncedAdaptedFilters } from '../hooks/useAdaptedFilters';
import { useKepler } from '../hooks/useKepler';
import { useKeplerDeck } from '../hooks/useKeplerDeck';
import { useKeplerAssets } from '../hooks/useKeplerAssets';
import { getPageCapabilities } from '../utils/filterCapabilities';
import { AppHeader } from './AppHeader';
import { NetworkData, LayerType, DrawMode } from './kepler/types';
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

  const [_selectedPoints, setSelectedPoints] = useState<NetworkData[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
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

  const {
    mapRef,
    deckRef: _deckRef,
    zoom: _zoom,
    setZoom: _setZoom,
    handleFitBounds,
    initDeck,
    tooltipState,
    clearTooltip,
  } = useKeplerDeck({
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
    if (networkData.length === 0 || hasFitRef.current) {
      return;
    }
    // Give initDeck one tick to finish creating the DeckGL instance
    const t = setTimeout(() => {
      handleFitBoundsCallback();
      hasFitRef.current = true;
    }, 150);
    return () => clearTimeout(t);
  }, [networkData, handleFitBoundsCallback]);

  const { scriptError } = useKeplerAssets({
    mapboxToken,
    networkData,
    initDeck,
  });

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
            <button
              aria-label={showMenu ? 'Close layers' : 'Open layers'}
              onClick={() => setShowMenu(!showMenu)}
              title="Layers"
              style={{
                height: '24px',
                width: '28px',
                borderRadius: '5px',
                border: showMenu
                  ? '0.5px solid rgba(59,130,246,0.4)'
                  : '0.5px solid rgba(255,255,255,0.10)',
                background: showMenu ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                color: showMenu ? '#60a5fa' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                <path
                  d="M8 1l7 3.5-7 3.5L1 4.5 8 1zm0 5.5l7 3.5-7 3.5-7-3.5 7-3.5zm0 5l7 3.5-7 3.5-7-3.5 7-3.5z"
                  opacity=".85"
                />
              </svg>
            </button>
            <button
              aria-label="Toggle filters"
              onClick={() => setShowFilters(!showFilters)}
              title="Toggle filters"
              style={
                showFilters
                  ? {
                      width: '30px',
                      height: '30px',
                      borderRadius: '6px',
                      border: '1px solid rgba(59,130,246,0.4)',
                      background: 'rgba(59,130,246,0.16)',
                      color: '#93c5fd',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 6px 20px rgba(59,130,246,0.08)',
                    }
                  : {
                      width: '30px',
                      height: '30px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.25)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }
              }
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="0"
                  y="1"
                  width="14"
                  height="1.2"
                  rx="0.6"
                  fill="currentColor"
                  opacity="0.9"
                />
                <rect
                  x="1"
                  y="4"
                  width="12"
                  height="1.2"
                  rx="0.6"
                  fill="currentColor"
                  opacity="0.8"
                />
                <rect
                  x="2"
                  y="7"
                  width="10"
                  height="1.2"
                  rx="0.6"
                  fill="currentColor"
                  opacity="0.7"
                />
                <rect
                  x="3"
                  y="10"
                  width="8"
                  height="1.2"
                  rx="0.6"
                  fill="currentColor"
                  opacity="0.6"
                />
                <rect
                  x="4"
                  y="12"
                  width="6"
                  height="1.2"
                  rx="0.6"
                  fill="currentColor"
                  opacity="0.5"
                />
              </svg>
            </button>
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
