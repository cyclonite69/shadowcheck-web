import { CONFIG } from './database';

/**
 * Shared route-level constants sourced from centralized database config.
 * Routes should import from this module (not config/database directly).
 */
export const ROUTE_CONFIG = {
  maxPageSize: CONFIG.MAX_PAGE_SIZE,
  minValidTimestamp: CONFIG.MIN_VALID_TIMESTAMP,
} as const;
