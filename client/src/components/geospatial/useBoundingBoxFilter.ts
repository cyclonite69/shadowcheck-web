import { useEffect } from 'react';
import type { Map } from 'mapbox-gl';
import { NetworkFilters } from '../../types/filters';

interface UseBoundingBoxFilterParams {
  mapReady: boolean;
  mapRef: React.MutableRefObject<Map | null>;
  enabled?: boolean;
  setFilter: <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) => void;
}

export const useBoundingBoxFilter = ({
  mapReady,
  mapRef,
  enabled,
  setFilter,
}: UseBoundingBoxFilterParams) => {
  useEffect(() => {
    if (!mapReady || !mapRef.current || !enabled) return;

    const map = mapRef.current;
    const updateBounds = () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      setFilter('boundingBox', {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    };

    updateBounds();
    map.on('moveend', updateBounds);
    return () => {
      map.off('moveend', updateBounds);
    };
  }, [enabled, mapReady, mapRef, setFilter]);
};
