export {};
const layerCountsRepository = require('../../../server/src/repositories/layerCountsRepository');
const dbConfig = require('../../../server/src/config/database');

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

describe('layerCountsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches counts for all 11 layers across 10 tables successfully', async () => {
    (dbConfig.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('location_markers')) {
        return Promise.resolve({ rows: [{ count: 1 }] });
      }
      if (sql.includes('wigle_v3_observations')) {
        return Promise.resolve({ rows: [{ count: 217667 }] });
      }
      if (sql.includes('app.observations')) {
        return Promise.resolve({ rows: [{ count: 870846 }] });
      }
      if (sql.includes('kml_points')) {
        return Promise.resolve({ rows: [{ count: 420764 }] });
      }
      if (sql.includes('wigle_v2_networks_search')) {
        return Promise.resolve({ rows: [{ count: 232007 }] });
      }
      if (sql.includes('federal_courthouses')) {
        return Promise.resolve({ rows: [{ count: 357 }] });
      }
      if (sql.includes('agency_offices')) {
        return Promise.resolve({ rows: [{ field_offices: 56, resident_agencies: 334 }] });
      }
      if (sql.includes('alpr_cameras')) {
        return Promise.resolve({ rows: [{ count: 187308 }] });
      }
      if (sql.includes('shotspotter_zones')) {
        return Promise.resolve({ rows: [{ count: 11 }] });
      }
      if (sql.includes('shotspotter_sensors')) {
        return Promise.resolve({ rows: [{ count: 20280 }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await layerCountsRepository.fetchAuthoritativeLayerCounts();

    expect(result).toEqual({
      home: 1,
      fieldObservations: 870846,
      wigleKml: 420764,
      wigleV2: 232007,
      wigleV3: 217667,
      courthouses: 357,
      fieldOffices: 56,
      residentAgencies: 334,
      alpr: 187308,
      shotspotterZones: 11,
      shotspotterSensors: 20280,
    });
    expect(dbConfig.query).toHaveBeenCalledTimes(10);
  });

  it('handles query failures gracefully by defaulting failed counts to 0', async () => {
    (dbConfig.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('observations')) {
        return Promise.reject(new Error('relation "app.observations" does not exist'));
      }
      if (sql.includes('agency_offices')) {
        return Promise.reject(new Error('DB connection error'));
      }
      return Promise.resolve({ rows: [{ count: 42 }] });
    });

    const result = await layerCountsRepository.fetchAuthoritativeLayerCounts();

    expect(result.fieldObservations).toBe(0);
    expect(result.fieldOffices).toBe(0);
    expect(result.residentAgencies).toBe(0);
    expect(result.wigleKml).toBe(42);
    expect(result.home).toBe(42);
  });
});
