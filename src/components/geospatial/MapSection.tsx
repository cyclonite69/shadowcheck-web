import React from 'react';
import type mapboxgl from 'mapbox-gl';
import { MapPanel } from './MapPanel';
import { ResizeHandle } from './ResizeHandle';

interface MapSectionProps {
  mapHeight: number;
  title: string;
  toolbar: React.ReactNode;
  mapReady: boolean;
  mapError: string | null;
  embeddedView: boolean;
  mapRef: React.MutableRefObject<mapboxgl.Map | null>;
  mapContainerRef: React.RefObject<HTMLDivElement>;
  onResizeMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export const MapSection = ({
  mapHeight,
  title,
  toolbar,
  mapReady,
  mapError,
  embeddedView,
  mapRef,
  mapContainerRef,
  onResizeMouseDown,
}: MapSectionProps) => {
  return (
    <>
      <MapPanel
        mapHeight={mapHeight}
        title={title}
        toolbar={toolbar}
        mapReady={mapReady}
        mapError={mapError}
        embeddedView={embeddedView}
        mapRef={mapRef}
        mapContainerRef={mapContainerRef}
      />
      <ResizeHandle onMouseDown={onResizeMouseDown} />
    </>
  );
};
