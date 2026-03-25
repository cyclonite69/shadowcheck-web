/**
 * Network Search Routes
 * Search networks by SSID with pagination
 */

import express from 'express';
import type { Request, Response } from 'express';
const router = express.Router();
const { networkListService } = require('../../../../config/container');
import { escapeLikePattern } from '../../../../utils/escapeSQL';
import { validateString, validateIntegerRange } from '../../../../validation/schemas';
import { validateQuery, optional } from '../../../../validation/middleware';
import { ROUTE_CONFIG } from '../../../../config/routeConfig';
const { asyncHandler } = require('../../../../utils/asyncHandler');

const validateSearchQuery = validateQuery({
  limit: optional((value: any) =>
    validateIntegerRange(value, 1, ROUTE_CONFIG.explorer.maxLimit, 'limit')
  ),
  offset: optional((value: any) =>
    validateIntegerRange(value, 0, ROUTE_CONFIG.networks.maxOffset, 'offset')
  ),
});

/**
 * GET /networks/search/:ssid - Search networks by SSID (paginated)
 */
router.get(
  '/networks/search/:ssid',
  validateSearchQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const { ssid } = req.params;

    const ssidValidation = validateString(String(ssid || ''), 'SSID');
    if (!ssidValidation.valid) {
      return res.status(400).json({ error: 'SSID parameter is required and cannot be empty.' });
    }

    if (ssidValidation.value && ssidValidation.value.length > 128) {
      return res.status(400).json({ error: 'SSID cannot exceed 128 characters.' });
    }

    const escapedSSID = escapeLikePattern(String(ssid).trim());
    const searchPattern = `%${escapedSSID}%`;
    const limit = (req as any).validated?.limit ?? null;
    const offset = (req as any).validated?.offset ?? null;

    const { rows, total } = await networkListService.searchNetworks(searchPattern, limit, offset);

    res.json({ ok: true, query: ssid, count: rows.length, total, networks: rows });
  })
);

export default router;
