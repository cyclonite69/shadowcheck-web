import { useEffect } from 'react';
import type { Map } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { renderAgencyPopupCard } from '../utils/geospatial/renderMapPopupCards';

interface Agency {
  name: string;
  office_type?: string;
  latitude: number;
  longitude: number;
  distance_meters?: number;
  has_wigle_obs?: boolean;
}

interface UseAgencyLayerProps {
  mapReady: boolean;
  mapRef: React.RefObject<Map | null>;
  mapboxRef: React.RefObject<typeof mapboxglType | null>;
  agencies: Agency[];
  showAgenciesPanel: boolean;
}

export const useAgencyLayer = ({
  mapReady,
  mapRef,
  mapboxRef,
  agencies,
  showAgenciesPanel,
}: UseAgencyLayerProps) => {
  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapboxRef.current) return;
    const map = mapRef.current;
    const layerId = 'nearest-agencies-layer';
    const sourceId = 'nearest-agencies';

    // Cleanup existing first
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    if (agencies.length === 0 || !showAgenciesPanel) return;

    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: agencies.map((a) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [a.longitude, a.latitude] },
          properties: {
            name: a.name,
            type: a.office_type ?? 'resident_agency',
            distance: (a.distance_meters || 0) / 1000,
            hasWigleObs: a.has_wigle_obs,
          },
        })),
      },
    });

    map.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 6,
        'circle-color': ['case', ['get', 'hasWigleObs'], '#ef4444', '#10b981'],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    });

    const clickHandler = (e: any) => {
      if (!e.features?.length || !mapboxRef.current) return;
      const p = e.features[0].properties;
      new mapboxRef.current.Popup({ className: 'sc-popup', maxWidth: '360px', offset: 14 })
        .setLngLat(e.lngLat)
        .setHTML(
          renderAgencyPopupCard({
            name: p.name,
            officeType: p.type,
            distanceKm: Number(p.distance),
            hasWigleObs: Boolean(p.hasWigleObs),
          })
        )
        .addTo(map);
    };

    map.on('click', layerId, clickHandler);
    return () => {
      map.off('click', layerId, clickHandler);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [mapReady, mapRef, mapboxRef, agencies, showAgenciesPanel]);
};
