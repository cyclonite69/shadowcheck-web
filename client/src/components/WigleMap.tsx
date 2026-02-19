import React from 'react';

interface WigleMapProps {
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
  error: string | null;
  mapReady: boolean;
}

export const WigleMap: React.FC<WigleMapProps> = ({ mapContainerRef, error, mapReady }) => {
  return (
    <div
      className="flex-1"
      style={{
        minHeight: '100vh',
        background: '#0b1220',
        position: 'relative',
      }}
    >
      <div ref={mapContainerRef} className="absolute inset-0" />
      {!mapReady && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: '12px',
            pointerEvents: 'none',
          }}
        >
          Loading map…
        </div>
      )}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/20 text-red-300 px-4 py-2 rounded-lg border border-red-500/30 z-50 text-sm backdrop-blur-sm">
          {error}
        </div>
      )}
    </div>
  );
};
