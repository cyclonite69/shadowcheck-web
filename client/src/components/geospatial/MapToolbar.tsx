import React, { useState, useRef, useEffect } from 'react';

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
  canWigle?: boolean;
  wigleLoading?: boolean;
  wigleActive?: boolean;
  selectedCount?: number;
  onWigle?: () => void;
  searchMode?: SearchMode;
  onSearchModeToggle?: () => void;
  directionsLoading?: boolean;
  showAgenciesPanel?: boolean;
  onToggleAgenciesPanel?: () => void;
  showCourthousesPanel?: boolean;
  onToggleCourthousesPanel?: () => void;
  showNetworkSummaries?: boolean;
  onToggleNetworkSummaries?: (value: boolean) => void;
  onResetBearing?: () => void;
  onResetPitch?: () => void;
}

const Separator = () => (
  <div
    style={{
      width: '1px',
      height: '20px',
      background: 'var(--nav-sep)',
      margin: '0 10px',
      flexShrink: 0,
    }}
  />
);

export const MapToolbar = ({
  searchContainerRef,
  locationSearch,
  onLocationSearchChange,
  onLocationSearchFocus,
  searchingLocation,
  showSearchResults,
  searchResults,
  onSelectSearchResult,
  searchPlaceholder = 'Search locations...',
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
  onResetBearing,
  onResetPitch,
}: MapToolbarProps) => {
  const [layersOpen, setLayersOpen] = useState(false);
  const [mapStyleOpen, setMapStyleOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const layersRef = useRef<HTMLDivElement>(null);
  const mapStyleRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (layersRef.current && !layersRef.current.contains(e.target as Node)) setLayersOpen(false);
      if (mapStyleRef.current && !mapStyleRef.current.contains(e.target as Node))
        setMapStyleOpen(false);
      if (navRef.current && !navRef.current.contains(e.target as Node)) setNavOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasActiveLayers = !!showAgenciesPanel || !!showCourthousesPanel;
  const currentStyleLabel = mapStyles.find((s) => s.value === mapStyle)?.label ?? 'Style';

  const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {/* Zone 1 — Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '5px',
            background: 'rgba(59,130,246,0.12)',
            border: '0.5px solid rgba(59,130,246,0.32)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="#60a5fa" strokeWidth="1" />
            <circle cx="6.5" cy="6.5" r="1.8" fill="#60a5fa" />
            <line x1="6.5" y1="0.5" x2="6.5" y2="3" stroke="#60a5fa" strokeWidth="0.9" />
            <line x1="6.5" y1="10" x2="6.5" y2="12.5" stroke="#60a5fa" strokeWidth="0.9" />
            <line x1="0.5" y1="6.5" x2="3" y2="6.5" stroke="#60a5fa" strokeWidth="0.9" />
            <line x1="10" y1="6.5" x2="12.5" y2="6.5" stroke="#60a5fa" strokeWidth="0.9" />
          </svg>
        </div>
        <span
          style={{
            ...mono,
            fontSize: '14px',
            fontWeight: 500,
            color: '#e2e8f0',
            whiteSpace: 'nowrap',
          }}
        >
          Shadow<span style={{ color: '#60a5fa' }}>Check</span>
        </span>
      </div>

      <Separator />

      {/* Zone 2 — Search (constrained width: 200-240px) */}
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

      <div ref={navRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setNavOpen((v) => !v)}
          title="Navigation menu"
          style={{
            width: '30px',
            height: '28px',
            borderRadius: '6px',
            border: navOpen
              ? '0.5px solid rgba(59,130,246,0.3)'
              : '0.5px solid rgba(255,255,255,0.10)',
            background: navOpen ? 'rgba(59,130,246,0.10)' : 'rgba(255,255,255,0.03)',
            color: navOpen ? '#60a5fa' : 'rgba(255,255,255,0.5)',
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {navOpen ? '✕' : '≡'}
        </button>
        {navOpen && (
          <nav
            style={{
              position: 'fixed',
              left: 0,
              top: '48px',
              width: '220px',
              height: 'calc(100vh - 48px)',
              background: '#0e1117',
              borderRight: '0.5px solid rgba(59,130,246,0.12)',
              padding: '8px 0',
              zIndex: 999,
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: '6px 14px 4px',
                ...mono,
                fontSize: '10px',
                color: 'rgba(255,255,255,0.25)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Pages
            </div>
            {[
              { href: '/dashboard', label: 'Dashboard' },
              { href: '/geospatial-explorer', label: 'Geospatial Explorer' },
              { href: '/analytics', label: 'Analytics' },
              { href: '/wigle', label: 'WiGLE' },
              { href: '/kepler', label: 'Kepler' },
              { href: '/monitoring', label: 'Monitoring' },
              { href: '/endpoint-test', label: 'API Test' },
              { href: '/admin', label: 'Admin' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: 'block',
                  padding: '8px 14px',
                  ...mono,
                  fontSize: '12px',
                  color:
                    window.location.pathname === item.href ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  margin: '0 6px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color =
                    window.location.pathname === item.href ? '#60a5fa' : 'rgba(255,255,255,0.5)';
                }}
              >
                {item.label}
              </a>
            ))}
            <div
              style={{
                height: '1px',
                background: 'rgba(255,255,255,0.06)',
                margin: '8px 14px',
              }}
            />
            <div
              style={{
                padding: '6px 14px 4px',
                ...mono,
                fontSize: '10px',
                color: 'rgba(255,255,255,0.25)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Map tools
            </div>
            <div
              onClick={() => {
                onGps();
                setNavOpen(false);
              }}
              style={{
                padding: '8px 14px',
                ...mono,
                fontSize: '12px',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                borderRadius: '4px',
                margin: '0 6px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
              }}
            >
              Go to GPS
            </div>
            {onResetBearing && (
              <div
                onClick={() => {
                  onResetBearing();
                  setNavOpen(false);
                }}
                style={{
                  padding: '8px 14px',
                  ...mono,
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  margin: '0 6px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                }}
              >
                Reset bearing
              </div>
            )}
            {onResetPitch && (
              <div
                onClick={() => {
                  onResetPitch();
                  setNavOpen(false);
                }}
                style={{
                  padding: '8px 14px',
                  ...mono,
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  margin: '0 6px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                }}
              >
                Reset pitch
              </div>
            )}
          </nav>
        )}
      </div>

      <Separator />

      {/* Right-aligned container: view, overlay, and map utility controls */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Zone 3 — View mode toggle group */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: '7px',
            padding: '3px',
            gap: '2px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onToggle3DBuildings}
            disabled={!is3DBuildingsAvailable}
            title={
              is3DBuildingsAvailable
                ? 'Show/hide 3D building extrusions on the map'
                : '3D buildings unavailable for this map style'
            }
            style={{
              height: '26px',
              padding: '0 10px',
              borderRadius: '5px',
              border: show3DBuildings ? '0.5px solid rgba(59,130,246,0.25)' : 'none',
              fontSize: '11px',
              ...mono,
              letterSpacing: '0.05em',
              cursor: is3DBuildingsAvailable ? 'pointer' : 'not-allowed',
              background: show3DBuildings ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: !is3DBuildingsAvailable
                ? '#64748b'
                : show3DBuildings
                  ? '#60a5fa'
                  : 'var(--nav-text-inactive)',
              opacity: is3DBuildingsAvailable ? 1 : 0.65,
            }}
          >
            3D
          </button>
          <button
            onClick={onToggleTerrain}
            title="Show/hide terrain elevation on the map"
            style={{
              height: '26px',
              padding: '0 10px',
              borderRadius: '5px',
              border: showTerrain ? '0.5px solid rgba(59,130,246,0.25)' : 'none',
              fontSize: '11px',
              ...mono,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              background: showTerrain ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: showTerrain ? '#60a5fa' : 'var(--nav-text-inactive)',
            }}
          >
            Terrain
          </button>
        </div>

        <Separator />

        {/* Zone 4 — Overlay toggles */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => onToggleNetworkSummaries?.(!showNetworkSummaries)}
            title="Show/hide marker overlays for network summary positions: centroids (◊) represent the geometric center, weighted markers (▲) represent the signal-weighted average location"
            style={{
              height: '30px',
              padding: '0 10px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '11px',
              ...mono,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              background: showNetworkSummaries ? 'rgba(59,130,246,0.10)' : 'transparent',
              color: showNetworkSummaries ? '#60a5fa' : 'var(--nav-text-inactive)',
            }}
          >
            <span className="hidden-narrow">Markers</span>
          </button>
          {onWigle && (
            <button
              onClick={onWigle}
              disabled={!canWigle || wigleLoading}
              title={
                wigleLoading
                  ? 'Loading WiGLE data...'
                  : canWigle
                    ? 'Fetch and display observations from WiGLE API for selected networks'
                    : 'Select networks to fetch WiGLE observations'
              }
              style={{
                height: '30px',
                padding: '0 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '11px',
                ...mono,
                letterSpacing: '0.04em',
                cursor: canWigle && !wigleLoading ? 'pointer' : 'not-allowed',
                background: wigleActive ? 'rgba(59,130,246,0.10)' : 'transparent',
                color: wigleActive ? '#60a5fa' : 'var(--nav-text-inactive)',
                opacity: canWigle ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {wigleLoading ? 'Loading...' : 'WIGLE'}
              {!wigleLoading && selectedCount != null && selectedCount > 0 && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    background: 'rgba(59,130,246,0.2)',
                    color: '#60a5fa',
                    marginLeft: '5px',
                  }}
                >
                  {selectedCount}
                </span>
              )}
            </button>
          )}
          <button
            onClick={onGps}
            title="Pan map to your current GPS location"
            style={{
              height: '30px',
              padding: '0 10px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '11px',
              ...mono,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              background: 'transparent',
              color: 'var(--nav-text-inactive)',
              display: 'none',
            }}
          >
            GPS
          </button>
        </div>

        <Separator />

        {/* Zone 5 — Layers dropdown */}
        {(onToggleAgenciesPanel || onToggleCourthousesPanel) && (
          <div ref={layersRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setLayersOpen((v) => !v)}
              style={{
                height: '28px',
                padding: '0 10px',
                borderRadius: '6px',
                border: hasActiveLayers
                  ? '0.5px solid rgba(59,130,246,0.3)'
                  : '0.5px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.03)',
                color: hasActiveLayers ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                fontSize: '11px',
                ...mono,
                cursor: 'pointer',
              }}
            >
              Layers ▾
            </button>
            {layersOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  background: '#161b25',
                  border: '0.5px solid rgba(59,130,246,0.15)',
                  borderRadius: '8px',
                  padding: '4px',
                  minWidth: '180px',
                  zIndex: 200,
                }}
              >
                {onToggleAgenciesPanel && (
                  <div
                    onClick={() => {
                      onToggleAgenciesPanel();
                      setLayersOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '5px',
                      fontSize: '12px',
                      ...mono,
                      color: showAgenciesPanel ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>Agencies</span>
                    {showAgenciesPanel && <span style={{ color: '#60a5fa' }}>✓</span>}
                  </div>
                )}
                {onToggleCourthousesPanel && (
                  <div
                    onClick={() => {
                      onToggleCourthousesPanel();
                      setLayersOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '5px',
                      fontSize: '12px',
                      ...mono,
                      color: showCourthousesPanel ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>Federal Courthouses</span>
                    {showCourthousesPanel && <span style={{ color: '#60a5fa' }}>✓</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Right utility zone */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          {/* Map style dropdown chip */}
          <div ref={mapStyleRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMapStyleOpen((v) => !v)}
              style={{
                height: '28px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '0.5px solid rgba(3,105,161,0.25)',
                background: 'rgba(3,105,161,0.12)',
                color: '#e5e7eb',
                fontSize: '11px',
                ...mono,
                cursor: 'pointer',
                minWidth: '160px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{currentStyleLabel}</span>
              <span style={{ opacity: 0.5, marginLeft: '6px' }}>▾</span>
            </button>
            {mapStyleOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: '#161b25',
                  border: '0.5px solid rgba(3,105,161,0.25)',
                  borderRadius: '8px',
                  padding: '4px',
                  minWidth: '200px',
                  zIndex: 200,
                }}
              >
                {mapStyles.map((s) => (
                  <div
                    key={s.value}
                    onClick={() => {
                      onMapStyleChange(s.value);
                      setMapStyleOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '5px',
                      fontSize: '12px',
                      ...mono,
                      color: mapStyle === s.value ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>{s.label}</span>
                    {mapStyle === s.value && <span style={{ color: '#60a5fa' }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fit icon button */}
          <button
            className="nav-icon-btn"
            onClick={onFit}
            disabled={!canFit}
            title="Fit view"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: canFit ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
              cursor: canFit ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: canFit ? 1 : 0.5,
            }}
          >
            <svg
              width="14"
              height="14"
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

          {/* Home icon button */}
          <button
            className="nav-icon-btn"
            onClick={onHome}
            title="Home"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M2 7L7 2L12 7" />
              <path d="M3 7V12H6V9H8V12H11V7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
