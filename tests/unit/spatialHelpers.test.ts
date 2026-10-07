export {};
import { validateFilterPayload } from '../../server/src/services/filterQueryBuilder';
import { getSpatialBoundingBoxFragment } from '../../server/src/services/filterQueryBuilder/spatialHelpers';

function expectedHalves(lat: number, lon: number, radiusMeters: number) {
  const latHalfDeg = radiusMeters / 110574;
  const south = lat - latHalfDeg;
  const north = lat + latHalfDeg;
  if (Math.abs(lat) + latHalfDeg >= 89) {
    return { west: -180, south, east: 180, north, latHalfDeg, lonHalfDeg: null as number | null };
  }
  const polewardLat = Math.min(89.9, Math.abs(lat) + latHalfDeg);
  const lonHalfDeg = radiusMeters / (111320 * Math.cos((polewardLat * Math.PI) / 180));
  return {
    west: lon - lonHalfDeg,
    south,
    east: lon + lonHalfDeg,
    north,
    latHalfDeg,
    lonHalfDeg,
  };
}

describe('getSpatialBoundingBoxFragment', () => {
  test('returns ST_MakeEnvelope fragment with default geom column', () => {
    const result = getSpatialBoundingBoxFragment(38.9, -77.0, 1000);
    expect(result).toContain('ST_MakeEnvelope(');
    expect(result).toContain('4326)');
    expect(result).toMatch(/^geom &&/);
  });

  test('uses custom geom column name', () => {
    const result = getSpatialBoundingBoxFragment(38.9, -77.0, 1000, 'location');
    expect(result).toMatch(/^location &&/);
  });

  test('expands latitude by radius/110574 and longitude by cos(poleward edge)', () => {
    const lat = 40.0;
    const lon = -74.0;
    const radiusMeters = 1000;
    const result = getSpatialBoundingBoxFragment(lat, lon, radiusMeters);
    const e = expectedHalves(lat, lon, radiusMeters);

    expect(result).toContain(`${e.west}`);
    expect(result).toContain(`${e.east}`);
    expect(result).toContain(`${e.south}`);
    expect(result).toContain(`${e.north}`);
    // Must NOT use the old equal-degree /111000 expansion.
    const oldDeg = radiusMeters / 111000;
    expect(result).not.toContain(`${lon - oldDeg}`);
    expect(e.lonHalfDeg).not.toBeNull();
    expect(e.lonHalfDeg as number).toBeGreaterThan(e.latHalfDeg);
  });

  test('small radius at equator uses distinct lat/lon half-widths', () => {
    const lat = 0;
    const lon = 0;
    const radiusMeters = 111;
    const result = getSpatialBoundingBoxFragment(lat, lon, radiusMeters);
    const e = expectedHalves(lat, lon, radiusMeters);
    expect(result).toContain(`${e.west}`);
    expect(result).toContain(`${e.south}`);
    expect(e.lonHalfDeg).not.toBeNull();
    expect(e.lonHalfDeg as number).not.toEqual(e.latHalfDeg);
  });

  test('near-polar circles drop the longitude constraint', () => {
    const lat = 88.5;
    const lon = 10;
    const radiusMeters = 200000; // abs(lat)+latHalfDeg >= 89
    const result = getSpatialBoundingBoxFragment(lat, lon, radiusMeters);
    const e = expectedHalves(lat, lon, radiusMeters);
    expect(e.west).toBe(-180);
    expect(e.east).toBe(180);
    expect(result).toContain('ST_MakeEnvelope(-180,');
    expect(result).toContain(', 180,');
    expect(result).toContain(`${e.south}`);
    expect(result).toContain(`${e.north}`);
  });

  test('antimeridian-crossing circles retain an envelope extending beyond longitude bounds', () => {
    const result = getSpatialBoundingBoxFragment(0, 179.9, 50000);
    const envelope = result.match(/ST_MakeEnvelope\(([^)]+)\)/)?.[1];
    const [west, , east] = envelope?.split(', ').map(Number) ?? [];

    expect(west).toBeLessThan(180);
    expect(east).toBeGreaterThan(180);
  });

  test('extremely large finite radii produce a finite full-longitude envelope', () => {
    const result = getSpatialBoundingBoxFragment(0, 0, 20_000_000);
    const envelope = result.match(/ST_MakeEnvelope\(([^)]+)\)/)?.[1];
    const [west, south, east, north] = envelope?.split(', ').map(Number) ?? [];

    expect(west).toBe(-180);
    expect(east).toBe(180);
    expect(Number.isFinite(south)).toBe(true);
    expect(Number.isFinite(north)).toBe(true);
  });

  test('fragment is valid SQL-like string (no injection vectors)', () => {
    const result = getSpatialBoundingBoxFragment(51.5, -0.1, 500);
    // Should not contain quotes or semicolons
    expect(result).not.toContain("'");
    expect(result).not.toContain(';');
    expect(result).toContain('ST_MakeEnvelope');
  });

  test('helper rejects non-finite values before SQL generation', () => {
    expect(() => getSpatialBoundingBoxFragment(Number.NaN, -83, 500)).toThrow(TypeError);
    expect(() => getSpatialBoundingBoxFragment(43, Number.POSITIVE_INFINITY, 500)).toThrow(
      TypeError
    );
    expect(() => getSpatialBoundingBoxFragment(43, -83, Number.NaN as any)).toThrow(TypeError);
    expect(() => getSpatialBoundingBoxFragment('43' as any, -83, 500)).toThrow(TypeError);
    expect(() => getSpatialBoundingBoxFragment(43, '-83' as any, 500)).toThrow(TypeError);
    expect(() => getSpatialBoundingBoxFragment(43, -83, '500' as any)).toThrow(TypeError);
  });

  test('helper rejects zero and negative radii before SQL generation', () => {
    expect(() => getSpatialBoundingBoxFragment(43, -83, 0)).toThrow(TypeError);
    expect(() => getSpatialBoundingBoxFragment(43, -83, -1)).toThrow(TypeError);
  });
});

describe('radiusFilter validation', () => {
  const validRadiusFilter = { latitude: 40.7, longitude: -73.9, radiusMeters: 1000 };
  const validEnabled = { radiusFilter: true };

  test.each([
    ['numeric-string latitude', { ...validRadiusFilter, latitude: '43' }],
    ['numeric-string longitude', { ...validRadiusFilter, longitude: '-83' }],
    ['numeric-string radius', { ...validRadiusFilter, radiusMeters: '500' }],
    ['NaN latitude', { ...validRadiusFilter, latitude: Number.NaN }],
    ['positive Infinity longitude', { ...validRadiusFilter, longitude: Number.POSITIVE_INFINITY }],
    ['negative Infinity radius', { ...validRadiusFilter, radiusMeters: Number.NEGATIVE_INFINITY }],
    ['latitude below range', { ...validRadiusFilter, latitude: -90.0001 }],
    ['latitude above range', { ...validRadiusFilter, latitude: 90.0001 }],
    ['longitude below range', { ...validRadiusFilter, longitude: -180.0001 }],
    ['longitude above range', { ...validRadiusFilter, longitude: 180.0001 }],
    ['zero radius', { ...validRadiusFilter, radiusMeters: 0 }],
    ['negative radius', { ...validRadiusFilter, radiusMeters: -1 }],
    ['missing latitude', { longitude: -73.9, radiusMeters: 1000 }],
    ['missing longitude', { latitude: 40.7, radiusMeters: 1000 }],
    ['missing radius', { latitude: 40.7, longitude: -73.9 }],
  ])('rejects %s at the validation boundary', (_case, radiusFilter) => {
    const result = validateFilterPayload({ radiusFilter }, validEnabled);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('Radius filter')])
    );
  });

  test.each([
    ['missing radiusFilter', {}],
    ['null radiusFilter', { radiusFilter: null }],
  ])('rejects enabled %s', (_case, filters) => {
    const result = validateFilterPayload(filters, validEnabled);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('Radius filter must include')])
    );
  });

  test('accepts valid decimal coordinates and radius', () => {
    const result = validateFilterPayload(
      {
        radiusFilter: { latitude: 40.7128, longitude: -73.9876, radiusMeters: 1250.5 },
      },
      validEnabled
    );

    expect(result.errors).toEqual([]);
  });

  test('does not validate an omitted radiusFilter when disabled', () => {
    const result = validateFilterPayload(
      { radiusFilter: { latitude: 'bad', longitude: null, radiusMeters: 0 } },
      { radiusFilter: false }
    );
    expect(result.errors).toEqual([]);
  });
});
