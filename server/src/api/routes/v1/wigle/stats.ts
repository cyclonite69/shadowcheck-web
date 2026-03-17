/**
 * WiGLE Stats API Routes
 */

import express from 'express';
const router = express.Router();
const { wigleService } = require('../../../../config/container');
const logger = require('../../../../logging/logger');

/**
 * GET /api/v1/wigle/user-stats
 * Fetch current user stats and rank from WiGLE
 */
router.get('/user-stats', async (req: any, res: any, next: any) => {
  try {
    const stats = await wigleService.getUserStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    logger.error(`[WiGLE] Failed to fetch user stats: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
