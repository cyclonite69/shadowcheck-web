/**
 * WiGLE Observations Routes
 * Fetch stored observation data
 */

import express from 'express';
const router = express.Router();
const { wigleService } = require('../../../../config/container');
const { asyncHandler } = require('../../../../utils/asyncHandler');

/**
 * GET /observations/:netid - Fetch stored individual observations
 */
router.get(
  '/observations/:netid',
  asyncHandler(async (req, res) => {
    const { netid } = req.params;

    const rows = await wigleService.getWigleV3Observations(netid);

    res.json({
      ok: true,
      count: rows.length,
      observations: rows,
    });
  })
);

export default router;
