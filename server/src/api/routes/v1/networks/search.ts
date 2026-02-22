/**
 * Network Search Routes
 * Search networks by SSID
 */

import express from 'express';
const router = express.Router();
const { networkService } = require('../../../../config/container');
import { escapeLikePattern } from '../../../../utils/escapeSQL';
import { validateString } from '../../../../validation/schemas';
const { asyncHandler } = require('../../../../utils/asyncHandler');

/**
 * GET /networks/search/:ssid - Search networks by SSID
 */
router.get(
  '/networks/search/:ssid',
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

    const rows = await networkService.searchNetworksBySSID(searchPattern);

    res.json({ ok: true, query: ssid, count: rows.length, networks: rows });
  })
);

export default router;
