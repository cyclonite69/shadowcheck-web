import type { Request, Response, NextFunction } from 'express';
/**
 * WiGLE Observations Routes
 * Fetch stored observation data with pagination support
 */

import express from 'express';
const router = express.Router();
const { wigleService } = require('../../../../config/container');
const { asyncHandler } = require('../../../../utils/asyncHandler');
import { validateQuery, optional } from '../../../../validation/middleware';
import { validateIntegerRange } from '../../../../validation/schemas';

const validateObservationsQuery = validateQuery({
  limit: optional((value: any) => validateIntegerRange(value, 1, 100000, 'limit')),
  offset: optional((value: any) => validateIntegerRange(value, 0, 10000000, 'offset')),
});

/**
 * GET /observations/:netid - Fetch stored individual observations (paginated)
 */
router.get(
  '/observations/:netid',
  validateObservationsQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const { netid } = req.params;
    const limit = (req as any).validated?.limit ?? null;
    const offset = (req as any).validated?.offset ?? null;

    const { rows, total } = await wigleService.getWigleObservations(netid, limit, offset);

    res.json({
      ok: true,
      count: rows.length,
      total,
      observations: rows,
    });
  })
);

export default router;
