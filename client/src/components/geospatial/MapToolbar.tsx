import React from 'react';

interface MapStyleOption {
  value: string;
  label: string;
}

type SearchMode = 'address' | 'directions';

interface MapToolbarProps {
  searchContainerRef?: React.RefObject<HTMLDivElement | null>;
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
  is3DBuildingsAvailable: boolean;
  onToggle3DBuildings: () => void;
  showTerrain: boolean;
  onToggleTerrain: () => void;
  fitButtonActive: boolean;
  canFit: boolean;
  onFit: () => void;
  homeButtonActive: boolean;
  onHome: () => void;
  onGps: () => void;
  // WiGLE observations
  canWigle?: boolean;
  wigleLoading?: boolean;
  wigleActive?: boolean;
  selectedCount?: number;
  onWigle?: () => void;
  // Directions mode
  searchMode?: SearchMode;
  onSearchModeToggle?: () => void;
  directionsLoading?: boolean;
  // Agencies panel
  showAgenciesPanel?: boolean;
  onToggleAgenciesPanel?: () => void;
  // Courthouses panel
  showCourthousesPanel?: boolean;
  onToggleCourthousesPanel?: () => void;
  // Network summaries
  showNetworkSummaries?: boolean;
  onToggleNetworkSummaries?: (value: boolean) => void;
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
  is3DBuildingsAvailable,
  onToggle3DBuildings,
  showTerrain,
  onToggleTerrain,
  fitButtonActive,
  canFit,
  onFit,
  homeButtonActive,
  onHome,
  onGps,
  canWigle,
  wigleLoading,
  wigleActive,
  selectedCount,
  onWigle,
  searchMode,
  onSearchModeToggle,
  directionsLoading,
  showAgenciesPanel,
  onToggleAgenciesPanel,
  showCourthousesPanel,
  onToggleCourthousesPanel,
  showNetworkSummaries = false,
  onToggleNetworkSummaries,
}: MapToolbarProps) => {
  return (
    <div
      className="flex items-center gap-2"
      style={{
        fontSize: '11px',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <div
        ref={searchContainerRef}
        style={{
          position: 'relative',
          minWidth: '280px',
          flex: '1 1 280px',
          minHeight: '32px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            placeholder={
              searchMode === 'directions' ? '🛣️ Search destination for route...' : searchPlaceholder
            }
            value={locationSearch}
            onChange={(e) => onLocationSearchChange(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: '11px',
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: onSearchModeToggle ? '4px 0 0 4px' : '4px',
              color: '#f1f5f9',
              outline: 'none',
            }}
            onFocus={onLocationSearchFocus}
          />
          {onSearchModeToggle && (
            <button
              onClick={onSearchModeToggle}
              title={
                searchMode === 'address' ? 'Switch to Directions mode' : 'Switch to Address mode'
              }
              style={{
                padding: '6px 8px',
                fontSize: '11px',
                background:
                  searchMode === 'directions' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(30, 41, 59, 0.9)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderLeft: 'none',
                borderRadius: '0 4px 4px 0',
                color: searchMode === 'directions' ? '#60a5fa' : '#cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.2s',
                lineHeight: 1,
              }}
            >
              {directionsLoading ? '⏳' : searchMode === 'address' ? '📍' : '🛣️'}
            </button>
          )}
        </div>
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
        disabled={!is3DBuildingsAvailable}
        title={
          is3DBuildingsAvailable ? 'Toggle 3D buildings' : '3D buildings unavailable for this style'
        }
        style={{
          padding: '6px 10px',
          fontSize: '11px',
          background: show3DBuildings ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.9)',
          border: show3DBuildings
            ? '1px solid rgba(59, 130, 246, 0.5)'
            : '1px solid rgba(148, 163, 184, 0.2)',
          color: !is3DBuildingsAvailable ? '#64748b' : show3DBuildings ? '#60a5fa' : '#cbd5e1',
          borderRadius: '4px',
          cursor: is3DBuildingsAvailable ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
          fontWeight: show3DBuildings ? '600' : '400',
          opacity: is3DBuildingsAvailable ? 1 : 0.65,
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
        onClick={() => onToggleNetworkSummaries?.(!showNetworkSummaries)}
        style={{
          padding: '6px 10px',
          fontSize: '11px',
          background: showNetworkSummaries ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.9)',
          border: showNetworkSummaries
            ? '1px solid rgba(59, 130, 246, 0.5)'
            : '1px solid rgba(148, 163, 184, 0.2)',
          color: showNetworkSummaries ? '#60a5fa' : '#cbd5e1',
          borderRadius: '4px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          fontWeight: showNetworkSummaries ? '600' : '400',
        }}
        title="Toggle network summaries"
      >
        📊 Network Summaries
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
      {onWigle && (
        <button
          onClick={onWigle}
          disabled={!canWigle || wigleLoading}
          style={{
            padding: '6px 10px',
            fontSize: '11px',
            background: wigleActive
              ? 'rgba(245, 158, 11, 0.9)'
              : canWigle
                ? 'rgba(245, 158, 11, 0.2)'
                : 'rgba(30, 41, 59, 0.9)',
            border: wigleActive
              ? '1px solid #f59e0b'
              : canWigle
                ? '1px solid rgba(245, 158, 11, 0.5)'
                : '1px solid rgba(148, 163, 184, 0.2)',
            color: wigleActive ? '#ffffff' : canWigle ? '#f59e0b' : '#64748b',
            borderRadius: '4px',
            cursor: canWigle && !wigleLoading ? 'pointer' : 'not-allowed',
            opacity: canWigle ? 1 : 0.5,
            transition: 'all 0.2s',
          }}
        >
          🌐 {wigleLoading ? 'Loading...' : `WiGLE${selectedCount ? ` (${selectedCount})` : ''}`}
        </button>
      )}
      {onToggleAgenciesPanel && (
        <button
          onClick={onToggleAgenciesPanel}
          style={{
            padding: '6px 10px',
            fontSize: '11px',
            background: showAgenciesPanel ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.9)',
            border: showAgenciesPanel
              ? '1px solid rgba(16, 185, 129, 0.5)'
              : '1px solid rgba(148, 163, 184, 0.2)',
            color: showAgenciesPanel ? '#10b981' : '#94a3b8',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          🏢 Agencies
        </button>
      )}
      {onToggleCourthousesPanel && (
        <button
          onClick={onToggleCourthousesPanel}
          style={{
            padding: '6px 10px',
            fontSize: '11px',
            background: showCourthousesPanel ? 'rgba(245, 158, 11, 0.2)' : 'rgba(30, 41, 59, 0.9)',
            border: showCourthousesPanel
              ? '1px solid rgba(245, 158, 11, 0.5)'
              : '1px solid rgba(148, 163, 184, 0.2)',
            color: showCourthousesPanel ? '#f59e0b' : '#94a3b8',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          ⚖️ Federal Courthouses
        </button>
      )}
    </div>
  );
};
