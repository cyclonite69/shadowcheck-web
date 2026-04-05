import React, { useState, useRef, useEffect } from 'react';
import { BrandIcon, FitIcon, HomeIcon } from './MapToolbarIcons';
import { MapToolbarSearch } from './MapToolbarSearch';
import { MapToolbarNav } from './MapToolbarNav';
import { ViewControls, OverlayToggles } from './MapToolbarControls';
import { LayersDropdown, MapStyleDropdown } from './MapToolbarDropdowns';

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

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

export const Separator = () => (
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

const BrandSection = () => (
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
      <BrandIcon />
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
  canFit,
  onFit,
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

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <BrandSection />
      <Separator />

      <MapToolbarSearch
        searchContainerRef={searchContainerRef}
        locationSearch={locationSearch}
        onLocationSearchChange={onLocationSearchChange}
        onLocationSearchFocus={onLocationSearchFocus}
        searchingLocation={searchingLocation}
        showSearchResults={showSearchResults}
        searchResults={searchResults}
        onSelectSearchResult={onSelectSearchResult}
        searchPlaceholder={searchPlaceholder}
        searchMode={searchMode}
        onSearchModeToggle={onSearchModeToggle}
        directionsLoading={directionsLoading}
      />

      <MapToolbarNav
        navOpen={navOpen}
        setNavOpen={setNavOpen}
        navRef={navRef}
        onGps={onGps}
        onResetBearing={onResetBearing}
        onResetPitch={onResetPitch}
      />

      <Separator />

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ViewControls
          onToggle3DBuildings={onToggle3DBuildings}
          is3DBuildingsAvailable={is3DBuildingsAvailable}
          show3DBuildings={show3DBuildings}
          onToggleTerrain={onToggleTerrain}
          showTerrain={showTerrain}
        />

        <Separator />

        <OverlayToggles
          onToggleNetworkSummaries={onToggleNetworkSummaries}
          showNetworkSummaries={showNetworkSummaries}
          onWigle={onWigle}
          canWigle={canWigle}
          wigleLoading={wigleLoading}
          wigleActive={wigleActive}
          selectedCount={selectedCount}
        />

        <Separator />

        <LayersDropdown
          layersOpen={layersOpen}
          setLayersOpen={setLayersOpen}
          layersRef={layersRef}
          hasActiveLayers={hasActiveLayers}
          onToggleAgenciesPanel={onToggleAgenciesPanel}
          showAgenciesPanel={showAgenciesPanel}
          onToggleCourthousesPanel={onToggleCourthousesPanel}
          showCourthousesPanel={showCourthousesPanel}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          <MapStyleDropdown
            mapStyleOpen={mapStyleOpen}
            setMapStyleOpen={setMapStyleOpen}
            mapStyleRef={mapStyleRef}
            currentStyleLabel={currentStyleLabel}
            mapStyles={mapStyles}
            mapStyle={mapStyle}
            onMapStyleChange={onMapStyleChange}
          />

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
            <FitIcon />
          </button>

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
            <HomeIcon />
          </button>
        </div>
      </div>
    </div>
  );
};
