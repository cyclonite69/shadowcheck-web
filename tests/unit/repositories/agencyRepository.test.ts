export {};

import {
  fetchAgencyOfficesGeoJSON,
  fetchAgencyOfficeCounts,
} from '../../../server/src/repositories/agencyRepository';
const { query } = require('../../../server/src/config/database');

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

describe('agencyRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetchAgencyOfficesGeoJSON returns FeatureCollection', async () => {
    (query as jest.Mock).mockResolvedValue({
      rows: [{ geojson: { type: 'FeatureCollection', features: [] } }],
    });
    const result = await fetchAgencyOfficesGeoJSON();
    expect(query).toHaveBeenCalled();
    expect(result.type).toBe('FeatureCollection');
  });

  test('fetchAgencyOfficeCounts returns rows', async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{ office_type: 'type1', count: 1 }] });
    const result = await fetchAgencyOfficeCounts();
    expect(result).toHaveLength(1);
    expect(result[0].office_type).toBe('type1');
  });
});
