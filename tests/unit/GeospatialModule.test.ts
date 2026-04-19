import { GeospatialModule } from '../../server/src/services/filterQueryBuilder/modules/GeospatialModule';
import { FilterBuildContext } from '../../server/src/services/filterQueryBuilder/FilterBuildContext';

describe('GeospatialModule', () => {
  let ctx: FilterBuildContext;

  beforeEach(() => {
    ctx = new FilterBuildContext({}, {});
  });

  it('buildGeospatialQuery generates a query without selectedBssids', () => {
    const getFilteredObservationsCte = jest.fn().mockReturnValue({ cte: 'CTE_MOCK', bssidFilter: 'BSSID_MOCK' });
    const module = new GeospatialModule(ctx, getFilteredObservationsCte);
    
    const result = module.buildGeospatialQuery();
    expect(result).toBeDefined();
    expect(getFilteredObservationsCte).toHaveBeenCalledWith({ selectedBssids: [] });
  });

  it('buildGeospatialQuery generates a query with selectedBssids', () => {
    const getFilteredObservationsCte = jest.fn().mockReturnValue({ cte: 'CTE_MOCK', bssidFilter: 'BSSID_MOCK' });
    const module = new GeospatialModule(ctx, getFilteredObservationsCte);
    
    const result = module.buildGeospatialQuery({ selectedBssids: ['aa:bb:cc:dd:ee:ff'] });
    expect(result).toBeDefined();
    expect(getFilteredObservationsCte).toHaveBeenCalledWith({ selectedBssids: ['aa:bb:cc:dd:ee:ff'] });
  });

  it('buildGeospatialCountQuery generates a count query', () => {
    const getFilteredObservationsCte = jest.fn().mockReturnValue({ cte: 'CTE_MOCK', bssidFilter: 'BSSID_MOCK' });
    const module = new GeospatialModule(ctx, getFilteredObservationsCte);
    
    const result = module.buildGeospatialCountQuery();
    expect(result).toBeDefined();
    expect(getFilteredObservationsCte).toHaveBeenCalledWith();
  });

  it('buildGeospatialQueryImpl uses default options if none provided', () => {
    const getFilteredObservationsCte = jest.fn().mockReturnValue({ cte: 'CTE_MOCK', bssidFilter: 'BSSID_MOCK' });
    const module = new GeospatialModule(ctx, getFilteredObservationsCte);
    
    // Call the private method directly to cover the default parameter
    const result = (module as any).buildGeospatialQueryImpl();
    expect(result).toBeDefined();
    expect(getFilteredObservationsCte).toHaveBeenCalledWith({ selectedBssids: [] });
  });
});
