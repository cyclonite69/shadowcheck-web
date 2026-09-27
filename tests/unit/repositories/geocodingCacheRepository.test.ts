import {
  upsertAddressSuccess,
  upsertAddressFailure,
  upsertPoiSuccess,
  upsertPoiFailure,
  insertNetworkRepresentativeCandidates,
  insertObservationCandidates,
  fetchPoiRows,
  fetchNonMapboxAddressRows,
  fetchMapboxAddressRows,
  resetFailedAddressAttempts,
} from '../../../server/src/repositories/geocodingCacheRepository';

describe('geocodingCacheRepository', () => {
  const row = { lat_round: 42.12345, lon_round: -83.12345 };
  const provider = 'mapbox';

  describe('upsertAddressSuccess', () => {
    it('executes INSERT with address success fields', async () => {
      const mockExecutor = jest.fn().mockResolvedValue({ rowCount: 1 });
      const result = {
        ok: true,
        address: '123 Main St',
        city: 'Detroit',
        state: 'MI',
        postal: '48201',
        country: 'US',
        confidence: 0.95,
        raw: { test: true },
      };

      await upsertAddressSuccess(mockExecutor, 5, row, provider, result);

      expect(mockExecutor).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecutor.mock.calls[0];
      expect(sql).toContain('INSERT INTO app.geocoding_cache');
      expect(sql).toContain('address_attempts = app.geocoding_cache.address_attempts + 1');
      expect(sql).toContain('address = EXCLUDED.address');
      expect(params).toEqual([
        5,
        42.12345,
        -83.12345,
        'mapbox',
        { test: true },
        '123 Main St',
        'Detroit',
        'MI',
        '48201',
        'US',
        0.95,
      ]);
    });
  });

  describe('upsertAddressFailure', () => {
    it('executes INSERT with address failure fields', async () => {
      const mockExecutor = jest.fn().mockResolvedValue({ rowCount: 1 });
      const result = { ok: false, raw: null };

      await upsertAddressFailure(mockExecutor, 5, row, provider, result);

      expect(mockExecutor).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecutor.mock.calls[0];
      expect(sql).toContain('INSERT INTO app.geocoding_cache');
      expect(sql).toContain('address_attempts = app.geocoding_cache.address_attempts + 1');
      expect(params).toEqual([5, 42.12345, -83.12345, 'mapbox', null]);
    });
  });

  describe('upsertPoiSuccess', () => {
    it('executes INSERT with POI success fields', async () => {
      const mockExecutor = jest.fn().mockResolvedValue({ rowCount: 1 });
      const result = {
        ok: true,
        poiName: 'City Hall',
        poiCategory: 'civic',
        featureType: 'building',
        raw: { source: 'osm' },
      };

      await upsertPoiSuccess(mockExecutor, 5, row, provider, result);

      expect(mockExecutor).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecutor.mock.calls[0];
      expect(sql).toContain('INSERT INTO app.geocoding_cache');
      expect(sql).toContain('poi_name = EXCLUDED.poi_name');
      expect(sql).toContain('poi_attempts = app.geocoding_cache.poi_attempts + 1');
      expect(params).toEqual([
        5,
        42.12345,
        -83.12345,
        'mapbox',
        { source: 'osm' },
        'City Hall',
        'civic',
        'building',
      ]);
    });
  });

  describe('upsertPoiFailure', () => {
    it('executes INSERT with POI failure fields', async () => {
      const mockExecutor = jest.fn().mockResolvedValue({ rowCount: 1 });
      const result = { ok: false, raw: null };

      await upsertPoiFailure(mockExecutor, 5, row, provider, result);

      expect(mockExecutor).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecutor.mock.calls[0];
      expect(sql).toContain('INSERT INTO app.geocoding_cache');
      expect(sql).toContain('poi_attempts = app.geocoding_cache.poi_attempts + 1');
      expect(params).toEqual([5, 42.12345, -83.12345, 'mapbox', null]);
    });
  });

  describe('insertNetworkRepresentativeCandidates', () => {
    it('executes network candidate query and returns count', async () => {
      const mockExecutor = jest.fn().mockResolvedValue({ rows: [{ inserted_count: 7 }] });

      const count = await insertNetworkRepresentativeCandidates(mockExecutor, 50);

      expect(count).toBe(7);
      expect(mockExecutor).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecutor.mock.calls[0];
      expect(sql).toContain('FROM app.api_network_explorer_mv mv');
      expect(sql).toContain('ON CONFLICT (precision, lat_round, lon_round) DO NOTHING');
      expect(params).toEqual([50]);
    });
  });

  describe('insertObservationCandidates', () => {
    it('executes observation candidate query and returns count', async () => {
      const mockExecutor = jest.fn().mockResolvedValue({ rows: [{ inserted_count: 12 }] });

      const count = await insertObservationCandidates(mockExecutor, 5, 100);

      expect(count).toBe(12);
      expect(mockExecutor).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecutor.mock.calls[0];
      expect(sql).toContain('FROM app.observations');
      expect(sql).toContain('ON CONFLICT (precision, lat_round, lon_round) DO NOTHING');
      expect(params).toEqual([5, 100]);
    });
  });

  describe('fetchPoiRows', () => {
    it('queries POI rows with correct predicate and limits', async () => {
      const mockRows = [{ lat_round: 42.0, lon_round: -83.0, address: 'Test' }];
      const mockExecutor = jest.fn().mockResolvedValue({ rows: mockRows });

      const rows = await fetchPoiRows(mockExecutor, 5, 25);

      expect(rows).toEqual(mockRows);
      expect(mockExecutor).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecutor.mock.calls[0];
      expect(sql).toContain('c.poi_name IS NULL');
      expect(sql).toContain('c.poi_attempts = 0');
      expect(params).toEqual([25, 5]);
    });
  });

  describe('fetchNonMapboxAddressRows', () => {
    it('queries address rows for non-mapbox without attempt cap', async () => {
      const mockRows = [{ lat_round: 42.0, lon_round: -83.0, address: null }];
      const mockExecutor = jest.fn().mockResolvedValue({ rows: mockRows });

      const rows = await fetchNonMapboxAddressRows(mockExecutor, 5, 30);

      expect(rows).toEqual(mockRows);
      expect(mockExecutor).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecutor.mock.calls[0];
      expect(sql).toContain('c.address IS NULL');
      expect(sql).not.toContain('c.address_attempts < 3');
      expect(params).toEqual([30, 5]);
    });
  });

  describe('fetchMapboxAddressRows', () => {
    it('queries address rows with attempt cap < 3 for mapbox', async () => {
      const mockRows = [{ lat_round: 42.0, lon_round: -83.0, address: null }];
      const mockExecutor = jest.fn().mockResolvedValue({ rows: mockRows });

      const rows = await fetchMapboxAddressRows(mockExecutor, 5, 30);

      expect(rows).toEqual(mockRows);
      expect(mockExecutor).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecutor.mock.calls[0];
      expect(sql).toContain('c.address IS NULL');
      expect(sql).toContain('c.address_attempts < 3');
      expect(params).toEqual([30, 5]);
    });
  });

  describe('resetFailedAddressAttempts', () => {
    it('updates failed address attempts to 0 and returns rowCount', async () => {
      const mockExecutor = jest.fn().mockResolvedValue({ rowCount: 15 });

      const count = await resetFailedAddressAttempts(mockExecutor, 5);

      expect(count).toBe(15);
      expect(mockExecutor).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecutor.mock.calls[0];
      expect(sql).toContain('UPDATE app.geocoding_cache');
      expect(sql).toContain('SET address_attempts = 0');
      expect(params).toEqual([5]);
    });
  });
});
