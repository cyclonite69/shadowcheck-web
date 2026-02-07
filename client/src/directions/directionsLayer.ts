/**
 * Mapbox layer controller for Directions route visualization.
 * Imports: mapbox-gl types only — zero React dependencies.
 */

import type mapboxgl from 'mapbox-gl';

const SOURCE_ID = 'directions-route';
const LINE_LAYER_ID = 'directions-route-line';
const INFO_LAYER_ID = 'directions-route-info';

interface RouteDisplayData {
  coordinates: [number, number][];
  distance_meters: number;
  duration_seconds: number;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds: number): string {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
  return `${Math.round(seconds / 60)} min`;
}

/**
 * Draw a route line on the map with distance/duration info at the midpoint.
 */
export function applyDirectionsRoute(map: mapboxgl.Map, data: RouteDisplayData): void {
  // Clear any existing route first
  clearDirectionsRoute(map);

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: data.coordinates,
        },
        properties: {},
      },
    ],
  };

  map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

  map.addLayer({
    id: LINE_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    paint: {
      'line-color': '#3b82f6',
      'line-width': 3,
      'line-opacity': 0.7,
    },
  });

  // Place a label at the midpoint of the route
  const midIdx = Math.floor(data.coordinates.length / 2);
  const midpoint = data.coordinates[midIdx] || data.coordinates[0];
  const label = `${formatDistance(data.distance_meters)}  ·  ${formatDuration(data.duration_seconds)}`;

  map.addSource(INFO_LAYER_ID, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: midpoint },
          properties: { label },
        },
      ],
    },
  });

  map.addLayer({
    id: INFO_LAYER_ID,
    type: 'symbol',
    source: INFO_LAYER_ID,
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 12,
      'text-offset': [0, -1.5],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#e2e8f0',
      'text-halo-color': '#0f172a',
      'text-halo-width': 1.5,
    },
  });
}

/**
 * Remove the route line and info label from the map.
 */
export function clearDirectionsRoute(map: mapboxgl.Map): void {
  if (map.getLayer(INFO_LAYER_ID)) map.removeLayer(INFO_LAYER_ID);
  if (map.getSource(INFO_LAYER_ID)) map.removeSource(INFO_LAYER_ID);
  if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}
