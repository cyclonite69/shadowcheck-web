export {};

import {
  buildExplorerV2Query,
  buildLegacyExplorerQuery,
} from '../../server/src/services/explorerQueries';

describe('explorer query builders', () => {
  it('builds legacy explorer query with search and pagination params', () => {
    const { sql, params } = buildLegacyExplorerQuery({
      homeLon: -73,
      homeLat: 40,
      search: 'home',
      sort: 'ssid',
      order: 'ASC',
      qualityWhere: '',
      limit: 25,
      offset: 50,
    });

    expect(sql).toContain('WITH obs_latest AS');
    expect(sql).toContain('ORDER BY ssid ASC');
    expect(sql).toContain('LIMIT $5 OFFSET $6');
    expect(params).toEqual([-73, 40, '%home%', '%home%', 25, 50]);
  });

  it('builds v2 explorer query with threat ordering and optional pagination', () => {
    const { sql, params } = buildExplorerV2Query({
      search: 'corp',
      sort: 'threat,manufacturer',
      order: 'desc,asc',
      limit: 10,
      offset: 0,
    });

    expect(sql).toContain('FROM app.api_network_explorer_mv mv');
    expect(sql).toContain('jsonb_build_object(');
    expect(sql).toContain('LIMIT $5 OFFSET $6');
    expect(sql).toContain('manufacturer ASC NULLS LAST');
    expect(params).toEqual(['%corp%', '%corp%', '%corp%', '%corp%', 10, 0]);
  });

  it('builds v2 explorer query with stable distance-from-home calculation', () => {
    const { sql } = buildExplorerV2Query({
      search: '',
      sort: 'distance',
      order: 'asc',
      limit: 10,
      offset: 0,
    });

    expect(sql).toContain('WITH home_location AS');
    expect(sql).toContain('mv.weighted_lat IS NOT NULL AND mv.weighted_lon IS NOT NULL');
    expect(sql).toContain('mv.centroid_lat IS NOT NULL AND mv.centroid_lon IS NOT NULL');
    expect(sql).toContain('AS distance_from_home_km');
    expect(sql).toContain('ORDER BY distance_from_home_km ASC NULLS LAST');
  });
});
