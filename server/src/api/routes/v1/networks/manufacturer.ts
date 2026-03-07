/**
 * Manufacturer Routes
 * Device manufacturer lookup by BSSID and network listing by OUI prefix
 */

import express from 'express';
const router = express.Router();
const { networkService, networkListService } = require('../../../../config/container');
import { validateBSSID, validateIntegerRange } from '../../../../validation/schemas';
import { validateQuery, optional } from '../../../../validation/middleware';
import { ROUTE_CONFIG } from '../../../../config/routeConfig';
const { asyncHandler } = require('../../../../utils/asyncHandler');

const VALID_SORT_KEYS = new Set(['last_seen', 'ssid', 'obs_count', 'signal', 'bssid']);

const validateManufacturerNetworksQuery = validateQuery({
  limit: optional((value: any) =>
    validateIntegerRange(value, 1, ROUTE_CONFIG.explorer.maxLimit, 'limit')
  ),
  offset: optional((value: any) =>
    validateIntegerRange(value, 0, ROUTE_CONFIG.networks.maxOffset, 'offset')
  ),
  sort: optional((value: any) => {
    const s = String(value).trim().toLowerCase();
    if (!VALID_SORT_KEYS.has(s)) {
      return { valid: false, error: `sort must be one of: ${[...VALID_SORT_KEYS].join(', ')}` };
    }
    return { valid: true, value: s };
  }),
});

/**
 * GET /manufacturer/:bssid - Lookup manufacturer by BSSID
 */
router.get(
  '/manufacturer/:bssid',
  asyncHandler(async (req, res) => {
    const { bssid } = req.params;

    const bssidValidation = validateBSSID(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    const prefix = bssidValidation.cleaned.replace(/:/g, '').substring(0, 6).toUpperCase();

    const manufacturer = await networkService.getManufacturerByBSSID(prefix);

    if (!manufacturer) {
      return res.json({
        ok: true,
        bssid: bssidValidation.cleaned,
        manufacturer: 'Unknown',
        prefix: prefix,
      });
    }

    res.json({
      ok: true,
      bssid: bssidValidation.cleaned,
      manufacturer: manufacturer.manufacturer,
      address: manufacturer.address,
      prefix: manufacturer.prefix,
    });
  })
);

/**
 * GET /manufacturer/:bssid/networks - List networks for a manufacturer OUI prefix (paginated)
 */
router.get(
  '/manufacturer/:bssid/networks',
  validateManufacturerNetworksQuery,
  asyncHandler(async (req, res) => {
    const { bssid } = req.params;

    const bssidValidation = validateBSSID(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    const prefix = bssidValidation.cleaned.replace(/:/g, '').substring(0, 6).toUpperCase();
    const limit = (req as any).validated?.limit ?? null;
    const offset = (req as any).validated?.offset ?? null;
    const sort = (req as any).validated?.sort;

    const { rows, total } = await networkListService.listByManufacturer(
      prefix,
      limit,
      offset,
      sort
    );

    res.json({ ok: true, prefix, count: rows.length, total, networks: rows });
  })
);

export default router;
