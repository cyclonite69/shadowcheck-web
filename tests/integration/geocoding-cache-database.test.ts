import { adminQuery } from '../../server/src/services/adminDbService';
import { upsertGeocodeCacheBatch } from '../../server/src/services/geocoding/cacheDatabase';
import type { GeocodeCacheWrite } from '../../server/src/services/geocoding/cacheStore';
import { describeIfIntegration } from '../helpers/integrationEnv';

describeIfIntegration('geocoding cache batch persistence characterization', () => {
  const precision = 5;
  const unrelatedCoordinates = { lat: 41.99991, lon: -82.99991 };
  const targetCoordinates = { lat: 41.99992, lon: -82.99992 };
  const seededGeocodedAt = new Date('2020-01-01T00:00:00.000Z');

  const cleanupRows = async () => {
    await adminQuery(
      `
        DELETE FROM app.geocoding_cache
        WHERE "precision" = $1
          AND (
            (lat_round = $2 AND lon_round = $3)
            OR (lat_round = $4 AND lon_round = $5)
          )
      `,
      [
        precision,
        targetCoordinates.lat,
        targetCoordinates.lon,
        unrelatedCoordinates.lat,
        unrelatedCoordinates.lon,
      ]
    );
  };

  const seedRow = async (overrides: Record<string, unknown> = {}) => {
    await adminQuery(
      `
        INSERT INTO app.geocoding_cache (
          "precision",
          lat_round,
          lon_round,
          lat,
          lon,
          geocoded_at,
          raw_response,
          poi_skip,
          poi_attempts,
          address_attempts,
          address,
          poi_name,
          poi_category,
          feature_type,
          city,
          state,
          postal_code,
          country,
          provider,
          confidence
        )
        VALUES (
          $1, $2, $3, $2, $3, $4, NULL, false, 0, 0,
          $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
        ON CONFLICT ("precision", lat_round, lon_round) DO UPDATE SET
          geocoded_at = EXCLUDED.geocoded_at,
          raw_response = EXCLUDED.raw_response,
          poi_skip = EXCLUDED.poi_skip,
          poi_attempts = EXCLUDED.poi_attempts,
          address_attempts = EXCLUDED.address_attempts,
          address = EXCLUDED.address,
          poi_name = EXCLUDED.poi_name,
          poi_category = EXCLUDED.poi_category,
          feature_type = EXCLUDED.feature_type,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          postal_code = EXCLUDED.postal_code,
          country = EXCLUDED.country,
          provider = EXCLUDED.provider,
          confidence = EXCLUDED.confidence
      `,
      [
        precision,
        targetCoordinates.lat,
        targetCoordinates.lon,
        seededGeocodedAt,
        overrides.address ?? null,
        overrides.poi_name ?? null,
        overrides.poi_category ?? null,
        overrides.feature_type ?? null,
        overrides.city ?? null,
        overrides.state ?? null,
        overrides.postal_code ?? null,
        overrides.country ?? null,
        overrides.provider ?? null,
        overrides.confidence ?? null,
      ]
    );
  };

  const readTargetRow = async () => {
    const result = await adminQuery(
      `
        SELECT
          address,
          poi_name,
          poi_category,
          feature_type,
          city,
          state,
          postal_code,
          country,
          provider,
          confidence,
          geocoded_at,
          raw_response,
          address_attempted_at,
          address_attempts,
          poi_attempted_at,
          poi_attempts
        FROM app.geocoding_cache
        WHERE "precision" = $1
          AND lat_round = $2
          AND lon_round = $3
      `,
      [precision, targetCoordinates.lat, targetCoordinates.lon]
    );
    return result.rows[0];
  };

  const writeFor = (result: GeocodeCacheWrite['result'], mode: GeocodeCacheWrite['mode']) =>
    upsertGeocodeCacheBatch(precision, [
      {
        row: { lat_round: targetCoordinates.lat, lon_round: targetCoordinates.lon },
        provider: 'locationiq',
        result,
        mode,
      },
    ]);

  beforeAll(async () => {
    await cleanupRows();
    await adminQuery(
      `
        INSERT INTO app.geocoding_cache (
          "precision", lat_round, lon_round, lat, lon, geocoded_at, poi_skip
        )
        VALUES ($1, $2, $3, $2, $3, $4, false)
      `,
      [precision, unrelatedCoordinates.lat, unrelatedCoordinates.lon, seededGeocodedAt]
    );
  });

  beforeEach(async () => {
    await seedRow();
  });

  afterAll(async () => {
    const unrelated = await adminQuery(
      `
        SELECT address, poi_name, provider, geocoded_at, address_attempts, poi_attempts
        FROM app.geocoding_cache
        WHERE "precision" = $1
          AND lat_round = $2
          AND lon_round = $3
      `,
      [precision, unrelatedCoordinates.lat, unrelatedCoordinates.lon]
    );

    expect(unrelated.rows).toEqual([
      expect.objectContaining({
        address: null,
        poi_name: null,
        provider: null,
        geocoded_at: seededGeocodedAt,
        address_attempts: 0,
        poi_attempts: 0,
      }),
    ]);

    await cleanupRows();
  });

  test('persists address success fields and increments address attempts', async () => {
    const before = await readTargetRow();
    const startedAt = Date.now();

    await writeFor(
      {
        ok: true,
        address: '123 Main Street',
        city: 'Ann Arbor',
        state: 'MI',
        postal: '48104',
        country: 'US',
        confidence: 0.91,
        raw: { source: 'test-address-success' },
      },
      'address-only'
    );

    const row = await readTargetRow();
    expect(row).toMatchObject({
      address: '123 Main Street',
      city: 'Ann Arbor',
      state: 'MI',
      postal_code: '48104',
      country: 'US',
      provider: 'locationiq',
      confidence: '0.9100',
      raw_response: { source: 'test-address-success' },
      address_attempts: 1,
    });
    expect(row.poi_name).toBeNull();
    expect(row.poi_attempts).toBe(0);
    expect(row.geocoded_at.getTime()).toBeGreaterThanOrEqual(startedAt);
    expect(row.address_attempted_at.getTime()).toBeGreaterThanOrEqual(startedAt);
    expect(before.geocoded_at).toEqual(seededGeocodedAt);
  });

  test('records address failure without changing address fields or geocoded_at', async () => {
    const before = await readTargetRow();
    const startedAt = Date.now();

    await writeFor(
      {
        ok: false,
        error: 'no address found',
        raw: { source: 'test-address-failure' },
      },
      'address-only'
    );

    const row = await readTargetRow();
    expect(row).toMatchObject({
      address: null,
      city: null,
      state: null,
      postal_code: null,
      country: null,
      provider: 'locationiq',
      raw_response: { source: 'test-address-failure' },
      address_attempts: 1,
    });
    expect(row.poi_name).toBeNull();
    expect(row.poi_attempts).toBe(0);
    expect(row.geocoded_at).toEqual(before.geocoded_at);
    expect(row.address_attempted_at.getTime()).toBeGreaterThanOrEqual(startedAt);
  });

  test('persists POI success fields while preserving existing address fields', async () => {
    await seedRow({
      address: '456 Oak Avenue',
      city: 'Detroit',
      state: 'MI',
      postal_code: '48201',
      country: 'US',
    });
    const before = await readTargetRow();
    const startedAt = Date.now();

    await writeFor(
      {
        ok: true,
        poiName: 'Central Library',
        poiCategory: 'library',
        featureType: 'amenity',
        raw: { source: 'test-poi-success' },
      },
      'poi-only'
    );

    const row = await readTargetRow();
    expect(row).toMatchObject({
      poi_name: 'Central Library',
      poi_category: 'library',
      feature_type: 'amenity',
      provider: 'locationiq',
      raw_response: { source: 'test-poi-success' },
      poi_attempts: 1,
      address: before.address,
      city: before.city,
      state: before.state,
      postal_code: before.postal_code,
      country: before.country,
    });
    expect(row.poi_attempted_at.getTime()).toBeGreaterThanOrEqual(startedAt);
  });

  test('records POI failure while preserving existing address fields', async () => {
    await seedRow({
      address: '789 Pine Road',
      city: 'Ypsilanti',
      state: 'MI',
      postal_code: '48197',
      country: 'US',
    });
    const before = await readTargetRow();
    const startedAt = Date.now();

    await writeFor(
      {
        ok: false,
        error: 'no POI found',
        raw: { source: 'test-poi-failure' },
      },
      'poi-only'
    );

    const row = await readTargetRow();
    expect(row).toMatchObject({
      poi_name: null,
      provider: 'locationiq',
      raw_response: { source: 'test-poi-failure' },
      poi_attempts: 1,
      address: before.address,
      city: before.city,
      state: before.state,
      postal_code: before.postal_code,
      country: before.country,
    });
    expect(row.poi_attempted_at.getTime()).toBeGreaterThanOrEqual(startedAt);
  });
});
