/**
 * Networking Query Parts Unit Tests
 */

describe('Networking Query Parts Service', () => {
  let buildNetworkQueryParts: any;
  let applyTextAndRangeFilters: jest.Mock;
  let applySecurityAndRadioFilters: jest.Mock;
  let applyLocationFilters: jest.Mock;
  let getBaseJoins: jest.Mock;
  let getBaseSelectColumns: jest.Mock;
  let withDistanceColumn: jest.Mock;
  let createNetworkQueryState: jest.Mock;
  let buildThreatScoreExpr: jest.Mock;
  let buildThreatLevelExpr: jest.Mock;
  let buildDistanceExpr: jest.Mock;
  let NETWORK_CHANNEL_EXPR: jest.Mock;

  beforeEach(() => {
    jest.resetModules();

    applyTextAndRangeFilters = jest.fn();
    applySecurityAndRadioFilters = jest.fn();
    applyLocationFilters = jest.fn();
    getBaseJoins = jest.fn(() => ['JOIN mock_join']);
    getBaseSelectColumns = jest.fn(() => ['col1', 'col2']);
    withDistanceColumn = jest.fn((cols) => [...cols, 'distance']);
    createNetworkQueryState = jest.fn((cols, joins) => ({
      columnsWithDistance: cols,
      joins,
      conditions: [],
      params: [],
      paramIndex: 1,
      appliedFilters: [],
    }));
    buildThreatScoreExpr = jest.fn(() => 'threat_score_expr');
    buildThreatLevelExpr = jest.fn(() => 'threat_level_expr');
    buildDistanceExpr = jest.fn(() => 'distance_expr');
    NETWORK_CHANNEL_EXPR = jest.fn(() => 'channel_expr');

    jest.doMock('../../../../server/src/services/networking/filterBuilders', () => ({
      applyTextAndRangeFilters,
      applySecurityAndRadioFilters,
      applyLocationFilters,
    }));

    jest.doMock('../../../../server/src/services/networking/querySchema', () => ({
      getBaseJoins,
      getBaseSelectColumns,
      withDistanceColumn,
    }));

    jest.doMock('../../../../server/src/services/networking/queryState', () => ({
      createNetworkQueryState,
    }));

    jest.doMock('../../../../server/src/utils/networkSqlExpressions', () => ({
      buildThreatScoreExpr,
      buildThreatLevelExpr,
      buildTypeExpr: jest.fn(() => 'type_expr'),
      buildDistanceExpr,
    }));

    jest.doMock('../../../../server/src/services/filterQueryBuilder/sqlExpressions', () => ({
      NETWORK_CHANNEL_EXPR,
    }));

    buildNetworkQueryParts =
      require('../../../../server/src/services/networking/queryParts').buildNetworkQueryParts;
  });

  describe('buildNetworkQueryParts()', () => {
    it('should build query parts with home location', () => {
      const opts = {
        ssidPattern: 'test%',
        threatLevel: 'HIGH',
      } as any;
      const homeLocation = { lat: 45.0, lon: -93.0 };
      const simpleRuleScoringEnabled = true;

      const result = buildNetworkQueryParts(opts, homeLocation, simpleRuleScoringEnabled);

      expect(result.channelExpr).toBe('channel_expr');
      expect(result.threatLevelExpr).toBe('threat_level_expr');

      expect(getBaseSelectColumns).toHaveBeenCalled();
      expect(withDistanceColumn).toHaveBeenCalledWith(expect.any(Array), true);
      expect(getBaseJoins).toHaveBeenCalled();
      expect(createNetworkQueryState).toHaveBeenCalled();

      expect(applyTextAndRangeFilters).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ ssidPattern: 'test%', threatLevel: 'HIGH' }),
        expect.objectContaining({
          threatLevelExpr: 'threat_level_expr',
          threatScoreExpr: 'threat_score_expr',
          distanceExpr: 'distance_expr',
        })
      );
      expect(applySecurityAndRadioFilters).toHaveBeenCalled();
      expect(applyLocationFilters).toHaveBeenCalled();
    });

    it('should build query parts without home location', () => {
      const opts = {} as any;
      const homeLocation = null;
      const simpleRuleScoringEnabled = false;

      const _result = buildNetworkQueryParts(opts, homeLocation, simpleRuleScoringEnabled);

      expect(withDistanceColumn).toHaveBeenCalledWith(expect.any(Array), false);
      expect(applyTextAndRangeFilters).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          distanceExpr: 'NULL',
        })
      );
    });
  });
});
