import React from 'react';
import type { Map } from 'mapbox-gl';
import { MapPanel } from './MapPanel';
import { ResizeHandle } from './ResizeHandle';

interface MapSectionProps {
  mapHeight: number;
  title: string;
  toolbar: React.ReactNode;
  mapReady: boolean;
  mapError: string | null;
  embeddedView: 'street-view' | 'earth' | null;
  mapRef: React.MutableRefObject<Map | null>;
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
  onResizeMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onOpenContextMenu: (e: React.MouseEvent, network: any) => void;
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
  onOpenContextMenu,
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
        onOpenContextMenu={onOpenContextMenu}
      />
      <ResizeHandle onMouseDown={onResizeMouseDown} />
    </>
  );
};
