/**
 * Query Performance Tracker
 * Tracks execution time and filter application metrics
 */

const logger = require('../../logging/logger');

interface FilterMetrics {
  filterType: string;
  enabled: boolean;
  applied: boolean;
  executionTimeMs?: number;
}

interface QueryMetrics {
  queryType: string;
  totalTimeMs: number;
  pathTaken: 'fast' | 'slow' | 'unfiltered';
  filterCount: number;
  appliedFilters: FilterMetrics[];
  ignoredFilters: string[];
  warnings: string[];
  resultCount?: number;
}

class QueryPerformanceTracker {
  private startTime: number;
  private metrics: Partial<QueryMetrics>;

  constructor(queryType: string) {
    this.startTime = Date.now();
    this.metrics = {
      queryType,
      appliedFilters: [],
      ignoredFilters: [],
      warnings: [],
    };
  }

  setPath(path: 'fast' | 'slow' | 'unfiltered'): void {
    this.metrics.pathTaken = path;
  }

  addAppliedFilter(filterType: string, enabled: boolean): void {
    this.metrics.appliedFilters?.push({
      filterType,
      enabled,
      applied: true,
    });
  }

  addIgnoredFilter(filterType: string): void {
    this.metrics.ignoredFilters?.push(filterType);
  }

  addWarning(warning: string): void {
    this.metrics.warnings?.push(warning);
  }

  setResultCount(count: number): void {
    this.metrics.resultCount = count;
  }

  finish(): QueryMetrics {
    const totalTimeMs = Date.now() - this.startTime;
    const filterCount = this.metrics.appliedFilters?.length || 0;

    const finalMetrics: QueryMetrics = {
      queryType: this.metrics.queryType!,
      totalTimeMs,
      pathTaken: this.metrics.pathTaken || 'unfiltered',
      filterCount,
      appliedFilters: this.metrics.appliedFilters || [],
      ignoredFilters: this.metrics.ignoredFilters || [],
      warnings: this.metrics.warnings || [],
      resultCount: this.metrics.resultCount,
    };

    // Log if query is slow (>1s) or has warnings
    if (totalTimeMs > 1000 || finalMetrics.warnings.length > 0) {
      logger.warn('[QueryPerformance] Slow or problematic query', finalMetrics);
    } else if (process.env.DEBUG_QUERY_PERFORMANCE === 'true') {
      logger.info('[QueryPerformance]', finalMetrics);
    }

    return finalMetrics;
  }
}

export { QueryPerformanceTracker, QueryMetrics, FilterMetrics };
