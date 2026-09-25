/**
 * WiGLE Stats API Routes
 */

import express from 'express';
const router = express.Router();
const { wigleService } = require('../../../../config/container');
const logger = require('../../../../logging/logger');

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let statsCache: { data: any; fetchedAt: number } | null = null;

/**
 * GET /api/v1/wigle/user-stats
 * Fetch current user stats and rank from WiGLE.
 * Returns cached data (stale:true) on rate-limit or error if a prior
 * successful response is available, so the UI can stay populated.
 */
router.get('/user-stats', async (req: any, res: any, _next: any) => {
  const now = Date.now();
  const forceRefresh = req.query.refresh === 'true';
  const fresh = statsCache && now - statsCache.fetchedAt < CACHE_TTL_MS && !forceRefresh;

  if (fresh) {
    return res.json({ success: true, stats: statsCache!.data, stale: false });
  }

  try {
    const stats = await wigleService.getUserStats();
    statsCache = { data: stats, fetchedAt: now };
    return res.json({ success: true, stats, stale: false });
  } catch (err: any) {
    logger.error(`[WiGLE] Failed to fetch user stats: ${err.message}`);

    if (statsCache) {
      return res.json({
        success: true,
        stats: statsCache.data,
        stale: true,
        cachedAt: new Date(statsCache.fetchedAt).toISOString(),
        error: err.message,
      });
    }

    const status = err.status ?? (err.message?.includes('not configured') ? 503 : 500);
    return res.status(status).json({ success: false, error: err.message });
  }
});

export default router;
