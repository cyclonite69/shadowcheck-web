import { FilterPredicateBuilder, type QueryContext } from './FilterPredicateBuilder';
import { QueryState } from './QueryState';
import { validateFilterPayload } from './validators';
import { FILTER_KEYS, NETWORK_ONLY_FILTERS, RELATIVE_WINDOWS, type FilterKey } from './constants';
import { buildEngagementPredicates } from './engagementPredicates';
import type { Filters, EnabledFlags, AppliedFilter } from './types';

const ENABLE_ONLY_FILTERS = new Set<FilterKey>(['excludeInvalidCoords']);

const hasMeaningfulFilterValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

export class FilterBuildContext extends FilterPredicateBuilder {
  public filters: Filters;
  public enabled: EnabledFlags;
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
    const { filters: normalized, enabled: flags } = validateFilterPayload(filters, enabled);
    this.filters = normalized;
    this.enabled = flags;
    this.params = [];
    this.paramIndex = 1;
    this.state = new QueryState();
    this.obsJoins = new Set();
    this.requiresHome = false;
    this.context = context || {};

    FILTER_KEYS.forEach((key) => {
      if (!this.enabled[key]) return;
      if (ENABLE_ONLY_FILTERS.has(key)) return;
      if (hasMeaningfulFilterValue(this.filters[key])) return;

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
    const f = this.filters;
    const e = this.enabled;
    const networkWhere: string[] = [];

    if (e.threatScoreMin && f.threatScoreMin !== undefined) {
      networkWhere.push(
        ...this.buildThreatScorePredicate({
          min: f.threatScoreMin,
          expr: 'ne.threat_score',
          wrapExpr: false,
        })
      );
      this.addApplied('threat', 'threatScoreMin', f.threatScoreMin);
    }
    if (e.threatScoreMax && f.threatScoreMax !== undefined) {
      networkWhere.push(
        ...this.buildThreatScorePredicate({
          max: f.threatScoreMax,
          expr: 'ne.threat_score',
          wrapExpr: false,
        })
      );
      this.addApplied('threat', 'threatScoreMax', f.threatScoreMax);
    }
    if (e.threatCategories && Array.isArray(f.threatCategories) && f.threatCategories.length > 0) {
      const threatLevelMap: Record<string, string> = {
        critical: 'CRITICAL',
        high: 'HIGH',
        medium: 'MEDIUM',
        low: 'LOW',
        none: 'NONE',
      };
      const dbThreatLevels = Array.from(
        new Set(
          f.threatCategories
            .flatMap((cat) => {
              const mapped = threatLevelMap[cat] || cat.toUpperCase();
              if (mapped === 'MEDIUM' || mapped === 'MED') return ['MEDIUM', 'MED'];
              return [mapped];
            })
            .filter(Boolean)
        )
      );
      networkWhere.push(`ne.threat_level = ANY(${this.addParam(dbThreatLevels)})`);
      this.addApplied('threat', 'threatCategories', f.threatCategories);
    }
    if (e.observationCountMin && f.observationCountMin !== undefined) {
      networkWhere.push(`r.observation_count >= ${this.addParam(f.observationCountMin)}`);
      this.addApplied('quality', 'observationCountMin', f.observationCountMin);
    }
    if (e.observationCountMax && f.observationCountMax !== undefined) {
      networkWhere.push(`r.observation_count <= ${this.addParam(f.observationCountMax)}`);
      this.addApplied('quality', 'observationCountMax', f.observationCountMax);
    }

    const engagementResult = buildEngagementPredicates({
      enabled: this.enabled,
      filters: this.filters,
      addParam: this.addParam.bind(this),
      bssidExpr: 'ne.bssid',
      tagAlias: 'nt_filter',
      tagLowerExpr: 'LOWER(nt_filter.threat_tag)',
      tagIgnoredExpr: 'COALESCE(nt_filter.is_ignored, FALSE)',
    });
    networkWhere.push(...engagementResult.where);
    engagementResult.applied.forEach((entry) =>
      this.addApplied('engagement', entry.field, entry.value)
    );

    if (e.wigle_v3_observation_count_min && f.wigle_v3_observation_count_min !== undefined) {
      if (this.context?.pageType === 'wigle') {
        networkWhere.push(
          `ne.wigle_v3_observation_count >= ${this.addParam(f.wigle_v3_observation_count_min)}`
        );
        this.addApplied(
          'quality',
          'wigle_v3_observation_count_min',
          f.wigle_v3_observation_count_min
        );
      }
    }
    if (e.gpsAccuracyMax && f.gpsAccuracyMax !== undefined) {
      networkWhere.push(
        `ne.accuracy_meters IS NOT NULL AND ne.accuracy_meters > 0 AND ne.accuracy_meters <= ${this.addParam(f.gpsAccuracyMax)}`
      );
      this.addApplied('quality', 'gpsAccuracyMax', f.gpsAccuracyMax);
    }
    if (e.excludeInvalidCoords) {
      networkWhere.push(
        'ne.lat IS NOT NULL',
        'ne.lon IS NOT NULL',
        'ne.lat BETWEEN -90 AND 90',
        'ne.lon BETWEEN -180 AND 180'
      );
      this.addApplied('quality', 'excludeInvalidCoords', true);
    }
    if (e.distanceFromHomeMin && f.distanceFromHomeMin !== undefined) {
      networkWhere.push(`ne.distance_from_home_km >= ${this.addParam(f.distanceFromHomeMin)}`);
      this.addApplied('spatial', 'distanceFromHomeMin', f.distanceFromHomeMin);
    }
    if (e.distanceFromHomeMax && f.distanceFromHomeMax !== undefined) {
      networkWhere.push(`ne.distance_from_home_km <= ${this.addParam(f.distanceFromHomeMax)}`);
      this.addApplied('spatial', 'distanceFromHomeMax', f.distanceFromHomeMax);
    }
    if (e.stationaryConfidenceMin && f.stationaryConfidenceMin !== undefined) {
      networkWhere.push(`ne.stationary_confidence >= ${this.addParam(f.stationaryConfidenceMin)}`);
      this.addApplied('threat', 'stationaryConfidenceMin', f.stationaryConfidenceMin);
    }
    if (e.stationaryConfidenceMax && f.stationaryConfidenceMax !== undefined) {
      networkWhere.push(`ne.stationary_confidence <= ${this.addParam(f.stationaryConfidenceMax)}`);
      this.addApplied('threat', 'stationaryConfidenceMax', f.stationaryConfidenceMax);
    }

    if (e.timeframe && f.timeframe) {
      if (f.timeframe.type === 'absolute') {
        if (f.timeframe.startTimestamp)
          networkWhere.push(
            `ne.last_seen >= ${this.addParam(f.timeframe.startTimestamp)}::timestamptz`
          );
        if (f.timeframe.endTimestamp)
          networkWhere.push(
            `ne.last_seen <= ${this.addParam(f.timeframe.endTimestamp)}::timestamptz`
          );
      } else {
        const window = RELATIVE_WINDOWS[f.timeframe.relativeWindow || '30d'];
        if (window) networkWhere.push(`ne.last_seen >= NOW() - ${this.addParam(window)}::interval`);
      }
      this.addApplied('temporal', 'timeframe', f.timeframe);
    }

    return networkWhere;
  }
}
