/**
 * WiGLE Database Routes
 * Local WiGLE database queries
 */

import express from 'express';
const router = express.Router();
const wigleService = require('../../../../services/wigleService');
import logger from '../../../../logging/logger';
import { macParamMiddleware, validateQuery, optional } from '../../../../validation/middleware';
import { validateIntegerRange, validateString } from '../../../../validation/schemas';

function parseIncludeTotalFlag(value: any): { valid: boolean; value?: boolean; error?: string } {
  if (value === undefined || value === null || value === '') {
    return { valid: true, value: false };
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') {
    return { valid: true, value: true };
  }
  if (normalized === '0' || normalized === 'false') {
    return { valid: true, value: false };
  }
  return { valid: false, error: 'include_total must be 1, 0, true, or false' };
}

const validateWigleSearchQuery = validateQuery({
  ssid: optional((value: any) => {
    const v = validateString(String(value), 'SSID');
    if (!v.valid || (v.value && v.value.length > 64)) {
      return { valid: false, error: 'SSID must be 1-64 characters' };
    }
    return { valid: true, value: v.value };
  }),
  bssid: optional((value: any) => {
    const v = validateString(String(value), 'BSSID');
    if (!v.valid || (v.value && v.value.length > 64)) {
      return { valid: false, error: 'BSSID must be 1-64 characters' };
    }
    return { valid: true, value: v.value };
  }),
  limit: optional((value: any) => validateIntegerRange(value, 1, 10000, 'limit')),
});

const validateWigleNetworksQuery = validateQuery({
  limit: optional((value: any) => validateIntegerRange(value, 1, 10000, 'limit')),
  offset: optional((value: any) => validateIntegerRange(value, 0, 10000000, 'offset')),
  type: optional((value: any) => {
    const v = validateString(String(value), 'Type');
    if (!v.valid || (v.value && v.value.length > 16)) {
      return { valid: false, error: 'Type must be 1-16 characters' };
    }
    return { valid: true, value: v.value };
  }),
});

/**
 * GET /network/:bssid - Get WiGLE data for specific network (local DB)
 */
router.get('/network/:bssid', macParamMiddleware, async (req, res, next) => {
  try {
    const { bssid } = req.params;
    const network = await wigleService.getWigleNetworkByBSSID(bssid);
    if (!network) {
      return res.status(404).json({ error: 'Network not found in WiGLE database' });
    }
    res.json({ success: true, results: [network] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /search - Search WiGLE database
 */
router.get('/search', validateWigleSearchQuery, async (req, res, next) => {
  try {
    const ssid = (req as any).validated?.ssid ? String((req as any).validated.ssid).trim() : '';
    const bssid = (req as any).validated?.bssid ? String((req as any).validated.bssid).trim() : '';
    const limit = (req as any).validated?.limit ?? null;

    if (!ssid && !bssid) {
      return res.status(400).json({ error: 'Either ssid or bssid parameter is required' });
    }

    const rows = await wigleService.searchWigleDatabase({ ssid, bssid, limit });
    res.json({ ok: true, query: ssid || bssid, count: rows.length, networks: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /networks-v2 - Fetch WiGLE v2 networks for map testing
 */
router.get('/networks-v2', validateWigleNetworksQuery, async (req, res, next) => {
  try {
    const { filters, enabled } = req.query;
    const limit = (req as any).validated?.limit ?? null;
    const offset = (req as any).validated?.offset ?? null;
    const typeRaw = (req as any).validated?.type;
    const includeTotalValidation = parseIncludeTotalFlag(req.query.include_total);
    if (!includeTotalValidation.valid) {
      return res.status(400).json({ error: includeTotalValidation.error });
    }
    const includeTotal = includeTotalValidation.value;

    const queryParams: any[] = [];
    const whereClauses = ['trilat IS NOT NULL', 'trilong IS NOT NULL'];

    if (typeRaw && String(typeRaw).trim() !== '') {
      queryParams.push(String(typeRaw).trim());
      whereClauses.push(`type = $${queryParams.length}`);
    }

    if (filters && enabled) {
      try {
        const filterObj = JSON.parse(filters as string);
        const enabledObj = JSON.parse(enabled as string);
        let paramIndex = queryParams.length + 1;

        if (enabledObj.ssid && filterObj.ssid) {
          whereClauses.push(`ssid ILIKE $${paramIndex}`);
          queryParams.push(`%${filterObj.ssid}%`);
          paramIndex++;
        }

        if (enabledObj.bssid && filterObj.bssid) {
          whereClauses.push(`bssid ILIKE $${paramIndex}`);
          queryParams.push(`${filterObj.bssid}%`);
          paramIndex++;
        }
      } catch (e: any) {
        logger.warn('Invalid filter parameters:', e.message);
      }
    }

    const rows = await wigleService.getWigleV2Networks({
      limit,
      offset,
      type: typeRaw,
      whereClauses,
      queryParams,
    });

    let total = null;
    if (includeTotal) {
      total = await wigleService.getWigleV2NetworksCount(whereClauses, queryParams);
    }

    res.json({ ok: true, count: rows.length, total, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /networks-v3 - Fetch WiGLE v3 networks
 */
router.get('/networks-v3', validateWigleNetworksQuery, async (req, res, next) => {
  try {
    // Check if table exists
    const tableExists = await wigleService.checkWigleV3TableExists();

    if (!tableExists) {
      return res.json({
        ok: true,
        count: 0,
        networks: [],
        message: 'WiGLE v3 networks table not available',
      });
    }

    const limit = (req as any).validated?.limit ?? null;
    const offset = (req as any).validated?.offset ?? null;

    const rows = await wigleService.getWigleV3Networks({ limit, offset });

    res.json({ ok: true, count: rows.length, networks: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
