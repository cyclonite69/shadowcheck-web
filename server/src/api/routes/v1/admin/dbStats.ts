/**
 * Admin Database Statistics API Routes
 */

import express from 'express';
const router = express.Router();
const { adminDbStatsService } = require('../../../../config/container');
const logger = require('../../../../logging/logger');

/**
 * GET /api/v1/admin/db-stats
 * Detailed metrics on table row counts, storage, and activity
 */
router.get('/', async (req: any, res: any, next: any) => {
  try {
    const stats = await adminDbStatsService.getDetailedDatabaseStats();
    res.json(stats);
  } catch (err: any) {
    logger.error(`[Admin] Failed to fetch DB stats: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
