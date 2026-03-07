import { CONFIG } from './database';

/**
 * Shared route-level constants sourced from centralized database config.
 * Routes should import from this module (not config/database directly).
 */
export const ROUTE_CONFIG = {
  maxPageSize: CONFIG.MAX_PAGE_SIZE,
  minValidTimestamp: CONFIG.MIN_VALID_TIMESTAMP,
  filteredDefaultLimit: 500,
  geospatialDefaultLimit: 5000,
  geospatialMaxLimit: 500000,
  observationsDefaultLimit: 500000,
  observationsMaxLimit: 1000000,
  slowFilteredTotalMs: Math.max(0, Number(process.env.SLOW_FILTERED_TOTAL_MS ?? 1000)),
  slowFilteredQueryMs: Math.max(0, Number(process.env.SLOW_FILTERED_QUERY_MS ?? 500)),
  slowGeospatialQueryMs: Math.max(0, Number(process.env.SLOW_GEOSPATIAL_QUERY_MS ?? 2000)),
  threatThresholds: {
    critical: '80-100',
    high: '60-79',
    medium: '40-59',
    low: '20-39',
    none: '0-19',
  } as const,
  explorer: {
    defaultLimit: 500,
    maxLimit: 5000,
    maxOffset: 1000000,
    maxPage: 1000000,
  } as const,
  networks: {
    maxLimit: 1000,
    maxOffset: 10000000,
    maxObservationCount: 100000000,
    maxBulkBssids: 10000,
  } as const,
} as const;
