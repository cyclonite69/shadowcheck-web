import { buildNetworkOnlyCountQuery } from '../../server/src/services/filterQueryBuilder/modules/networkFastPathCountBuilder';
import { FilterBuildContext } from '../../server/src/services/filterQueryBuilder/FilterBuildContext';
import * as predicatesModule from '../../server/src/services/filterQueryBuilder/modules/networkFastPathPredicates';

jest.mock('../../server/src/services/filterQueryBuilder/modules/networkFastPathPredicates', () => {
  const original = jest.requireActual('../../server/src/services/filterQueryBuilder/modules/networkFastPathPredicates');
  return {
    ...original,
    buildFastPathPredicates: jest.fn(),
  };
});

describe('networkFastPathCountBuilder', () => {
  let ctx: FilterBuildContext;

  beforeEach(() => {
    ctx = new FilterBuildContext({}, {});
    jest.spyOn(ctx, 'getParams').mockReturnValue(['param1', 'param2']);
    
    (predicatesModule.buildFastPathPredicates as jest.Mock).mockReturnValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('builds count query with empty where clause when no predicates', () => {
    const result = buildNetworkOnlyCountQuery(ctx);
    
    expect(result.sql).toContain('SELECT COUNT(*) AS total FROM app.api_network_explorer_mv ne');
    expect(result.sql).not.toMatch(/WHERE\s+ne\./);
    expect(result.params).toEqual(['param1', 'param2']);
    expect(predicatesModule.buildFastPathPredicates).toHaveBeenCalled();
  });

  it('builds count query with where clause when predicates exist', () => {
    (predicatesModule.buildFastPathPredicates as jest.Mock).mockReturnValue(["ne.type = 'W'", "ne.signal > -80"]);
    
    const result = buildNetworkOnlyCountQuery(ctx);
    
    expect(result.sql).toContain("WHERE ne.type = 'W' AND ne.signal > -80");
    expect(result.params).toEqual(['param1', 'param2']);
  });
});
