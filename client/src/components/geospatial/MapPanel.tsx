import React from 'react';
import type { Map } from 'mapbox-gl';
import { MapHeader } from './MapHeader';
import { MapViewport } from './MapViewport';

interface MapPanelProps {
  mapHeight: number;
  title: string;
  toolbar: React.ReactNode;
  mapReady: boolean;
  mapError: string | null;
  embeddedView: 'street-view' | 'earth' | null;
  mapRef: React.MutableRefObject<Map | null>;
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
}

export const MapPanel = ({
  mapHeight,
  title,
  toolbar,
  mapReady,
  mapError,
  embeddedView,
  mapRef,
  mapContainerRef,
}: MapPanelProps) => {
  return (
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
      <MapHeader title={title} toolbar={toolbar} />
      <MapViewport
        mapReady={mapReady}
        mapError={mapError}
        embeddedView={embeddedView}
        mapRef={mapRef}
        mapContainerRef={mapContainerRef}
      />
    </div>
  );
};
