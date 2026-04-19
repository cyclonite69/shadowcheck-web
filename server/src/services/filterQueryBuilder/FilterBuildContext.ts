import { FilterPredicateBuilder, type QueryContext } from './FilterPredicateBuilder';
import { QueryState } from './QueryState';
import { validateFilterPayload } from './validators';
import { FILTER_KEYS, NETWORK_ONLY_FILTERS, type FilterKey } from './constants';
import { buildNetworkWhere } from './networkWhereBuilder';
import type { NetworkWhereBuildContext } from './NetworkWhereBuildContext';
import type { Filters, EnabledFlags, AppliedFilter } from './types';

const ENABLE_ONLY_FILTERS = new Set<FilterKey>(['excludeInvalidCoords']);

const hasMeaningfulFilterValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
};

export class FilterBuildContext extends FilterPredicateBuilder {
  public filters: Filters;
  public enabled: EnabledFlags;
  public validationErrors: string[];
  public params: unknown[];
  public paramIndex: number;
  public state: QueryState;
  public obsJoins: Set<string>;
  public requiresHome: boolean;
  public context: (Partial<QueryContext> & { pageType?: 'geospatial' | 'wigle' }) | undefined;
  public perfTracker?: any;

  constructor(
    filters: unknown,
    enabled: unknown,
    context?: {
      pageType?: 'geospatial' | 'wigle';
      mode?: QueryContext['mode'];
      alias?: string;
      trackPerformance?: boolean;
    }
  ) {
    super();
    const { errors, filters: normalized, enabled: flags } = validateFilterPayload(filters, enabled);
    this.filters = normalized;
    this.enabled = flags;
    this.validationErrors = errors;
    this.params = [];
    this.paramIndex = 1;
    this.state = new QueryState();
    this.obsJoins = new Set();
    this.requiresHome = false;
    this.context = context || {};

    FILTER_KEYS.forEach((key) => {
      if (!this.enabled[key]) {
        return;
      }
      if (ENABLE_ONLY_FILTERS.has(key)) {
        return;
      }
      if (hasMeaningfulFilterValue(this.filters[key])) {
        return;
      }

      this.addIgnored(
        key === 'timeframe' || key === 'temporalScope' ? 'temporal' : 'input',
        key,
        'enabled_without_value'
      );
    });

    if (context?.trackPerformance || process.env.TRACK_QUERY_PERFORMANCE === 'true') {
      const { QueryPerformanceTracker } = require('../../utils/queryPerformanceTracker');
      this.perfTracker = new QueryPerformanceTracker('filter-query');
    }
  }

  public addParam(value: unknown): string {
    this.params.push(value);
    const index = this.paramIndex;
    this.paramIndex += 1;
    return `$${index}`;
  }

  public addApplied(type: string, field: string, value: unknown): void {
    this.state = this.state.withAppliedFilter(type, field, value);
    if (this.perfTracker) {
      this.perfTracker.addAppliedFilter(field, true);
    }
  }

  public addIgnored(type: string, field: string, reason: string): void {
    this.state = this.state.withIgnoredFilter(type, field, reason);
    if (this.perfTracker) {
      this.perfTracker.addIgnoredFilter(field);
    }
  }

  public addWarning(message: string): void {
    this.state = this.state.withWarning(message);
    if (this.perfTracker) {
      this.perfTracker.addWarning(message);
    }
  }

  public getParams(): unknown[] {
    return [...this.params];
  }

  public getAppliedFilters(): AppliedFilter[] {
    return this.state.appliedFilters();
  }

  public getAppliedCount(): number {
    return this.getAppliedFilters().length;
  }

  public getValidationErrors(): string[] {
    return [...this.validationErrors];
  }

  public isFastPathEligible(enabledKeys: string[]): boolean {
    const networkOnly =
      enabledKeys.length > 0 &&
      enabledKeys.every((key) => NETWORK_ONLY_FILTERS.has(key as FilterKey));
    if (networkOnly) {
      return true;
    }
    return false;
  }

  public shouldIncludeIgnoredByExplicitTagFilter(): boolean {
    const hasIdentitySearch =
      (this.enabled.ssid === true &&
        typeof this.filters.ssid === 'string' &&
        this.filters.ssid.trim() !== '') ||
      (this.enabled.bssid === true &&
        typeof this.filters.bssid === 'string' &&
        this.filters.bssid.trim() !== '');

    if (hasIdentitySearch) {
      return true;
    }

    return (
      this.enabled.tag_type === true &&
      Array.isArray(this.filters.tag_type) &&
      this.filters.tag_type.some((tag) => String(tag).toLowerCase() === 'ignore')
    );
  }

  public shouldComputeStationaryConfidence(): boolean {
    return (
      (this.enabled.stationaryConfidenceMin &&
        this.filters.stationaryConfidenceMin !== undefined) ||
      (this.enabled.stationaryConfidenceMax && this.filters.stationaryConfidenceMax !== undefined)
    );
  }

  public buildNetworkWhere(): string[] {
    return buildNetworkWhere(this as NetworkWhereBuildContext);
  }
}
