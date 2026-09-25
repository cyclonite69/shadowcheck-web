/**
 * WiGLE Detail & Import Routes
 * Thin router — delegates to wigleDetailService for all business logic.
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../../../../middleware/authMiddleware';
import { fetchOrImportDetail, importDetailFromJson } from '../../../../services/wigleDetailService';
import { inferWigleEndpoint } from '../../../../services/wigleDetailTransforms';

const router = express.Router();
const { asyncHandler } = require('../../../../utils/asyncHandler');
const { query } = require('../../../../config/database');

interface FileUploadRequest extends Request {
  files?: Record<string, { data: Buffer; name: string; [key: string]: unknown }>;
}

/**
 * POST /detail/batch - Fetch and optionally import WiGLE v3 detail for multiple BSSIDs
 */
router.post(
  '/detail/batch',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { bssids, import: shouldImport } = req.body;

    if (!Array.isArray(bssids) || bssids.length === 0) {
      return res.status(400).json({ ok: false, error: 'bssids array is required' });
    }

    const MAX_BATCH = 50;
    const cleanBssids = bssids
      .filter((b: unknown): b is string => typeof b === 'string' && b.trim().length > 0)
      .map((b: string) => b.trim().toUpperCase())
      .slice(0, MAX_BATCH);

    if (cleanBssids.length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid BSSIDs provided' });
    }

    const results: Array<{
      bssid: string;
      success: boolean;
      importedObservations?: number;
      error?: string;
    }> = [];

    // Batch query network types from DB
    const { rows: networkTypes } = await query(
      `
      SELECT DISTINCT ON (bssid) bssid, type 
      FROM app.networks 
      WHERE bssid = ANY($1::text[])
      ORDER BY bssid, type
      `,
      [cleanBssids]
    );
    const typeMap = new Map(networkTypes.map((r: any) => [r.bssid, r.type as string]));

    for (const bssid of cleanBssids) {
      try {
        const networkType = inferWigleEndpoint(typeMap.get(bssid) as string);
        const result = await fetchOrImportDetail(bssid, networkType, shouldImport === true);
        if (result.ok) {
          results.push({
            bssid,
            success: true,
            importedObservations: result.importedObservations,
          });
        } else {
          results.push({ bssid, success: false, error: result.error });
        }
      } catch (err: any) {
        results.push({ bssid, success: false, error: err?.message || 'Unknown error' });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const totalImported = results.reduce((sum, r) => sum + (r.importedObservations || 0), 0);

    res.json({
      ok: true,
      results,
      summary: {
        total: cleanBssids.length,
        succeeded,
        failed: cleanBssids.length - succeeded,
        totalImported,
      },
    });
  })
);

/**
 * POST /detail/:netid - Fetch WiGLE v3 WiFi detail and optionally import
 */
router.post(
  '/detail/:netid',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const netid = String(req.params.netid || '')
      .trim()
      .toUpperCase();
    const result = await fetchOrImportDetail(netid, 'wifi', req.body?.import === true);
    if (!result.ok) {
      return res.status(result.status).json(result);
    }
    res.json(result);
  })
);

/**
 * POST /detail/bt/:netid - Fetch WiGLE v3 Bluetooth detail and optionally import
 */
router.post(
  '/detail/bt/:netid',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const netid = String(req.params.netid || '')
      .trim()
      .toUpperCase();
    const result = await fetchOrImportDetail(netid, 'bt', req.body?.import === true);
    if (!result.ok) {
      return res.status(result.status).json(result);
    }
    res.json(result);
  })
);

/**
 * POST /import/v3 - Import WiGLE v3 detail JSON file
 */
router.post(
  '/import/v3',
  requireAdmin,
  asyncHandler(async (req: FileUploadRequest, res: Response) => {
    if (!req.files || !(req.files as any).file) {
      return res.status(400).json({ ok: false, error: 'No file uploaded' });
    }

    const file = (req.files as any).file;
    let data: any;
    try {
      data = JSON.parse(file.data.toString('utf8'));
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid JSON file' });
    }

    if (!data.networkId) {
      return res.status(400).json({ ok: false, error: 'JSON missing networkId field' });
    }

    const result = await importDetailFromJson(data);
    res.json(result);
  })
);

export default router;
