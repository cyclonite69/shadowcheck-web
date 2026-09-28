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

/** Axis-aligned bbox as west/south/east/north (matches Overpass client). */
export interface BBoxWsen {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Subdivide a bounding box into a uniform grid of smaller boxes.
 * Chunks share edges (closed on both sides) so Overpass boundary hits
 * may duplicate — callers must dedupe by osm id after merge.
 *
 * @param bbox - Parent west/south/east/north box
 * @param rows - Latitude subdivisions (default 2)
 * @param cols - Longitude subdivisions (default 2)
 */
export function subdivideBBox(bbox: BBoxWsen, rows = 2, cols = 2): BBoxWsen[] {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
    throw new Error('subdivideBBox: rows and cols must be integers >= 1');
  }

  const latStep = (bbox.north - bbox.south) / rows;
  const lonStep = (bbox.east - bbox.west) / cols;
  const chunks: BBoxWsen[] = [];

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      chunks.push({
        south: bbox.south + r * latStep,
        north: bbox.south + (r + 1) * latStep,
        west: bbox.west + c * lonStep,
        east: bbox.west + (c + 1) * lonStep,
      });
    }
  }

  return chunks;
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
  { id: 'detroit', label: 'Detroit', state: 'MI', bbox: [-83.5, 42.1, -82.8, 42.85] },
  { id: 'flint', label: 'Flint', state: 'MI', bbox: [-83.95, 42.9, -83.4, 43.15] },
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
  { id: 'grand-rapids', label: 'Grand Rapids', state: 'MI', bbox: [-85.85, 42.8, -85.5, 43.12] },
  { id: 'kalamazoo', label: 'Kalamazoo', state: 'MI', bbox: [-85.72, 42.18, -85.48, 42.38] },
  { id: 'lansing', label: 'Lansing', state: 'MI', bbox: [-84.72, 42.65, -84.38, 42.82] },
  {
    id: 'saginaw-bay-midland',
    label: 'Saginaw-Bay City-Midland',
    state: 'MI',
    bbox: [-84.35, 43.35, -83.8, 43.68],
  },
  { id: 'holland', label: 'Holland', state: 'MI', bbox: [-86.22, 42.72, -85.98, 42.88] },
  { id: 'jackson', label: 'Jackson', state: 'MI', bbox: [-84.5, 42.18, -84.32, 42.3] },
  { id: 'port-huron', label: 'Port Huron', state: 'MI', bbox: [-82.52, 42.88, -82.4, 43.06] },
  { id: 'ann-arbor', label: 'Ann Arbor', state: 'MI', bbox: [-83.85, 42.18, -83.55, 42.36] },
  {
    id: 'traverse-city',
    label: 'Traverse City',
    state: 'MI',
    bbox: [-85.72, 44.68, -85.52, 44.82],
  },
  { id: 'benton-harbor', label: 'Benton Harbor', state: 'MI', bbox: [-86.55, 42.04, -86.4, 42.16] },
  { id: 'muskegon', label: 'Muskegon', state: 'MI', bbox: [-86.38, 43.12, -86.12, 43.32] },
  { id: 'monroe', label: 'Monroe', state: 'MI', bbox: [-83.48, 41.86, -83.32, 42.0] },
  { id: 'battle-creek', label: 'Battle Creek', state: 'MI', bbox: [-85.32, 42.26, -85.1, 42.38] },
];

export function findRegion(id: string): AlprRegion | undefined {
  return ALPR_REGIONS.find((r) => r.id === id);
}

export function regionsByState(state: string): AlprRegion[] {
  const upper = state.toUpperCase();
  return ALPR_REGIONS.filter((r) => r.state === upper);
}
