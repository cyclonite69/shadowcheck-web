export const GEOSPATIAL_LAYER_IDS = {
  wigleV2: ['geospatial-wigle-v2-mvt-points'],
  wigleV3: ['geospatial-wigle-v3-mvt-points'],
  wigleKml: ['geospatial-kml-mvt-points'],
  fieldObservations: ['geospatial-field-mvt-points'],
  agencies: ['geospatial-agencies-mvt-points'],
  agencyMatches: ['nearest-agencies-layer'],
  courthouses: ['geospatial-courthouses-mvt-points'],
  alpr: ['geospatial-alpr-mvt-points'],
  shotspotterZones: ['geospatial-shotspotter-zone-fill', 'geospatial-shotspotter-zone-line'],
  shotspotterSensors: ['geospatial-shotspotter-sensor-points'],
} as const;

export type GeospatialLayerControlKey = keyof typeof GEOSPATIAL_LAYER_IDS;

export interface GeospatialLayerOption {
  key: GeospatialLayerControlKey;
  label: string;
  color: string;
  visible: boolean;
  opacity: number;
  onToggle: () => void;
  onOpacityChange: (opacity: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const GEOSPATIAL_LAYER_LABELS: Record<GeospatialLayerControlKey, string> = {
  wigleV2: 'WiGLE v2 networks',
  wigleV3: 'WiGLE v3 networks',
  wigleKml: 'KML observations',
  fieldObservations: 'Field observations',
  agencies: 'Agency offices',
  agencyMatches: 'Nearest agencies',
  courthouses: 'Federal courthouses',
  alpr: 'ALPR cameras (OSM)',
  shotspotterZones: 'ShotSpotter zones',
  shotspotterSensors: 'ShotSpotter sensors',
};

export const GEOSPATIAL_LAYER_COLORS: Record<GeospatialLayerControlKey, string> = {
  wigleV2: '#3b82f6',
  wigleV3: '#8b5cf6',
  wigleKml: '#eab308',
  fieldObservations: '#06b6d4',
  agencies: '#dc2626',
  agencyMatches: '#22c55e',
  courthouses: '#6366f1',
  alpr: '#d946ef',
  shotspotterZones: '#7f1d1d',
  shotspotterSensors: '#fb7185',
};

export const DEFAULT_GEOSPATIAL_LAYER_ORDER: GeospatialLayerControlKey[] = [
  'wigleV2',
  'wigleV3',
  'wigleKml',
  'fieldObservations',
  'agencies',
  'agencyMatches',
  'courthouses',
  'alpr',
  'shotspotterZones',
  'shotspotterSensors',
];
