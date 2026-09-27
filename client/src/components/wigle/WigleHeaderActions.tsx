import React from 'react';
import type { Map } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { fitBoundsWithZoomInset } from '../../utils/geospatial/mapViewUtils';

export interface WigleHeaderActionsProps {
  showMenu: boolean;
  setShowMenu: React.Dispatch<React.SetStateAction<boolean>>;
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  v2Rows: any[];
  v3Rows: any[];
  mapRef: React.RefObject<Map | null>;
  mapboxRef: React.RefObject<typeof mapboxglType | null>;
  homeLocation: { center: [number, number]; radius: number };
}

export const WigleHeaderActions: React.FC<WigleHeaderActionsProps> = ({
  showMenu,
  setShowMenu,
  showFilters,
  setShowFilters,
  v2Rows,
  v3Rows,
  mapRef,
  mapboxRef,
  homeLocation,
}) => {
  const hasRows = v2Rows.length > 0 || v3Rows.length > 0;

  return (
    <>
      <button
        aria-label={showMenu ? 'Disable Layers' : 'Enable Layers'}
        onClick={() => setShowMenu((prev) => !prev)}
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
        onClick={() => setShowFilters((prev) => !prev)}
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
          <rect x="0" y="1" width="14" height="1.2" rx="0.6" fill="currentColor" opacity="0.9" />
          <rect x="1" y="4" width="12" height="1.2" rx="0.6" fill="currentColor" opacity="0.8" />
          <rect x="2" y="7" width="10" height="1.2" rx="0.6" fill="currentColor" opacity="0.7" />
          <rect x="3" y="10" width="8" height="1.2" rx="0.6" fill="currentColor" opacity="0.6" />
          <rect x="4" y="12" width="6" height="1.2" rx="0.6" fill="currentColor" opacity="0.5" />
        </svg>
      </button>
      {/* Fit to bounds */}
      <button
        className="nav-icon-btn"
        title="Fit to bounds"
        disabled={!hasRows}
        onClick={() => {
          const mapboxgl = mapboxRef.current;
          if (!mapRef.current || !mapboxgl) {
            return;
          }
          const allRows = [...v2Rows, ...v3Rows];
          const coords = allRows
            .map((r: any) => {
              const lat = r.trilat ?? r.lat ?? r.latitude;
              const lon = r.trilong ?? r.trilon ?? r.lon ?? r.longitude;
              return lat !== null && lat !== undefined && lon !== null && lon !== undefined
                ? ([lon, lat] as [number, number])
                : null;
            })
            .filter((c): c is [number, number] => c !== null);
          if (coords.length === 0) {
            return;
          }
          const bounds = coords.reduce(
            (b, c) => b.extend(c),
            new (mapboxgl as any).LngLatBounds(coords[0], coords[0])
          );
          fitBoundsWithZoomInset(mapRef.current, bounds, { padding: 80 });
        }}
        style={{
          height: '24px',
          width: '28px',
          borderRadius: '5px',
          border: '0.5px solid rgba(255,255,255,0.10)',
          background: 'rgba(255,255,255,0.03)',
          color: !hasRows ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.4)',
          cursor: !hasRows ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: !hasRows ? 0.4 : 1,
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <polyline points="1,4 1,1 4,1" />
          <polyline points="10,1 13,1 13,4" />
          <polyline points="13,10 13,13 10,13" />
          <polyline points="4,13 1,13 1,10" />
        </svg>
      </button>
      {/* Fly home */}
      <button
        className="nav-icon-btn"
        title="Fly home"
        onClick={() => {
          if (!mapRef.current) {
            return;
          }
          mapRef.current.flyTo({ center: homeLocation.center, zoom: 17 });
        }}
        style={{
          height: '24px',
          width: '28px',
          borderRadius: '5px',
          border: '0.5px solid rgba(255,255,255,0.10)',
          background: 'rgba(255,255,255,0.03)',
          color: 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 7L7 2L12 7" />
          <path d="M3 7V12H6V9H8V12H11V7" />
        </svg>
      </button>
    </>
  );
};
