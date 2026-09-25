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
      {(
        [
          {
            key: 'layers',
            title: 'Layers',
            active: showMenu,
            toggle: () => setShowMenu((prev) => !prev),
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
            title: 'Filters',
            active: showFilters,
            toggle: () => setShowFilters((prev) => !prev),
            icon: (
              <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                <path d="M1 2h14l-5 6v5l-4-2V8L1 2z" />
              </svg>
            ),
          },
        ] as const
      ).map(({ key, title, active, toggle, icon }) => (
        <button
          key={key}
          aria-label={active ? `Disable ${title}` : `Enable ${title}`}
          onClick={toggle}
          title={title}
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
