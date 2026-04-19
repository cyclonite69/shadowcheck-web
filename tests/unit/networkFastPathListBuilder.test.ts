import { buildNetworkOnlyQueryImpl } from '../../server/src/services/filterQueryBuilder/modules/networkFastPathListBuilder';
import { FilterBuildContext } from '../../server/src/services/filterQueryBuilder/FilterBuildContext';
import * as predicatesModule from '../../server/src/services/filterQueryBuilder/modules/networkFastPathPredicates';

// Mock the predicates module to easily test empty vs non-empty where clauses
jest.mock('../../server/src/services/filterQueryBuilder/modules/networkFastPathPredicates', () => {
  const original = jest.requireActual('../../server/src/services/filterQueryBuilder/modules/networkFastPathPredicates');
  return {
    ...original,
    buildFastPathPredicates: jest.fn(),
  };
});

describe('networkFastPathListBuilder', () => {
  let ctx: FilterBuildContext;

  beforeEach(() => {
    ctx = new FilterBuildContext({}, {});
    jest.spyOn(ctx, 'addParam').mockImplementation((val) => `$MOCK_PARAM`);
    jest.spyOn(ctx, 'getParams').mockReturnValue(['param1']);
    jest.spyOn(ctx.state, 'appliedFilters').mockReturnValue([{ type: 'test', field: 'field1', value: 'val' }]);
    jest.spyOn(ctx.state, 'ignoredFilters').mockReturnValue([]);
    jest.spyOn(ctx.state, 'warnings').mockReturnValue([]);
    
    (predicatesModule.buildFastPathPredicates as jest.Mock).mockReturnValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('builds query with default options', () => {
    const result = buildNetworkOnlyQueryImpl(ctx, {});
    expect(result.sql).toContain('LIMIT $MOCK_PARAM');
    expect(result.sql).toContain('OFFSET $MOCK_PARAM');
    expect(result.sql).toContain('ORDER BY last_observed_at DESC');
    expect(result.sql).not.toMatch(/nn_agg ON TRUE\s+WHERE/);
    expect(result.params).toEqual(['param1']);
    expect(result.appliedFilters).toHaveLength(1);
  });

  it('builds query with custom options and replacements in orderBy', () => {
    const options = {
      limit: 100,
      offset: 50,
      orderBy: 'l.observed_at ASC, l.level DESC, l.lat, l.lon, l.accuracy, r.observation_count, r.first_observed_at, r.last_observed_at, ne.stationary_confidence, s.stationary_confidence',
      locationMode: 'centroid'
    };
    const result = buildNetworkOnlyQueryImpl(ctx, options as any);
    
    // Check order by replacements
    expect(result.sql).toContain('ORDER BY ne.observed_at ASC, ne.signal DESC, ne.lat, ne.lon, ne.accuracy_meters, ne.observations, ne.first_seen, ne.last_seen, ne.stationary_confidence, ne.stationary_confidence');
    
    // Check parameters added
    expect(ctx.addParam).toHaveBeenCalledWith(100);
    expect(ctx.addParam).toHaveBeenCalledWith(50);
  });

  it('includes where clause if predicates are generated', () => {
    (predicatesModule.buildFastPathPredicates as jest.Mock).mockReturnValue(['ne.type = \'W\'', 'ne.signal > -80']);
    const result = buildNetworkOnlyQueryImpl(ctx, {});
    expect(result.sql).toContain("WHERE ne.type = 'W' AND ne.signal > -80");
  });
});
