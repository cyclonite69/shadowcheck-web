import { useEffect } from 'react';
import type { Map } from 'mapbox-gl';
import { NetworkFilters } from '../../types/filters';

interface UseBoundingBoxFilterParams {
  mapReady: boolean;
  mapRef: React.MutableRefObject<Map | null>;
  enabled?: boolean;
  syncToViewport?: boolean;
  setFilter: <K extends keyof NetworkFilters>(key: K, value: NetworkFilters[K]) => void;
}

export const useBoundingBoxFilter = ({
  mapReady,
  mapRef,
  enabled,
  syncToViewport,
  setFilter,
}: UseBoundingBoxFilterParams) => {
  useEffect(() => {
    if (!mapReady || !mapRef.current || !enabled || !syncToViewport) return;

    const map = mapRef.current;
    const wrapLongitude = (lng: number) => {
      const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
      return wrapped === -180 ? 180 : wrapped;
    };

    const updateBounds = () => {
      const bounds = map.getBounds();
      if (!bounds) return;

      const north = Math.min(90, Math.max(-90, bounds.getNorth()));
      const south = Math.min(90, Math.max(-90, bounds.getSouth()));
      const rawEast = bounds.getEast();
      const rawWest = bounds.getWest();
      const span = rawEast - rawWest;

      let east: number;
      let west: number;

      if (span >= 360) {
        west = -180;
        east = 180;
      } else {
        west = wrapLongitude(rawWest);
        east = wrapLongitude(rawEast);
      }

      setFilter('boundingBox', {
        north,
        south,
        east,
        west,
      });
    };

    updateBounds();
    map.on('moveend', updateBounds);
    return () => {
      map.off('moveend', updateBounds);
    };
  }, [enabled, mapReady, mapRef, setFilter, syncToViewport]);
};
