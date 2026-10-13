import {
  FIELD_OFFICE_LAYER_IDS,
  RESIDENT_AGENCY_LAYER_IDS,
  COURTHOUSE_LAYER_IDS,
  FIELD_OFFICE_LABEL,
  RESIDENT_AGENCY_LABEL,
  FEDERAL_COURTHOUSE_LABEL,
  FIELD_OFFICE_COLOR,
  RESIDENT_AGENCY_COLOR,
  FEDERAL_COURTHOUSE_COLOR,
} from '../../../constants/agencyCourthouseStyles';

export const GEOSPATIAL_LAYER_IDS = {
  home: ['home-circle-fill', 'home-circle-outline', 'home-dot', 'home-marker'],
  wigleV2: ['geospatial-wigle-v2-mvt-points'],
  wigleV3: ['geospatial-wigle-v3-mvt-points'],
  wigleKml: ['geospatial-kml-mvt-points'],
  fieldObservations: ['geospatial-field-mvt-points'],
  fieldOffices: FIELD_OFFICE_LAYER_IDS,
  residentAgencies: RESIDENT_AGENCY_LAYER_IDS,
  courthouses: COURTHOUSE_LAYER_IDS,
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
  home: 'Home marker',
  wigleV2: 'WiGLE v2 networks',
  wigleV3: 'WiGLE v3 networks',
  wigleKml: 'KML observations',
  fieldObservations: 'Field observations',
  fieldOffices: FIELD_OFFICE_LABEL,
  residentAgencies: RESIDENT_AGENCY_LABEL,
  courthouses: FEDERAL_COURTHOUSE_LABEL,
  alpr: 'ALPR cameras (OSM)',
  shotspotterZones: 'ShotSpotter zones',
  shotspotterSensors: 'ShotSpotter sensors',
};

export const GEOSPATIAL_LAYER_COLORS: Record<GeospatialLayerControlKey, string> = {
  home: '#10b981',
  wigleV2: '#3b82f6',
  wigleV3: '#8b5cf6',
  wigleKml: '#eab308',
  fieldObservations: '#06b6d4',
  fieldOffices: FIELD_OFFICE_COLOR,
  residentAgencies: RESIDENT_AGENCY_COLOR,
  courthouses: FEDERAL_COURTHOUSE_COLOR,
  alpr: '#d946ef',
  shotspotterZones: '#7f1d1d',
  shotspotterSensors: '#fb7185',
};

export const DEFAULT_GEOSPATIAL_LAYER_ORDER: GeospatialLayerControlKey[] = [
  'home',
  'wigleV2',
  'wigleV3',
  'wigleKml',
  'fieldObservations',
  'fieldOffices',
  'residentAgencies',
  'courthouses',
  'alpr',
  'shotspotterZones',
  'shotspotterSensors',
];
