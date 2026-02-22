/**
 * WiGLE Observations Routes
 * Fetch stored observation data
 */

import express from 'express';
const router = express.Router();
const { wigleService } = require('../../../../config/container');

/**
 * GET /observations/:netid - Fetch stored individual observations
 */
router.get('/observations/:netid', async (req, res, next) => {
  try {
    const { netid } = req.params;

    const rows = await wigleService.getWigleV3Observations(netid);

    res.json({
      ok: true,
      count: rows.length,
      observations: rows,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
