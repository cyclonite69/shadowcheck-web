/**
 * WiGLE Detail & Import Routes
 * Thin router — delegates to wigleDetailService for all business logic.
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../../../../middleware/authMiddleware';
import { fetchOrImportDetail, importDetailFromJson } from '../../../../services/wigleDetailService';

const router = express.Router();
const { asyncHandler } = require('../../../../utils/asyncHandler');

interface FileUploadRequest extends Request {
  files?: Record<string, { data: Buffer; name: string; [key: string]: unknown }>;
}

/**
 * POST /detail/:netid - Fetch WiGLE v3 WiFi detail and optionally import
 */
router.post(
  '/detail/:netid',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const netid = String(req.params.netid || '')
      .trim()
      .toUpperCase();
    const result = await fetchOrImportDetail(netid, 'wifi', req.body?.import === true);
    if (!result.ok) return res.status(result.status).json(result);
    res.json(result);
  })
);

/**
 * POST /detail/bt/:netid - Fetch WiGLE v3 Bluetooth detail and optionally import
 */
router.post(
  '/detail/bt/:netid',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const netid = String(req.params.netid || '')
      .trim()
      .toUpperCase();
    const result = await fetchOrImportDetail(netid, 'bt', req.body?.import === true);
    if (!result.ok) return res.status(result.status).json(result);
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
