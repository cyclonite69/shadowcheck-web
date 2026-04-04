import React, { useEffect } from 'react';
import { NetworkData, LayerType, DrawMode } from './types';

interface KeplerVisualizationProps {
  mapRef: React.RefObject<HTMLDivElement | null>;
  mapboxToken: string;
  networkData: NetworkData[];
  layerType: LayerType;
  pointSize: number;
  signalThreshold: number;
  pitch: number;
  height3d: number;
  drawMode: DrawMode;
  onSelectPoints: (points: NetworkData[]) => void;
  initDeck: (token: string, data: NetworkData[]) => void;
  tooltipState: { x: number; y: number; html: string; pinned: boolean } | null;
  onClearTooltip: () => void;
}

export const KeplerVisualization: React.FC<KeplerVisualizationProps> = ({
  mapRef,
  mapboxToken,
  networkData,
  layerType,
  pointSize,
  signalThreshold,
  pitch,
  height3d,
  drawMode,
  onSelectPoints,
  initDeck,
  tooltipState,
  onClearTooltip,
}) => {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  useEffect(() => {
    if (mapboxToken && networkData.length > 0) {
      initDeck(mapboxToken, networkData);
    }
  }, [
    mapboxToken,
    networkData,
    layerType,
    pointSize,
    signalThreshold,
    pitch,
    height3d,
    drawMode,
    initDeck,
  ]);

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
      <div ref={mapRef} className="absolute inset-0 w-full h-full" />
      {tooltipState && (
        <div
          className="absolute z-20 max-w-[min(340px,90vw)]"
          style={{
            left: `${Math.max(16, Math.min(tooltipState.x + 12, viewportWidth - 360))}px`,
            top: `${Math.max(16, Math.min(tooltipState.y + 12, viewportHeight - 320))}px`,
          }}
        >
          <div className="relative rounded-lg border border-slate-700 bg-slate-950 shadow-2xl">
            {tooltipState.pinned && (
              <button
                type="button"
                onClick={onClearTooltip}
                className="absolute right-2 top-2 z-10 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              >
                Close
              </button>
            )}
            <div dangerouslySetInnerHTML={{ __html: tooltipState.html }} />
          </div>
        </div>
      )}
    </div>
  );
};
