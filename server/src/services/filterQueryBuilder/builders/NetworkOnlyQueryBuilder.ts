import type { QueryContext } from '../FilterPredicateBuilder';
import type { FilteredQueryResult } from '../types';

type BuildFn = () => FilteredQueryResult;

export class NetworkOnlyQueryBuilder {
  constructor(
    private readonly context: QueryContext | undefined,
    private readonly buildFn: BuildFn
  ) {}

  build(): FilteredQueryResult {
    if (this.context?.mode && this.context.mode !== 'network-only') {
      throw new Error(
        `${this.constructor.name} expects mode=network-only, got ${this.context.mode}`
      );
    }
    return this.buildFn();
  }
}
