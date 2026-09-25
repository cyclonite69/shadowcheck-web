import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { Map, GeoJSONSource } from 'mapbox-gl';
import { useCurrentFilters, useCurrentEnabled } from '../../../stores/filterStore';
import { createCirclePolygon } from '../../../utils/mapHelpers';

export function formatRadius(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters).toLocaleString()} m`;
}

type Props = {
  mapReady: boolean;
  mapRef: MutableRefObject<Map | null>;
};

export const useRadiusFilterLayer = ({ mapReady, mapRef }: Props) => {
  const filters = useCurrentFilters();
  const enabled = useCurrentEnabled();
  const radiusFilter = filters.radiusFilter;
  const isEnabled = enabled.radiusFilter;

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }
    const map = mapRef.current;

    const circleSource = map.getSource('radius-filter-circle') as GeoJSONSource | undefined;
    const lineSource = map.getSource('radius-filter-line') as GeoJSONSource | undefined;
    const pointSource = map.getSource('radius-filter-point') as GeoJSONSource | undefined;
    if (!circleSource || !lineSource || !pointSource) {
      return;
    }

    const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

    if (
      !isEnabled ||
      !radiusFilter?.latitude ||
      !radiusFilter?.longitude ||
      !radiusFilter?.radiusMeters
    ) {
      circleSource.setData(empty);
      lineSource.setData(empty);
      pointSource.setData(empty);
      return;
    }

    const { latitude: lat, longitude: lng, radiusMeters } = radiusFilter;
    const center: [number, number] = [lng, lat];

    circleSource.setData({
      type: 'FeatureCollection',
      features: [createCirclePolygon(center, radiusMeters, 64)],
    });

    // Radius line from center to due-east edge; midpoint carries the label
    const radiusKm = radiusMeters / 1000;
    const radiusLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
    const edgePoint: [number, number] = [lng + radiusLng, lat];
    lineSource.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [center, edgePoint] },
          properties: { label: formatRadius(radiusMeters) },
        },
      ],
    });

    pointSource.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: center },
          properties: { radiusMeters },
        },
      ],
    });
  }, [mapReady, mapRef, radiusFilter, isEnabled]);
};
