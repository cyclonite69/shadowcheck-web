import React from 'react';

interface MapStyleOption {
  value: string;
  label: string;
}

interface MapToolbarProps {
  searchContainerRef?: React.RefObject<HTMLDivElement>;
  locationSearch: string;
  onLocationSearchChange: (value: string) => void;
  onLocationSearchFocus: () => void;
  searchingLocation: boolean;
  showSearchResults: boolean;
  searchResults: any[];
  onSelectSearchResult: (result: any) => void;
  searchPlaceholder?: string;
  mapStyle: string;
  onMapStyleChange: (value: string) => void;
  mapStyles: MapStyleOption[];
  show3DBuildings: boolean;
  onToggle3DBuildings: () => void;
  showTerrain: boolean;
  onToggleTerrain: () => void;
  fitButtonActive: boolean;
  canFit: boolean;
  onFit: () => void;
  homeButtonActive: boolean;
  onHome: () => void;
  onGps: () => void;
}

export const MapToolbar = ({
  searchContainerRef,
  locationSearch,
  onLocationSearchChange,
  onLocationSearchFocus,
  searchingLocation,
  showSearchResults,
  searchResults,
  onSelectSearchResult,
  searchPlaceholder = '🔍 Search worldwide locations...',
  mapStyle,
  onMapStyleChange,
  mapStyles,
  show3DBuildings,
  onToggle3DBuildings,
  showTerrain,
  onToggleTerrain,
  fitButtonActive,
  canFit,
  onFit,
  homeButtonActive,
  onHome,
  onGps,
}: MapToolbarProps) => {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      style={{
        fontSize: '11px',
      }}
    >
      <div
        ref={searchContainerRef}
        style={{ position: 'relative', minWidth: '300px', flex: '1 1 300px' }}
      >
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={locationSearch}
          onChange={(e) => onLocationSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 10px',
            fontSize: '11px',
            background: 'rgba(30, 41, 59, 0.9)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '4px',
            color: '#f1f5f9',
            outline: 'none',
          }}
          onFocus={onLocationSearchFocus}
        />
        {searchingLocation && (
          <div
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#60a5fa',
              fontSize: '10px',
            }}
          >
            ⏳
          </div>
        )}
        {showSearchResults && searchResults.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              background: 'rgba(30, 41, 59, 0.98)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '6px',
              maxHeight: '300px',
              overflowY: 'auto',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
            }}
          >
            {searchResults.map((result, index) => (
              <div
                key={index}
                onClick={() => onSelectSearchResult(result)}
                style={{
                  padding: '8px 10px',
                  cursor: 'pointer',
                  borderBottom:
                    index < searchResults.length - 1
                      ? '1px solid rgba(148, 163, 184, 0.1)'
                      : 'none',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#f1f5f9' }}>
                  {result.text}
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                  {result.place_name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="sr-only" htmlFor="map-style">
        Map style
      </label>
      <select
        id="map-style"
        value={mapStyle}
        onChange={(e) => onMapStyleChange(e.target.value)}
        style={{
          padding: '6px 10px',
          fontSize: '11px',
          background: 'rgba(30, 41, 59, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          color: '#f8fafc',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        {mapStyles.map((style) => (
          <option key={style.value} value={style.value}>
            {style.label}
          </option>
        ))}
      </select>
      <button
        onClick={onToggle3DBuildings}
        style={{
          padding: '6px 10px',
          fontSize: '11px',
          background: show3DBuildings ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.9)',
          border: show3DBuildings
            ? '1px solid rgba(59, 130, 246, 0.5)'
            : '1px solid rgba(148, 163, 184, 0.2)',
          color: show3DBuildings ? '#60a5fa' : '#cbd5e1',
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          fontWeight: show3DBuildings ? '600' : '400',
        }}
      >
        🏢 3D Buildings
      </button>
      <button
        onClick={onToggleTerrain}
        style={{
          padding: '6px 10px',
          fontSize: '11px',
          background: showTerrain ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.9)',
          border: showTerrain
            ? '1px solid rgba(59, 130, 246, 0.5)'
            : '1px solid rgba(148, 163, 184, 0.2)',
          color: showTerrain ? '#60a5fa' : '#cbd5e1',
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          fontWeight: showTerrain ? '600' : '400',
        }}
      >
        ⛰️ Terrain
      </button>
      <button
        onClick={onFit}
        style={{
          padding: '6px 10px',
          fontSize: '11px',
          background:
            fitButtonActive || canFit ? 'rgba(59, 130, 246, 0.9)' : 'rgba(30, 41, 59, 0.9)',
          border:
            fitButtonActive || canFit ? '1px solid #3b82f6' : '1px solid rgba(148, 163, 184, 0.2)',
          color: fitButtonActive || canFit ? '#ffffff' : '#cbd5e1',
          borderRadius: '4px',
          cursor: canFit ? 'pointer' : 'not-allowed',
          opacity: canFit ? 1 : 0.5,
        }}
        disabled={!canFit}
      >
        🎯 Fit
      </button>
      <button
        onClick={onHome}
        style={{
          padding: '6px 10px',
          fontSize: '11px',
          background: homeButtonActive ? 'rgba(16, 185, 129, 0.9)' : 'rgba(30, 41, 59, 0.9)',
          border: homeButtonActive ? '1px solid #10b981' : '1px solid rgba(148, 163, 184, 0.2)',
          color: homeButtonActive ? '#ffffff' : '#cbd5e1',
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
        }}
      >
        🏠 Home
      </button>
      <button
        onClick={onGps}
        style={{
          padding: '6px 10px',
          fontSize: '11px',
          background: 'rgba(30, 41, 59, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          color: '#cbd5e1',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        📍 GPS
      </button>
    </div>
  );
};
