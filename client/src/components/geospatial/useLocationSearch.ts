import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map, Marker } from 'mapbox-gl';
import { mapboxApi } from '../../api/mapboxApi';

export interface LocationSearchResult {
  text: string;
  place_name: string;
  center: [number, number];
  bbox?: [number, number, number, number];
}

interface UseLocationSearchParams {
  mapRef: React.MutableRefObject<Map | null>;
  mapboxRef: React.MutableRefObject<any>;
  logError: (message: string, error: unknown) => void;
}

export const useLocationSearch = ({ mapRef, mapboxRef, logError }: UseLocationSearchParams) => {
  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const locationSearchRef = useRef<HTMLDivElement | null>(null);
  const searchMarkerRef = useRef<Marker | null>(null);

  const searchLocation = useCallback(
    async (query: string) => {
      const mapboxgl = mapboxRef.current;
      if (!query.trim() || !mapboxgl?.accessToken) return;

      setSearchingLocation(true);
      try {
        // Bias results toward POIs and the current map viewport center
        const params: Record<string, string> = {
          limit: '5',
          types: 'poi,address,place,locality,neighborhood',
        };
        const map = mapRef.current;
        if (map) {
          const center = map.getCenter();
          params.proximity = `${center.lng.toFixed(5)},${center.lat.toFixed(5)}`;
        }
        const data = await mapboxApi.geocodeSearch(query, mapboxgl.accessToken, params);
        setSearchResults(data.features || []);
        setShowSearchResults(true);
      } catch (error) {
        logError('Geocoding error', error);
        setSearchResults([]);
      } finally {
        setSearchingLocation(false);
      }
    },
    [logError, mapboxRef]
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (locationSearch.trim()) {
        searchLocation(locationSearch);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [locationSearch, searchLocation]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationSearchRef.current && !locationSearchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const flyToLocation = useCallback(
    (result: LocationSearchResult) => {
      const mapboxgl = mapboxRef.current;
      if (!mapRef.current || !mapboxgl) return;

      const [lng, lat] = result.center;

      if (searchMarkerRef.current) {
        searchMarkerRef.current.remove();
      }

      searchMarkerRef.current = new (mapboxgl as any).Marker({ color: '#3b82f6' })
        .setLngLat([lng, lat])
        .setPopup(
          new (mapboxgl as any).Popup({ offset: 25 }).setHTML(
            `<div style="color: #000; font-weight: 600;">${result.place_name}</div>`
          )
        )
        .addTo(mapRef.current);

      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: result.bbox ? undefined : 14,
        essential: true,
        duration: 2000,
      });

      if (result.bbox) {
        mapRef.current.fitBounds(result.bbox, {
          padding: 50,
          duration: 2000,
        });
      }

      setShowSearchResults(false);
      setLocationSearch('');
    },
    [mapRef, mapboxRef]
  );

  return {
    locationSearch,
    setLocationSearch,
    searchResults,
    showSearchResults,
    setShowSearchResults,
    searchingLocation,
    locationSearchRef,
    flyToLocation,
  };
};
