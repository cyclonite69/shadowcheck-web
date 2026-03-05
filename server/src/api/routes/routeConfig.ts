import { CONFIG } from '../../config/database';

/**
 * Shared route-layer config accessor.
 * Keeps route modules decoupled from direct database config imports.
 */
export const ROUTE_CONFIG = {
  maxPageSize: CONFIG.MAX_PAGE_SIZE,
  minValidTimestamp: CONFIG.MIN_VALID_TIMESTAMP,
} as const;
