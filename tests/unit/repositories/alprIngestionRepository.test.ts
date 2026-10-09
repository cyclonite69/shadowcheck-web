const mockAdminQuery = jest.fn();

jest.mock('../../../server/src/services/adminDbService', () => ({
  adminQuery: mockAdminQuery,
}));

import {
  deleteInsertedAlprCameras,
  getExistingAlprCameras,
  restoreAlprCameras,
  upsertAlprCameras,
  vacuumAnalyzeAlprCameras,
} from '../../../server/src/repositories/alprIngestionRepository';

describe('alprIngestionRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads existing camera snapshots with parameterized OSM IDs', async () => {
    const rows = [
      { osm_id: '101', geom_wkt: 'POINT(-74 40)', source_properties: {}, last_seen: '' },
    ];
    mockAdminQuery.mockResolvedValue({ rows });

    await expect(getExistingAlprCameras(['101'])).resolves.toEqual(rows);
    expect(mockAdminQuery.mock.calls[0][0]).toContain('WHERE osm_id = ANY($1::bigint[])');
    expect(mockAdminQuery.mock.calls[0][1]).toEqual([['101']]);
  });

  it('upserts records in a parameterized PostGIS batch and returns inserted IDs', async () => {
    mockAdminQuery.mockResolvedValue({
      rows: [
        { osm_id: '101', inserted: true },
        { osm_id: '102', inserted: false },
      ],
    });
    const records = [
      { osmId: '101', lon: -74, lat: 40, sourceProperties: { man_made: 'surveillance' } },
      { osmId: '102', lon: -73, lat: 41, sourceProperties: { 'camera:type': 'fixed' } },
    ];

    await expect(upsertAlprCameras(records, new Date('2026-01-01T00:00:00Z'))).resolves.toEqual({
      insertedIds: ['101'],
      updated: 1,
    });
    expect(mockAdminQuery.mock.calls[0][0]).toContain(
      'ST_SetSRID(ST_MakePoint(t.lon, t.lat), 4326)'
    );
    expect(mockAdminQuery.mock.calls[0][0]).toContain('ON CONFLICT (osm_id) DO UPDATE');
    expect(mockAdminQuery.mock.calls[0][1][0]).toEqual(['101', '102']);
  });

  it('provides maintenance and rollback operations', async () => {
    mockAdminQuery.mockResolvedValue({ rows: [] });

    await vacuumAnalyzeAlprCameras();
    await restoreAlprCameras([
      {
        osm_id: '101',
        geom_wkt: 'POINT(-74 40)',
        source_properties: {},
        last_seen: '2026-01-01T00:00:00Z',
      },
    ]);
    await deleteInsertedAlprCameras(['102']);

    expect(mockAdminQuery.mock.calls[0][0]).toBe('VACUUM ANALYZE app.alpr_cameras');
    expect(mockAdminQuery.mock.calls[1][0]).toContain(
      'ST_SetSRID(ST_GeomFromText(t.geom_wkt), 4326)'
    );
    expect(mockAdminQuery.mock.calls[2][0]).toBe(
      'DELETE FROM app.alpr_cameras WHERE osm_id = ANY($1::bigint[])'
    );
    expect(mockAdminQuery.mock.calls[2][1]).toEqual([['102']]);
  });
});
