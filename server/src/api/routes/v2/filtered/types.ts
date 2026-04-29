import type { Filters, EnabledFlags } from '../filteredHelpers';

export type { Filters, EnabledFlags };

export type HandlerDeps = {
  filterQueryBuilder: {
    UniversalFilterQueryBuilder: new (...args: any[]) => any;
    validateFilterPayload: (filters: Filters, enabled: EnabledFlags) => { errors: string[] };
  };
  v2Service: {
    executeV2Query: (sql: string, params: any[]) => Promise<{ rows?: any[]; rowCount?: number }>;
    fetchMissingSiblingRows: (matchedBssids: string[], locationMode: string) => Promise<any[]>;
  };
  filteredAnalyticsService: {
    getFilteredAnalytics: (
      filters: Filters,
      enabled: EnabledFlags,
      pageType: 'geospatial' | 'wigle'
    ) => Promise<{ data: unknown; queryDurationMs: number }>;
  };
  logger: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
  };
  validators: {
    limit: (value: string | undefined, min: number, max: number, fallback: number) => number;
    offset: (value: string | undefined) => number;
  };
};
