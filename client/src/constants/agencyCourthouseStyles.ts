/**
 * Shared styles, labels, colors, and layer IDs for Agency Offices and Federal Courthouses.
 * Consumed by both WiGLE page and Geospatial page for full presentation parity.
 */

export const FIELD_OFFICE_LABEL = 'Field Offices';
export const RESIDENT_AGENCY_LABEL = 'Resident Agencies';
export const FEDERAL_COURTHOUSE_LABEL = 'Federal Courthouses';

export const FIELD_OFFICE_COLOR = '#dc2626';
export const RESIDENT_AGENCY_COLOR = '#f97316';
export const FEDERAL_COURTHOUSE_COLOR = '#f59e0b';

export const DISTRICT_COURT_COLOR = '#f59e0b';
export const CIRCUIT_COURT_COLOR = '#a855f7';
export const SPECIALTY_COURT_COLOR = '#06b6d4';
export const COURTHOUSE_CLUSTER_COLOR = '#f59e0b';

export const FIELD_OFFICE_LAYER_IDS = [
  'agency-field-unclustered',
  'agency-clusters',
  'agency-cluster-count',
] as const;

export const RESIDENT_AGENCY_LAYER_IDS = ['agency-resident-unclustered'] as const;

export const COURTHOUSE_LAYER_IDS = [
  'courthouse-clusters',
  'courthouse-cluster-count',
  'courthouse-district',
  'courthouse-circuit',
  'courthouse-specialty',
] as const;
