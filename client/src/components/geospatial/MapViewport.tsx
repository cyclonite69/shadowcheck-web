import React from 'react';

interface MapViewportProps {
  mapReady: boolean;
  mapError: string | null;
  embeddedView: 'street-view' | 'earth' | null;
  mapRef: React.MutableRefObject<any>;
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
}

export const MapViewport = ({
  mapReady,
  mapError,
  embeddedView,
  mapRef,
  mapContainerRef,
}: MapViewportProps) => {
  return (
    <div className="relative" style={{ height: 'calc(100% - 49px)' }}>
      {!mapReady && !mapError && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: '#cbd5e1', background: 'rgba(30, 41, 59, 0.8)' }}
        >
          Loading map...
        </div>
      )}
      {mapError && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: '#f87171', background: 'rgba(30, 41, 59, 0.8)' }}
        >
          {mapError}
        </div>
      )}

      {/* Embedded Google Street View */}
      {embeddedView === 'street-view' && mapRef.current && (
        <iframe
          src={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${(mapRef.current as any).getCenter().lat},${(mapRef.current as any).getCenter().lng}`}
          className="w-full h-full"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}

      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{
          background: 'rgba(30, 41, 59, 0.8)',
          display: embeddedView ? 'none' : 'block',
        }}
      />
    </div>
  );
};
