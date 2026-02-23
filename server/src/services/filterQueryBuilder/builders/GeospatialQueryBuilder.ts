import type { QueryContext } from '../FilterPredicateBuilder';
import type { FilteredQueryResult } from '../types';

type BuildFn = () => FilteredQueryResult;

export class GeospatialQueryBuilder {
  constructor(
    private readonly context: QueryContext | undefined,
    private readonly buildFn: BuildFn
  ) {}

  build(): FilteredQueryResult {
    if (this.context?.mode && this.context.mode !== 'geospatial') {
      throw new Error(
        `${this.constructor.name} expects mode=geospatial, got ${this.context.mode}`
      );
    }
    return this.buildFn();
  }
}
