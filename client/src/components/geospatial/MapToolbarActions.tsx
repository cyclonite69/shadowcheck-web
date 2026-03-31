import React from 'react';
import type { Map } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { MapToolbar } from './MapToolbar';
import { LocationSearchResult } from './useLocationSearch';
import { MapStyleOption } from '../../constants/network';
import { fitBoundsWithZoomInset } from '../../utils/geospatial/mapViewUtils';

interface MapToolbarActionsProps {
  locationSearchRef: React.RefObject<HTMLDivElement | null>;
  locationSearch: string;
  setLocationSearch: (value: string) => void;
  searchingLocation: boolean;
  showSearchResults: boolean;
  setShowSearchResults: (value: boolean) => void;
  searchResults: LocationSearchResult[];
  onSelectSearchResult: (result: LocationSearchResult) => void;
  mapStyle: string;
  onMapStyleChange: (style: string) => void;
  mapStyles: MapStyleOption[];
  show3DBuildings: boolean;
  is3DBuildingsAvailable: boolean;
  toggle3DBuildings: (enabled: boolean) => void;
  showTerrain: boolean;
  toggleTerrain: (enabled: boolean) => void;
  fitButtonActive: boolean;
  canFit: boolean;
  mapboxRef: React.MutableRefObject<typeof mapboxglType | null>;
  mapRef: React.MutableRefObject<Map | null>;
  activeObservationSets: Array<{ observations: Array<{ lon: number; lat: number }> }>;
  setFitButtonActive: (value: boolean) => void;
  homeButtonActive: boolean;
  setHomeButtonActive: (value: boolean) => void;
  homeLocation: { center: [number, number]; zoom?: number };
  logError: (message: string, error: unknown) => void;
  // WiGLE observations
  canWigle?: boolean;
  wigleLoading?: boolean;
  wigleActive?: boolean;
  selectedCount?: number;
  onWigle?: () => void;
  // Directions mode
  searchMode?: 'address' | 'directions';
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

export const MapToolbarActions = ({
  locationSearchRef,
  locationSearch,
  setLocationSearch,
  searchingLocation,
  showSearchResults,
  setShowSearchResults,
  searchResults,
  onSelectSearchResult,
  mapStyle,
  onMapStyleChange,
  mapStyles,
  show3DBuildings,
  is3DBuildingsAvailable,
  toggle3DBuildings,
  showTerrain,
  toggleTerrain,
  fitButtonActive,
  canFit,
  mapboxRef,
  mapRef,
  activeObservationSets,
  setFitButtonActive,
  homeButtonActive,
  setHomeButtonActive,
  homeLocation,
  logError,
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
}: MapToolbarActionsProps) => {
  return (
    <MapToolbar
      searchContainerRef={locationSearchRef}
      locationSearch={locationSearch}
      onLocationSearchChange={setLocationSearch}
      onLocationSearchFocus={() => {
        if (searchResults.length > 0) {
          setShowSearchResults(true);
        }
      }}
      searchingLocation={searchingLocation}
      showSearchResults={showSearchResults}
      searchResults={searchResults}
      onSelectSearchResult={onSelectSearchResult}
      mapStyle={mapStyle}
      onMapStyleChange={onMapStyleChange}
      mapStyles={mapStyles}
      show3DBuildings={show3DBuildings}
      is3DBuildingsAvailable={is3DBuildingsAvailable}
      onToggle3DBuildings={() => toggle3DBuildings(!show3DBuildings)}
      showTerrain={showTerrain}
      onToggleTerrain={() => toggleTerrain(!showTerrain)}
      fitButtonActive={fitButtonActive}
      canFit={canFit}
      onFit={() => {
        const mapboxgl = mapboxRef.current;
        if (!mapRef.current || !mapboxgl || activeObservationSets.length === 0) return;
        setFitButtonActive(true);
        const allCoords = activeObservationSets.flatMap((set) =>
          set.observations.map((obs) => [obs.lon, obs.lat] as [number, number])
        );
        if (allCoords.length === 0) return;
        const bounds = allCoords.reduce(
          (bounds, coord) => bounds.extend(coord),
          new (mapboxgl as any).LngLatBounds(allCoords[0], allCoords[0])
        );
        fitBoundsWithZoomInset(mapRef.current, bounds, { padding: 80 });
        setTimeout(() => setFitButtonActive(false), 2000); // Light up for 2 seconds
      }}
      homeButtonActive={homeButtonActive}
      onHome={() => {
        if (!mapRef.current) return;
        setHomeButtonActive(true);
        mapRef.current.flyTo({ center: homeLocation.center, zoom: 17 }); // Higher zoom ~100-200m up
        setTimeout(() => setHomeButtonActive(false), 2000); // Light up for 2 seconds
      }}
      onGps={() => {
        if (!mapRef.current) return;
        navigator.geolocation.getCurrentPosition(
          (position) => {
            mapRef.current?.flyTo({
              center: [position.coords.longitude, position.coords.latitude],
              zoom: 15,
            });
          },
          (error) => {
            logError('Geolocation error', error);
            alert('Unable to get your location. Please enable location services.');
          }
        );
      }}
      canWigle={canWigle}
      wigleLoading={wigleLoading}
      wigleActive={wigleActive}
      selectedCount={selectedCount}
      onWigle={onWigle}
      searchMode={searchMode}
      onSearchModeToggle={onSearchModeToggle}
      directionsLoading={directionsLoading}
      showAgenciesPanel={showAgenciesPanel}
      onToggleAgenciesPanel={onToggleAgenciesPanel}
      showCourthousesPanel={showCourthousesPanel}
      onToggleCourthousesPanel={onToggleCourthousesPanel}
      showNetworkSummaries={showNetworkSummaries}
      onToggleNetworkSummaries={onToggleNetworkSummaries}
      onResetBearing={() => {
        mapRef.current?.resetNorth({ duration: 500 });
      }}
      onResetPitch={() => {
        mapRef.current?.easeTo({ pitch: 0, duration: 500 });
      }}
    />
  );
};
