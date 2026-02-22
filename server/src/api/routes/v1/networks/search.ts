/**
 * Network Search Routes
 * Search networks by SSID with pagination
 */

import express from 'express';
const router = express.Router();
const { networkListService } = require('../../../../config/container');
import { escapeLikePattern } from '../../../../utils/escapeSQL';
import { validateString, validateIntegerRange } from '../../../../validation/schemas';
import { validateQuery, optional } from '../../../../validation/middleware';
const { asyncHandler } = require('../../../../utils/asyncHandler');

const validateSearchQuery = validateQuery({
  limit: optional((value: any) => validateIntegerRange(value, 1, 5000, 'limit')),
  offset: optional((value: any) => validateIntegerRange(value, 0, 10000000, 'offset')),
});

/**
 * GET /networks/search/:ssid - Search networks by SSID (paginated)
 */
router.get(
  '/networks/search/:ssid',
  validateSearchQuery,
  asyncHandler(async (req, res) => {
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
