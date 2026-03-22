import { GeospatialQueryBuilder } from '../builders/GeospatialQueryBuilder';
import type { FilterBuildContext } from '../FilterBuildContext';
import type { FilteredQueryResult, CteResult, GeospatialOptions } from '../types';
import { buildGeospatialQueryContext } from './geospatialQueryContext';
import {
  buildGeospatialCountQuery as buildGeospatialCountQueryFromContext,
  buildGeospatialListQuery,
} from './geospatialQueryBuilders';

export class GeospatialModule {
  constructor(
    private ctx: FilterBuildContext,
    private getFilteredObservationsCte: (options?: { selectedBssids?: string[] }) => CteResult
  ) {}

  public buildGeospatialQuery(options: GeospatialOptions = {}): FilteredQueryResult {
    const builder = new GeospatialQueryBuilder(this.ctx.context as any, () =>
      this.buildGeospatialQueryImpl(options)
    );
    return builder.build();
  }

  private buildGeospatialQueryImpl(options: GeospatialOptions = {}): FilteredQueryResult {
    const { selectedBssids = [] } = options;
    const context = buildGeospatialQueryContext(
      this.ctx,
      this.getFilteredObservationsCte({ selectedBssids }),
      options
    );
    return buildGeospatialListQuery(this.ctx, context);
  }

  public buildGeospatialCountQuery(): FilteredQueryResult {
    const context = buildGeospatialQueryContext(this.ctx, this.getFilteredObservationsCte());
    return buildGeospatialCountQueryFromContext(this.ctx, context);
  }
}
