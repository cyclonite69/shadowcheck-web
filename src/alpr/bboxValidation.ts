/**
 * Bounding box validation and normalization for ALPR/Overpass pipeline.
 *
 * Enforces strict coordinate validation and an area ceiling derived from
 * the largest curated metro region (San Francisco Bay Area, ~1.80 deg²).
 *
 * Rules:
 *   - Coordinate order: [west, south, east, north] (GeoJSON standard: minLon, minLat, maxLon, maxLat)
 *   - Coordinates must be finite numbers (rejects NaN, Infinity, -Infinity)
 *   - Latitude: south, north in [-90, 90]
 *   - Longitude: west, east in [-180, 180]
 *   - Non-degenerate & non-inverted: west < east, south < north
 *   - Max area ceiling: 2.25 deg² (~25% headroom over Bay Area at 1.80 deg²)
 *   - Max latitude span: 1.5 deg
 *   - Max longitude span: 1.8 deg
 */

export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export const MAX_BBOX_AREA_DEG2 = 2.25;
export const MAX_LAT_SPAN_DEG = 1.5;
export const MAX_LON_SPAN_DEG = 1.8;

export class BboxValidationError extends Error {
  constructor(
    message: string,
    public readonly invalidKey?: string,
    public readonly invalidValue?: unknown
  ) {
    super(message);
    this.name = 'BboxValidationError';
  }
}

/**
 * Validates that all coordinates on a Bbox object are finite numbers.
 * Throws BboxValidationError if any coordinate is missing, NaN, or non-finite.
 */
export function validateBboxCoordinates(bbox: unknown): asserts bbox is Bbox {
  if (!bbox || typeof bbox !== 'object') {
    throw new BboxValidationError('Bounding box must be an object or array', 'bbox', bbox);
  }

  const b = bbox as Record<string, unknown>;
  const keys: Array<keyof Bbox> = ['west', 'south', 'east', 'north'];
  for (const k of keys) {
    const val = b[k];
    if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
      throw new BboxValidationError(
        `Bounding box coordinate '${k}' must be a finite number (received ${String(val)})`,
        k,
        val
      );
    }
  }
}

/**
 * Parses, validates, and normalizes a bounding box from array, object, or string.
 *
 * @param input - [west, south, east, north], { west, south, east, north }, or "W,S,E,N"
 * @returns Fully validated and normalized Bbox with finite numbers
 * @throws BboxValidationError on any validation failure
 */
export function validateAndNormalizeBbox(input: unknown): Bbox {
  if (input === null || input === undefined) {
    throw new BboxValidationError('Bounding box is required', 'bbox', input);
  }

  let rawWest: unknown;
  let rawSouth: unknown;
  let rawEast: unknown;
  let rawNorth: unknown;

  if (Array.isArray(input)) {
    if (input.length !== 4) {
      throw new BboxValidationError(
        'Bounding box array must contain exactly 4 coordinates [west, south, east, north]',
        'bbox',
        input
      );
    }
    [rawWest, rawSouth, rawEast, rawNorth] = input;
  } else if (typeof input === 'string') {
    const parts = input.split(',').map((p) => p.trim());
    if (parts.length !== 4) {
      throw new BboxValidationError(
        'Bounding box string must be comma-separated west,south,east,north',
        'bbox',
        input
      );
    }
    [rawWest, rawSouth, rawEast, rawNorth] = parts;
  } else if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    rawWest = obj.west;
    rawSouth = obj.south;
    rawEast = obj.east;
    rawNorth = obj.north;
  } else {
    throw new BboxValidationError(
      'Bounding box must be an array [west, south, east, north], object { west, south, east, north }, or comma-separated string',
      'bbox',
      input
    );
  }

  // 1. Finiteness check
  const parseCoord = (val: unknown, key: string): number => {
    if (val === null || val === undefined || val === '') {
      throw new BboxValidationError(
        `Bounding box coordinate '${key}' is required and must be a finite number`,
        key,
        val
      );
    }
    const num = typeof val === 'number' ? val : Number(val);
    if (typeof num !== 'number' || !Number.isFinite(num) || Number.isNaN(num)) {
      throw new BboxValidationError(
        `Bounding box coordinate '${key}' must be a finite number (received ${String(val)})`,
        key,
        val
      );
    }
    return num;
  };

  const west = parseCoord(rawWest, 'west');
  const south = parseCoord(rawSouth, 'south');
  const east = parseCoord(rawEast, 'east');
  const north = parseCoord(rawNorth, 'north');

  // 2. Range checks
  if (south < -90 || south > 90) {
    throw new BboxValidationError(
      `South latitude must be between -90 and 90 degrees (received ${south})`,
      'south',
      south
    );
  }
  if (north < -90 || north > 90) {
    throw new BboxValidationError(
      `North latitude must be between -90 and 90 degrees (received ${north})`,
      'north',
      north
    );
  }
  if (west < -180 || west > 180) {
    throw new BboxValidationError(
      `West longitude must be between -180 and 180 degrees (received ${west})`,
      'west',
      west
    );
  }
  if (east < -180 || east > 180) {
    throw new BboxValidationError(
      `East longitude must be between -180 and 180 degrees (received ${east})`,
      'east',
      east
    );
  }

  // 3. Degenerate & order checks
  if (south === north) {
    throw new BboxValidationError(
      `Degenerate bounding box: south and north latitude are identical (${south})`,
      'south_north',
      south
    );
  }
  if (south > north) {
    throw new BboxValidationError(
      `South latitude (${south}) must be strictly less than north latitude (${north})`,
      'south_north',
      { south, north }
    );
  }
  if (west === east) {
    throw new BboxValidationError(
      `Degenerate bounding box: west and east longitude are identical (${west})`,
      'west_east',
      west
    );
  }
  if (west > east) {
    throw new BboxValidationError(
      `West longitude (${west}) must be strictly less than east longitude (${east})`,
      'west_east',
      { west, east }
    );
  }

  // 4. Area & span ceiling
  const latSpan = north - south;
  const lonSpan = east - west;
  const areaDeg2 = latSpan * lonSpan;

  if (latSpan > MAX_LAT_SPAN_DEG) {
    throw new BboxValidationError(
      `Latitude span (${latSpan.toFixed(4)}°) exceeds maximum allowed span of ${MAX_LAT_SPAN_DEG}°`,
      'latSpan',
      latSpan
    );
  }
  if (lonSpan > MAX_LON_SPAN_DEG) {
    throw new BboxValidationError(
      `Longitude span (${lonSpan.toFixed(4)}°) exceeds maximum allowed span of ${MAX_LON_SPAN_DEG}°`,
      'lonSpan',
      lonSpan
    );
  }
  if (areaDeg2 > MAX_BBOX_AREA_DEG2) {
    throw new BboxValidationError(
      `Bounding box area (${areaDeg2.toFixed(4)} deg²) exceeds maximum allowed ceiling of ${MAX_BBOX_AREA_DEG2} deg²`,
      'area',
      areaDeg2
    );
  }

  return { west, south, east, north };
}
