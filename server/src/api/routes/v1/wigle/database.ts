import type { Request, Response, NextFunction } from 'express';
/**
 * WiGLE Database Routes
 * Local WiGLE database queries
 */

import express from 'express';
const router = express.Router();
const { wigleService } = require('../../../../config/container');
import logger from '../../../../logging/logger';
import { macParamMiddleware, validateQuery, optional } from '../../../../validation/middleware';
import { validateIntegerRange, validateString } from '../../../../validation/schemas';
const { asyncHandler } = require('../../../../utils/asyncHandler');

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
 * GET /network/:bssid - Get WiGLE detail for specific network (local DB)
 *
 * Queries wigle_v3_network_details first (richest data), falls back to
 * the wigle_networks_enriched view for v2-only imports.
 */
router.get(
  '/network/:bssid',
  macParamMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { bssid } = req.params;
    const network = await wigleService.getWigleDetail(bssid);
    if (!network) {
      return res.status(404).json({ error: 'Network not found in WiGLE database' });
    }
    res.json({ success: true, results: [network] });
  })
);

/**
 * GET /search - Search WiGLE database
 */
router.get(
  '/search',
  validateWigleSearchQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const ssid = (req as any).validated?.ssid ? String((req as any).validated.ssid).trim() : '';
    const bssid = (req as any).validated?.bssid ? String((req as any).validated.bssid).trim() : '';
    const limit = (req as any).validated?.limit ?? null;

    if (!ssid && !bssid) {
      return res.status(400).json({ error: 'Either ssid or bssid parameter is required' });
    }

    const rows = await wigleService.searchWigleDatabase({ ssid, bssid, limit });
    res.json({ ok: true, query: ssid || bssid, count: rows.length, networks: rows });
  })
);

/**
 * GET /networks-v2 - Fetch WiGLE v2 networks with filtering and pagination
 */
router.get(
  '/networks-v2',
  validateWigleNetworksQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const { filters, enabled } = req.query;
    const limit = (req as any).validated?.limit ?? null;
    const offset = (req as any).validated?.offset ?? null;
    const typeRaw = (req as any).validated?.type;
    const includeTotalValidation = parseIncludeTotalFlag(req.query.include_total);
    if (!includeTotalValidation.valid) {
      return res.status(400).json({ error: includeTotalValidation.error });
    }
    const includeTotal = includeTotalValidation.value;

    let ssid: string | undefined;
    let bssid: string | undefined;

    if (filters && enabled) {
      try {
        const filterObj = JSON.parse(filters as string);
        const enabledObj = JSON.parse(enabled as string);
        if (enabledObj.ssid && filterObj.ssid) ssid = String(filterObj.ssid);
        if (enabledObj.bssid && filterObj.bssid) bssid = String(filterObj.bssid);
      } catch (e: any) {
        logger.warn('Invalid filter parameters:', e.message);
      }
    }

    const { rows, total } = await wigleService.getWigleDatabase({
      version: 'v2',
      ssid,
      bssid,
      type: typeRaw ? String(typeRaw) : undefined,
      limit,
      offset,
      includeTotal,
    });

    res.json({ ok: true, count: rows.length, total, data: rows });
  })
);

/**
 * GET /networks-v3 - Fetch WiGLE v3 networks with filtering and pagination
 */
router.get(
  '/networks-v3',
  validateWigleNetworksQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const tableExists = await wigleService.checkWigleV3TableExists();
    if (!tableExists) {
      return res.json({
        ok: true,
        count: 0,
        total: 0,
        networks: [],
        message: 'WiGLE v3 networks table not available',
      });
    }

    const { filters, enabled } = req.query;
    const limit = (req as any).validated?.limit ?? null;
    const offset = (req as any).validated?.offset ?? null;
    const includeTotalValidation = parseIncludeTotalFlag(req.query.include_total);
    if (!includeTotalValidation.valid) {
      return res.status(400).json({ error: includeTotalValidation.error });
    }
    const includeTotal = includeTotalValidation.value;

    let ssid: string | undefined;
    let bssid: string | undefined;

    if (filters && enabled) {
      try {
        const filterObj = JSON.parse(filters as string);
        const enabledObj = JSON.parse(enabled as string);
        if (enabledObj.ssid && filterObj.ssid) ssid = String(filterObj.ssid);
        if (enabledObj.bssid && filterObj.bssid) bssid = String(filterObj.bssid);
      } catch (e: any) {
        logger.warn('Invalid filter parameters for v3:', e.message);
      }
    }

    const { rows, total } = await wigleService.getWigleDatabase({
      version: 'v3',
      ssid,
      bssid,
      limit,
      offset,
      includeTotal,
    });

    res.json({ ok: true, count: rows.length, total, networks: rows });
  })
);

router.get(
  '/kml-points',
  validateWigleNetworksQuery,
  asyncHandler(async (req: Request, res: Response) => {
    const { filters, enabled } = req.query;
    const limit = (req as any).validated?.limit ?? null;
    const offset = (req as any).validated?.offset ?? null;
    const includeTotalValidation = parseIncludeTotalFlag(req.query.include_total);
    if (!includeTotalValidation.valid) {
      return res.status(400).json({ error: includeTotalValidation.error });
    }
    const includeTotal = includeTotalValidation.value;

    let bssid: string | undefined;

    if (filters && enabled) {
      try {
        const filterObj = JSON.parse(filters as string);
        const enabledObj = JSON.parse(enabled as string);
        if (enabledObj.bssid && filterObj.bssid) bssid = String(filterObj.bssid);
      } catch (e: any) {
        logger.warn('Invalid filter parameters for KML points:', e.message);
      }
    }

    const { rows, total } = await wigleService.getKmlPointsForMap({
      bssid,
      limit,
      offset,
      includeTotal,
    });

    res.json({ ok: true, count: rows.length, total, data: rows });
  })
);

export default router;
