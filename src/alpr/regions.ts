/**
 * Curated US metro bounding boxes for ALPR/Overpass regional sync.
 * Coarse, generous boxes to keep individual Overpass queries small —
 * not precise city-limit polygons. Refine as needed.
 * bbox order: [west, south, east, north]
 */

export interface AlprRegion {
  id: string;
  label: string;
  state: string;
  bbox: [number, number, number, number];
}

export const ALPR_REGIONS: AlprRegion[] = [
  { id: 'nyc', label: 'New York City Metro', state: 'NY', bbox: [-74.3, 40.5, -73.65, 41.0] },
  { id: 'la', label: 'Los Angeles Metro', state: 'CA', bbox: [-118.9, 33.6, -117.6, 34.4] },
  { id: 'chicago', label: 'Chicago Metro', state: 'IL', bbox: [-88.3, 41.5, -87.3, 42.2] },
  { id: 'houston', label: 'Houston', state: 'TX', bbox: [-95.8, 29.4, -95.0, 30.2] },
  { id: 'phoenix', label: 'Phoenix', state: 'AZ', bbox: [-112.4, 33.2, -111.6, 33.9] },
  { id: 'philadelphia', label: 'Philadelphia', state: 'PA', bbox: [-75.4, 39.8, -74.9, 40.2] },
  { id: 'san-antonio', label: 'San Antonio', state: 'TX', bbox: [-98.8, 29.2, -98.2, 29.7] },
  { id: 'san-diego', label: 'San Diego', state: 'CA', bbox: [-117.4, 32.5, -116.9, 33.1] },
  { id: 'dfw', label: 'Dallas-Fort Worth', state: 'TX', bbox: [-97.5, 32.5, -96.5, 33.2] },
  { id: 'austin', label: 'Austin', state: 'TX', bbox: [-98.0, 30.0, -97.5, 30.6] },
  { id: 'dc', label: 'Washington DC Metro', state: 'DC', bbox: [-77.6, 38.7, -76.7, 39.2] },
  { id: 'baltimore', label: 'Baltimore', state: 'MD', bbox: [-76.9, 39.1, -76.4, 39.5] },
  {
    id: 'bay-area',
    label: 'San Francisco Bay Area',
    state: 'CA',
    bbox: [-123.0, 37.1, -121.5, 38.3],
  },
  { id: 'seattle', label: 'Seattle', state: 'WA', bbox: [-122.6, 47.3, -121.9, 47.8] },
  { id: 'denver', label: 'Denver', state: 'CO', bbox: [-105.3, 39.5, -104.6, 40.0] },
  { id: 'boston', label: 'Boston', state: 'MA', bbox: [-71.4, 42.2, -70.8, 42.6] },
  { id: 'detroit', label: 'Detroit', state: 'MI', bbox: [-83.5, 42.1, -82.8, 42.6] },
  { id: 'flint', label: 'Flint', state: 'MI', bbox: [-83.95, 42.9, -83.65, 43.15] },
  { id: 'atlanta', label: 'Atlanta', state: 'GA', bbox: [-84.7, 33.5, -84.0, 34.1] },
  { id: 'miami', label: 'Miami', state: 'FL', bbox: [-80.5, 25.5, -80.0, 26.0] },
  {
    id: 'minneapolis',
    label: 'Minneapolis-St Paul',
    state: 'MN',
    bbox: [-93.5, 44.7, -92.9, 45.2],
  },
  { id: 'portland', label: 'Portland', state: 'OR', bbox: [-122.9, 45.3, -122.4, 45.7] },
  { id: 'las-vegas', label: 'Las Vegas', state: 'NV', bbox: [-115.4, 35.9, -114.9, 36.4] },
  { id: 'charlotte', label: 'Charlotte', state: 'NC', bbox: [-81.1, 35.0, -80.6, 35.5] },
  { id: 'nashville', label: 'Nashville', state: 'TN', bbox: [-87.0, 35.9, -86.5, 36.4] },
  { id: 'columbus', label: 'Columbus', state: 'OH', bbox: [-83.3, 39.7, -82.7, 40.2] },
  { id: 'indianapolis', label: 'Indianapolis', state: 'IN', bbox: [-86.4, 39.5, -85.9, 40.0] },
  { id: 'st-louis', label: 'St. Louis', state: 'MO', bbox: [-90.5, 38.4, -90.0, 38.9] },
  { id: 'kansas-city', label: 'Kansas City', state: 'MO', bbox: [-94.9, 38.8, -94.3, 39.4] },
  { id: 'milwaukee', label: 'Milwaukee', state: 'WI', bbox: [-88.2, 42.8, -87.7, 43.3] },
];

export function findRegion(id: string): AlprRegion | undefined {
  return ALPR_REGIONS.find((r) => r.id === id);
}

export function regionsByState(state: string): AlprRegion[] {
  const upper = state.toUpperCase();
  return ALPR_REGIONS.filter((r) => r.state === upper);
}
