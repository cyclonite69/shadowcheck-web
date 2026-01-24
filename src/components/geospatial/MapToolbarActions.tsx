import React from 'react';
import type mapboxglType from 'mapbox-gl';
import { MapToolbar } from './MapToolbar';

interface LocationSearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface MapToolbarActionsProps {
  locationSearchRef: React.RefObject<HTMLDivElement>;
  locationSearch: string;
  setLocationSearch: (value: string) => void;
  searchingLocation: boolean;
  showSearchResults: boolean;
  setShowSearchResults: (value: boolean) => void;
  searchResults: LocationSearchResult[];
  onSelectSearchResult: (result: LocationSearchResult) => void;
  mapStyle: string;
  onMapStyleChange: (style: string) => void;
  mapStyles: Record<string, string>;
  show3DBuildings: boolean;
  toggle3DBuildings: (enabled: boolean) => void;
  showTerrain: boolean;
  toggleTerrain: (enabled: boolean) => void;
  fitButtonActive: boolean;
  canFit: boolean;
  mapboxRef: React.MutableRefObject<typeof mapboxglType | null>;
  mapRef: React.MutableRefObject<mapboxglType.Map | null>;
  activeObservationSets: Array<{ observations: Array<{ lon: number; lat: number }> }>;
  setFitButtonActive: (value: boolean) => void;
  homeButtonActive: boolean;
  setHomeButtonActive: (value: boolean) => void;
  homeLocation: { center: [number, number]; zoom?: number };
  logError: (message: string, error: unknown) => void;
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
          new mapboxgl.LngLatBounds(allCoords[0], allCoords[0])
        );
        mapRef.current.fitBounds(bounds, { padding: 50 });
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
    />
  );
};
