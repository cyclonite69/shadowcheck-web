import React from 'react';

interface MapToolbarSearchProps {
  searchContainerRef?: React.RefObject<HTMLDivElement | null>;
  locationSearch: string;
  onLocationSearchChange: (value: string) => void;
  onLocationSearchFocus: () => void;
  searchingLocation: boolean;
  showSearchResults: boolean;
  searchResults: any[];
  onSelectSearchResult: (result: any) => void;
  searchPlaceholder?: string;
  searchMode?: 'address' | 'directions';
  onSearchModeToggle?: () => void;
  directionsLoading?: boolean;
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

export const MapToolbarSearch = ({
  searchContainerRef,
  locationSearch,
  onLocationSearchChange,
  onLocationSearchFocus,
  searchingLocation,
  showSearchResults,
  searchResults,
  onSelectSearchResult,
  searchPlaceholder = 'Search locations...',
  searchMode,
  onSearchModeToggle,
  directionsLoading,
}: MapToolbarSearchProps) => {
  return (
    <div
      ref={searchContainerRef}
      style={{
        position: 'relative',
        maxWidth: '220px',
        width: '220px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          placeholder={
            searchMode === 'directions' ? 'Search destination for route...' : searchPlaceholder
          }
          value={locationSearch}
          onChange={(e) => onLocationSearchChange(e.target.value)}
          onFocus={onLocationSearchFocus}
          style={{
            width: '100%',
            height: '32px',
            padding: '0 10px',
            fontSize: '11px',
            ...mono,
            background: 'rgba(3,105,161,0.12)',
            border: '0.5px solid rgba(3,105,161,0.25)',
            borderRadius: onSearchModeToggle ? '7px 0 0 7px' : '7px',
            color: '#f1f5f9',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {onSearchModeToggle && (
          <button
            onClick={onSearchModeToggle}
            title={
              searchMode === 'address' ? 'Switch to Directions mode' : 'Switch to Address mode'
            }
            style={{
              height: '32px',
              padding: '0 8px',
              fontSize: '11px',
              background:
                searchMode === 'directions' ? 'rgba(59,130,246,0.15)' : 'rgba(3,105,161,0.12)',
              border: '0.5px solid rgba(3,105,161,0.25)',
              borderLeft: 'none',
              borderRadius: '0 7px 7px 0',
              color: searchMode === 'directions' ? '#60a5fa' : 'rgba(255,255,255,0.35)',
              cursor: 'pointer',
              flexShrink: 0,
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
            background: '#161b25',
            border: '0.5px solid rgba(59,130,246,0.15)',
            borderRadius: '8px',
            maxHeight: '300px',
            overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
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
                  index < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59,130,246,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9' }}>
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
  );
};
