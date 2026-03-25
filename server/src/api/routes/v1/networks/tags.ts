import type { Request, Response, NextFunction } from 'express';
/**
 * Network Tags Routes
 * Manual network classification and tagging
 */

import express from 'express';
const router = express.Router();
const { networkService, networkTagService } = require('../../../../config/container');
import logger from '../../../../logging/logger';
import {
  validateBSSID,
  validateBSSIDList,
  validateConfidence,
  validateEnum,
  validateMACAddress,
  validateString,
} from '../../../../validation/schemas';
import { parseOptionalInteger } from '../../../../validation/parameterParsers';
import { ROUTE_CONFIG } from '../../../../config/routeConfig';
const { asyncHandler } = require('../../../../utils/asyncHandler');

const VALID_TAG_TYPES = ['LEGIT', 'FALSE_POSITIVE', 'INVESTIGATE', 'THREAT'];

type NetworkTagParams = {
  bssid: string;
};

interface TaggedNetworkRow {
  bssid: string;
  ssid: string | null;
  tag_type: string;
  confidence: string;
  notes: string | null;
  tagged_at: string;
  updated_at: string;
}

/**
 * GET /networks/tagged - List tagged networks
 */
router.get(
  '/networks/tagged',
  asyncHandler(async (req: Request, res: Response) => {
    const { tag_type } = req.query;
    const tagValidation = validateEnum(tag_type, VALID_TAG_TYPES, 'tag_type');
    if (!tagValidation.valid) {
      return res
        .status(400)
        .json({ error: `Valid tag_type is required (one of: ${VALID_TAG_TYPES.join(', ')})` });
    }

    const pageResult = parseOptionalInteger(
      req.query.page,
      1,
      ROUTE_CONFIG.explorer.maxPage,
      'page'
    );
    if (!pageResult.ok) {
      return res.status(400).json({ error: 'Invalid page parameter. Must be a positive integer.' });
    }
    const limitResult = parseOptionalInteger(
      req.query.limit,
      1,
      ROUTE_CONFIG.networks.maxLimit,
      'limit'
    );
    if (!limitResult.ok) {
      return res.status(400).json({
        error: `Invalid limit parameter. Must be between 1 and ${ROUTE_CONFIG.networks.maxLimit}.`,
      });
    }
    const page = pageResult.value ?? 1;
    const limit = limitResult.value ?? 50;
    const offset = (page - 1) * limit;

    const { rows, totalCount } = await networkTagService.getTaggedNetworks(
      tagValidation.value,
      limit,
      offset
    );

    res.json({
      ok: true,
      tag_type: tagValidation.value,
      networks: rows.map((row: TaggedNetworkRow) => ({
        bssid: row.bssid,
        ssid: row.ssid || '<Hidden>',
        tag_type: row.tag_type,
        confidence: parseFloat(row.confidence),
        notes: row.notes,
        tagged_at: row.tagged_at,
        updated_at: row.updated_at,
      })),
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  })
);

/**
 * POST /tag-network - Tag a network
 */
router.post(
  '/tag-network',
  asyncHandler(async (req: Request, res: Response) => {
    const { bssid, tag_type, confidence, notes } = req.body;

    const bssidValidation = validateBSSID(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    const tagValidation = validateEnum(tag_type, VALID_TAG_TYPES, 'tag_type');
    if (!tagValidation.valid) {
      return res
        .status(400)
        .json({ error: `Valid tag_type is required (one of: ${VALID_TAG_TYPES.join(', ')})` });
    }

    const confidenceValidation = validateConfidence(confidence);
    if (!confidenceValidation.valid) {
      return res.status(400).json({ error: 'Confidence must be a number between 0 and 100' });
    }
    if (confidenceValidation.value === undefined) {
      return res.status(400).json({ error: 'Confidence must be a number between 0 and 100' });
    }

    if (notes !== undefined && typeof notes !== 'string') {
      return res.status(400).json({ error: 'Notes must be a string' });
    }

    const networkExists = await networkTagService.checkNetworkExists(bssidValidation.cleaned);

    if (!networkExists) {
      return res.status(404).json({ error: 'Network not found for tagging' });
    }

    await networkTagService.deleteNetworkTag(bssidValidation.cleaned);

    const tag = await networkTagService.insertNetworkTag(
      bssidValidation.cleaned,
      tagValidation.value,
      confidenceValidation.value / 100.0,
      notes || null
    );

    res.json({ ok: true, tag });
  })
);

/**
 * DELETE /tag-network/:bssid - Remove tag from network
 */
router.delete(
  '/tag-network/:bssid',
  asyncHandler(async (req: Request<NetworkTagParams>, res: Response) => {
    const { bssid } = req.params;

    const bssidValidation = validateMACAddress(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    const rowCount = await networkTagService.deleteNetworkTagReturning(bssidValidation.cleaned);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Tag not found for this BSSID' });
    }

    res.json({ ok: true, message: 'Tag removed successfully', bssid: bssidValidation.cleaned });
  })
);

/**
 * POST /networks/tag-threats - Bulk tag networks as threats
 */
router.post(
  '/networks/tag-threats',
  asyncHandler(async (req: Request, res: Response) => {
    const { bssids, reason } = req.body;

    const bssidListValidation = validateBSSIDList(bssids);
    if (!bssidListValidation.valid) {
      return res.status(400).json({ error: bssidListValidation.error });
    }
    if (!bssidListValidation.value) {
      return res.status(400).json({ error: 'At least one valid BSSID is required' });
    }

    if (bssidListValidation.value.length > ROUTE_CONFIG.networks.maxBulkBssids) {
      return res
        .status(400)
        .json({ error: `Maximum ${ROUTE_CONFIG.networks.maxBulkBssids} BSSIDs allowed` });
    }

    const reasonValidation =
      reason === undefined
        ? { valid: true, value: undefined }
        : (() => {
            const v = validateString(String(reason), 'Reason');
            if (!v.valid) return v;
            if (v.value && v.value.length > 512) {
              return { valid: false, error: 'Reason cannot exceed 512 characters' };
            }
            return { valid: true, value: v.value };
          })();
    if (!reasonValidation.valid) {
      return res.status(400).json({ error: (reasonValidation as any).error });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const bssid of bssidListValidation.value) {
      try {
        const tag = await networkTagService.upsertThreatTag(
          bssid,
          (reasonValidation as any).value || 'Manual threat tag'
        );

        results.push({ bssid: bssid, success: true, tag });
        successCount++;
      } catch (err: any) {
        logger.warn(`Failed to tag ${bssid}: ${err.message}`);
        results.push({ bssid, error: err.message });
        errorCount++;
      }
    }

    res.json({
      ok: true,
      message: `Tagged ${successCount} networks as threats`,
      successCount,
      errorCount,
      results,
    });
  })
);

export default router;
