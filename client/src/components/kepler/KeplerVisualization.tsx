import React, { useRef, useEffect } from 'react';
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
}) => {
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
    </div>
  );
};
