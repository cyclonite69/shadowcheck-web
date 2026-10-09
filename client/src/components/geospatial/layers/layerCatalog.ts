export const GEOSPATIAL_LAYER_IDS = {
  wigleV2: ['wigle-v2-clusters', 'wigle-v2-cluster-count', 'wigle-v2-unclustered'],
  wigleV3: ['wigle-v3-clusters', 'wigle-v3-cluster-count', 'wigle-v3-unclustered'],
  wigleKml: ['wigle-kml-clusters', 'wigle-kml-cluster-count', 'wigle-kml-unclustered'],
  fieldObservations: [
    'wigle-field-clusters',
    'wigle-field-cluster-count',
    'wigle-field-unclustered',
  ],
  agencies: [
    'agency-clusters',
    'agency-cluster-count',
    'agency-field-unclustered',
    'agency-resident-unclustered',
  ],
  agencyMatches: ['nearest-agencies-layer'],
  courthouses: [
    'courthouse-clusters',
    'courthouse-cluster-count',
    'courthouse-district',
    'courthouse-circuit',
    'courthouse-specialty',
  ],
  alpr: ['alpr-clusters', 'alpr-cluster-count', 'alpr-unclustered'],
  deflock: ['deflock-clusters', 'deflock-cluster-count', 'deflock-unclustered'],
  shotspotterZones: ['shotspotter-fill', 'shotspotter-outline'],
  shotspotterSensors: ['shotspotter-sensors-points'],
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
  deflock: 'DeFlock cameras',
  shotspotterZones: 'ShotSpotter zones',
  shotspotterSensors: 'ShotSpotter sensors',
};

export const GEOSPATIAL_LAYER_COLORS: Record<GeospatialLayerControlKey, string> = {
  wigleV2: '#3b82f6',
  wigleV3: '#8b5cf6',
  wigleKml: '#f97316',
  fieldObservations: '#06b6d4',
  agencies: '#22c55e',
  agencyMatches: '#22c55e',
  courthouses: '#f59e0b',
  alpr: '#d946ef',
  deflock: '#ff6b00',
  shotspotterZones: '#cc0000',
  shotspotterSensors: '#8b0000',
};

export const DEFAULT_GEOSPATIAL_LAYER_ORDER: GeospatialLayerControlKey[] = [
  'wigleV2',
  'wigleV3',
  'wigleKml',
  'fieldObservations',
  'agencies',
  'agencyMatches',
  'courthouses',
  'deflock',
  'alpr',
  'shotspotterZones',
  'shotspotterSensors',
];
