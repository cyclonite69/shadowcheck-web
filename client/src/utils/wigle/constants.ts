/**
 * WiGLE-specific constants
 */

export const DEFAULT_LIMIT: number | null = null;
export const CLUSTER_SAMPLE_LIMIT = 50;
export const LAYER_STORAGE_KEY = 'shadowcheck_wigle_layers';

export const DEFAULT_LAYERS = {
  v2: true,
  v3: false,
  kml: false,
  fieldOffices: true,
  residentAgencies: true,
  federalCourthouses: true,
} as const;

/**
 * Mapbox map styles for WiGLE page
 */
export const MAP_STYLES = [
  { label: 'Standard (Day)', value: 'mapbox://styles/mapbox/standard' },
  { label: 'Standard (Dawn)', value: 'mapbox://styles/mapbox/standard-dawn' },
  { label: 'Standard (Dusk)', value: 'mapbox://styles/mapbox/standard-dusk' },
  { label: 'Standard (Night)', value: 'mapbox://styles/mapbox/standard-night' },
  { label: 'Streets', value: 'mapbox://styles/mapbox/streets-v12' },
  { label: 'Outdoors', value: 'mapbox://styles/mapbox/outdoors-v12' },
  { label: 'Light', value: 'mapbox://styles/mapbox/light-v11' },
  { label: 'Dark', value: 'mapbox://styles/mapbox/dark-v11' },
  { label: 'Satellite', value: 'mapbox://styles/mapbox/satellite-v9' },
  { label: 'Satellite Streets', value: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { label: 'Navigation Day', value: 'mapbox://styles/mapbox/navigation-day-v1' },
  { label: 'Navigation Night', value: 'mapbox://styles/mapbox/navigation-night-v1' },
];
