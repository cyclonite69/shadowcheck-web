import { buildNetworkDashboardMetricsQuery, buildThreatSeverityCountsQuery } from '../../server/src/services/filterQueryBuilder/modules/networkMetricsBuilder';
import { FilterBuildContext } from '../../server/src/services/filterQueryBuilder/FilterBuildContext';
import * as fastPathBuilder from '../../server/src/services/filterQueryBuilder/modules/networkFastPathBuilder';

jest.mock('../../server/src/services/filterQueryBuilder/modules/networkFastPathBuilder', () => ({
  buildNetworkOnlyCountQuery: jest.fn(),
}));

describe('networkMetricsBuilder', () => {
  let ctx: FilterBuildContext;

  beforeEach(() => {
    ctx = new FilterBuildContext({}, {});
    ctx.enabled = { wifi: true, ble: false } as any;
    jest.spyOn(ctx, 'getParams').mockReturnValue(['param1']);
    jest.spyOn(ctx, 'isFastPathEligible').mockReturnValue(false);
    jest.spyOn(ctx, 'shouldIncludeIgnoredByExplicitTagFilter').mockReturnValue(false);
    jest.spyOn(ctx, 'buildNetworkWhere').mockReturnValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const getFilteredObservationsCte = () => ({
    cte: 'WITH filtered_obs AS (SELECT * FROM mock)',
    bssidFilter: '',
    params: [],
  });

  describe('buildNetworkDashboardMetricsQuery', () => {
    it('uses fast path when networkOnly is true and countResult has WHERE', () => {
      jest.spyOn(ctx, 'isFastPathEligible').mockReturnValue(true);
      (fastPathBuilder.buildNetworkOnlyCountQuery as jest.Mock).mockReturnValue({
        sql: 'SELECT COUNT(*) FROM app.api_network_explorer_mv ne WHERE ne.type = $1',
        params: ['W'],
      });

      const result = buildNetworkDashboardMetricsQuery(ctx, getFilteredObservationsCte);

      expect(result.sql).toContain('WHERE ne.type = $1');
      expect(result.params).toEqual(['W']);
    });

    it('uses fast path when networkOnly is true and countResult has NO WHERE', () => {
      jest.spyOn(ctx, 'isFastPathEligible').mockReturnValue(true);
      (fastPathBuilder.buildNetworkOnlyCountQuery as jest.Mock).mockReturnValue({
        sql: 'SELECT COUNT(*) FROM app.api_network_explorer_mv ne',
        params: [],
      });

      const result = buildNetworkDashboardMetricsQuery(ctx, getFilteredObservationsCte);

      expect(result.sql).not.toMatch(/FROM app\.api_network_explorer_mv ne\s+WHERE/);
      expect(result.params).toEqual([]);
    });

    it('uses CTE path when networkOnly is false (whereClause > 0, includeIgnored = false)', () => {
      jest.spyOn(ctx, 'shouldIncludeIgnoredByExplicitTagFilter').mockReturnValue(false);
      jest.spyOn(ctx, 'buildNetworkWhere').mockReturnValue(['ne.type = $1']);

      const result = buildNetworkDashboardMetricsQuery(ctx, getFilteredObservationsCte);

      expect(result.sql).toContain('WHERE ne.type = $1 AND NOT EXISTS (');
    });

    it('uses CTE path when networkOnly is false (whereClause > 0, includeIgnored = true)', () => {
      jest.spyOn(ctx, 'shouldIncludeIgnoredByExplicitTagFilter').mockReturnValue(true);
      jest.spyOn(ctx, 'buildNetworkWhere').mockReturnValue(['ne.type = $1']);

      const result = buildNetworkDashboardMetricsQuery(ctx, getFilteredObservationsCte);

      expect(result.sql).toContain('WHERE ne.type = $1');
      expect(result.sql).not.toContain('AND NOT EXISTS');
    });

    it('uses CTE path when networkOnly is false (whereClause = 0, includeIgnored = false)', () => {
      jest.spyOn(ctx, 'shouldIncludeIgnoredByExplicitTagFilter').mockReturnValue(false);
      jest.spyOn(ctx, 'buildNetworkWhere').mockReturnValue([]);

      const result = buildNetworkDashboardMetricsQuery(ctx, getFilteredObservationsCte);

      expect(result.sql).toContain('WHERE NOT EXISTS');
    });

    it('uses CTE path when networkOnly is false (whereClause = 0, includeIgnored = true)', () => {
      jest.spyOn(ctx, 'shouldIncludeIgnoredByExplicitTagFilter').mockReturnValue(true);
      jest.spyOn(ctx, 'buildNetworkWhere').mockReturnValue([]);

      const result = buildNetworkDashboardMetricsQuery(ctx, getFilteredObservationsCte);

      // Should not contain WHERE or NOT EXISTS clause
      expect(result.sql).not.toMatch(/ON UPPER\(ne\.bssid\) = UPPER\(r\.bssid\)\s+WHERE\s+ne\./);
      expect(result.sql).not.toContain('NOT EXISTS');
    });
  });

  describe('buildThreatSeverityCountsQuery', () => {
    it('uses fast path when networkOnly is true and countResult has WHERE', () => {
      jest.spyOn(ctx, 'isFastPathEligible').mockReturnValue(true);
      (fastPathBuilder.buildNetworkOnlyCountQuery as jest.Mock).mockReturnValue({
        sql: 'SELECT COUNT(*) FROM app.api_network_explorer_mv ne WHERE ne.type = $1',
        params: ['W'],
      });

      const result = buildThreatSeverityCountsQuery(ctx, getFilteredObservationsCte);

      expect(result.sql).toContain('WHERE ne.type = $1');
      expect(result.params).toEqual(['W']);
    });

    it('uses fast path when networkOnly is true and countResult has NO WHERE', () => {
      jest.spyOn(ctx, 'isFastPathEligible').mockReturnValue(true);
      (fastPathBuilder.buildNetworkOnlyCountQuery as jest.Mock).mockReturnValue({
        sql: 'SELECT COUNT(*) FROM app.api_network_explorer_mv ne',
        params: [],
      });

      const result = buildThreatSeverityCountsQuery(ctx, getFilteredObservationsCte);

      expect(result.sql).not.toMatch(/FROM app\.api_network_explorer_mv ne\s+WHERE/);
      expect(result.params).toEqual([]);
    });

    it('uses CTE path when networkOnly is false (whereClause > 0, includeIgnored = false)', () => {
      jest.spyOn(ctx, 'shouldIncludeIgnoredByExplicitTagFilter').mockReturnValue(false);
      jest.spyOn(ctx, 'buildNetworkWhere').mockReturnValue(['ne.type = $1']);

      const result = buildThreatSeverityCountsQuery(ctx, getFilteredObservationsCte);

      expect(result.sql).toContain('WHERE ne.type = $1 AND NOT EXISTS (');
    });

    it('uses CTE path when networkOnly is false (whereClause > 0, includeIgnored = true)', () => {
      jest.spyOn(ctx, 'shouldIncludeIgnoredByExplicitTagFilter').mockReturnValue(true);
      jest.spyOn(ctx, 'buildNetworkWhere').mockReturnValue(['ne.type = $1']);

      const result = buildThreatSeverityCountsQuery(ctx, getFilteredObservationsCte);

      expect(result.sql).toContain('WHERE ne.type = $1');
      expect(result.sql).not.toContain('AND NOT EXISTS');
    });

    it('uses CTE path when networkOnly is false (whereClause = 0, includeIgnored = false)', () => {
      jest.spyOn(ctx, 'shouldIncludeIgnoredByExplicitTagFilter').mockReturnValue(false);
      jest.spyOn(ctx, 'buildNetworkWhere').mockReturnValue([]);

      const result = buildThreatSeverityCountsQuery(ctx, getFilteredObservationsCte);

      expect(result.sql).toContain('WHERE NOT EXISTS');
    });

    it('uses CTE path when networkOnly is false (whereClause = 0, includeIgnored = true)', () => {
      jest.spyOn(ctx, 'shouldIncludeIgnoredByExplicitTagFilter').mockReturnValue(true);
      jest.spyOn(ctx, 'buildNetworkWhere').mockReturnValue([]);

      const result = buildThreatSeverityCountsQuery(ctx, getFilteredObservationsCte);

      expect(result.sql).not.toMatch(/ON UPPER\(ne\.bssid\) = UPPER\(r\.bssid\)\s+WHERE\s+ne\./);
      expect(result.sql).not.toContain('NOT EXISTS');
    });
  });
});
