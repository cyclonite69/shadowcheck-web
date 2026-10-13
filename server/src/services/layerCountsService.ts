export {};
const { cacheService } = require('./cacheService');
const { fetchAuthoritativeLayerCounts } = require('../repositories/layerCountsRepository');
const logger = require('../logging/logger');

import type { LayerCounts } from '../repositories/layerCountsRepository';

export interface LayerCountsPayload {
  counts: LayerCounts;
  cached: boolean;
  timestamp: string;
}

const CACHE_KEY = 'geospatial:layer_counts';
const CACHE_TTL_SECONDS = 900; // 15-minute bounded staleness

let memoryCache: { data: LayerCounts; timestamp: string; expiresAt: number } | null = null;
let inflightPromise: Promise<LayerCountsPayload> | null = null;

/**
 * Retrieves authoritative layer counts for the Geospatial Explorer,
 * utilizing Redis / in-memory cache with single-flight mutex protection.
 *
 * @returns {Promise<LayerCountsPayload>}
 */
export async function getLayerCounts(): Promise<LayerCountsPayload> {
  const now = Date.now();

  // 1. Check in-memory cache
  if (memoryCache && memoryCache.expiresAt > now) {
    return {
      counts: memoryCache.data,
      cached: true,
      timestamp: memoryCache.timestamp,
    };
  }

  // 2. Check Redis cache
  try {
    const redisCached = (await cacheService.get(CACHE_KEY)) as {
      counts: LayerCounts;
      timestamp: string;
    } | null;
    if (redisCached?.counts) {
      memoryCache = {
        data: redisCached.counts,
        timestamp: redisCached.timestamp || new Date().toISOString(),
        expiresAt: now + CACHE_TTL_SECONDS * 1000,
      };
      return {
        counts: redisCached.counts,
        cached: true,
        timestamp: memoryCache.timestamp,
      };
    }
  } catch (err) {
    logger.warn('[LayerCountsService] Failed to check Redis cache:', err);
  }

  // 3. Mutex: deduplicate concurrent in-flight requests (prevent cache stampede)
  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    try {
      const counts = await fetchAuthoritativeLayerCounts();
      const timestamp = new Date().toISOString();

      memoryCache = {
        data: counts,
        timestamp,
        expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
      };

      try {
        await cacheService.set(CACHE_KEY, { counts, timestamp }, CACHE_TTL_SECONDS);
      } catch (err) {
        logger.warn('[LayerCountsService] Failed to populate Redis cache:', err);
      }

      return {
        counts,
        cached: false,
        timestamp,
      };
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

/**
 * Invalidates both Redis and in-memory caches for layer counts.
 * Called on ETL completion and home marker mutations.
 *
 * @returns {Promise<void>}
 */
export async function invalidateLayerCountsCache(): Promise<void> {
  memoryCache = null;
  try {
    await cacheService.del(CACHE_KEY);
  } catch (err) {
    logger.warn('[LayerCountsService] Failed to delete Redis key on invalidation:', err);
  }
  logger.info('[LayerCountsService] Layer counts cache invalidated');
}

module.exports = {
  getLayerCounts,
  invalidateLayerCountsCache,
};
