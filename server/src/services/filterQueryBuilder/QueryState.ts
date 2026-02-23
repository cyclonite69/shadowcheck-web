import type { AppliedFilter, IgnoredFilter } from './types';

export class QueryState {
  private readonly _appliedFilters: AppliedFilter[];
  private readonly _ignoredFilters: IgnoredFilter[];
  private readonly _warnings: string[];

  constructor(
    appliedFilters: AppliedFilter[] = [],
    ignoredFilters: IgnoredFilter[] = [],
    warnings: string[] = []
  ) {
    this._appliedFilters = appliedFilters;
    this._ignoredFilters = ignoredFilters;
    this._warnings = warnings;
  }

  withAppliedFilter(type: string, field: string, value: unknown): QueryState {
    return new QueryState(
      [...this._appliedFilters, { type, field, value }],
      this._ignoredFilters,
      this._warnings
    );
  }

  withIgnoredFilter(type: string, field: string, reason: string): QueryState {
    return new QueryState(
      this._appliedFilters,
      [...this._ignoredFilters, { type, field, reason }],
      this._warnings
    );
  }

  withWarning(message: string): QueryState {
    return new QueryState(this._appliedFilters, this._ignoredFilters, [...this._warnings, message]);
  }

  appliedFilters(): AppliedFilter[] {
    return [...this._appliedFilters];
  }

  ignoredFilters(): IgnoredFilter[] {
    return [...this._ignoredFilters];
  }

  warnings(): string[] {
    return [...this._warnings];
  }
}
