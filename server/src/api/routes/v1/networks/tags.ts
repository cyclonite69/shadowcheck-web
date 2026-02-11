/**
 * Network Tags Routes
 * Manual network classification and tagging
 */

import express from 'express';
const router = express.Router();
import { query } from '../../../../config/database';
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

const VALID_TAG_TYPES = ['LEGIT', 'FALSE_POSITIVE', 'INVESTIGATE', 'THREAT'];

/**
 * GET /networks/tagged - List tagged networks
 */
router.get('/networks/tagged', async (req, res, next) => {
  try {
    const { tag_type } = req.query;
    const tagValidation = validateEnum(tag_type, VALID_TAG_TYPES, 'tag_type');
    if (!tagValidation.valid) {
      return res
        .status(400)
        .json({ error: `Valid tag_type is required (one of: ${VALID_TAG_TYPES.join(', ')})` });
    }

    const pageResult = parseOptionalInteger(req.query.page, 1, 1000000, 'page');
    if (!pageResult.ok) {
      return res.status(400).json({ error: 'Invalid page parameter. Must be a positive integer.' });
    }
    const limitResult = parseOptionalInteger(req.query.limit, 1, 1000, 'limit');
    if (!limitResult.ok) {
      return res
        .status(400)
        .json({ error: 'Invalid limit parameter. Must be between 1 and 1000.' });
    }
    const page = pageResult.value ?? 1;
    const limit = limitResult.value ?? 50;
    const offset = (page - 1) * limit;

    const { rows } = await query(
      `SELECT t.bssid, n.ssid, t.tag_type, t.confidence, t.notes, t.tagged_at, t.updated_at,
              COUNT(*) OVER() as total_count
       FROM app.network_tags t
       LEFT JOIN app.networks n ON t.bssid = n.bssid
       WHERE t.tag_type = $1
       ORDER BY t.updated_at DESC LIMIT $2 OFFSET $3`,
      [tagValidation.value, limit, offset]
    );

    const totalCount = rows.length > 0 ? parseInt(rows[0].total_count) : 0;

    res.json({
      ok: true,
      tag_type: tagValidation.value,
      networks: rows.map((row) => ({
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
  } catch (err) {
    next(err);
  }
});

/**
 * POST /tag-network - Tag a network
 */
router.post('/tag-network', async (req, res, next) => {
  try {
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

    if (notes !== undefined && typeof notes !== 'string') {
      return res.status(400).json({ error: 'Notes must be a string' });
    }

    const networkResult = await query(`SELECT ssid FROM app.networks WHERE bssid = $1 LIMIT 1`, [
      bssidValidation.cleaned,
    ]);

    if (networkResult.rowCount === 0) {
      return res.status(404).json({ error: 'Network not found for tagging' });
    }

    await query(`DELETE FROM app.network_tags WHERE bssid = $1`, [bssidValidation.cleaned]);

    const result = await query(
      `INSERT INTO app.network_tags (bssid, tag_type, confidence, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING bssid, tag_type, confidence, threat_score, ml_confidence`,
      [
        bssidValidation.cleaned,
        tagValidation.value,
        confidenceValidation.value / 100.0,
        notes || null,
      ]
    );

    res.json({ ok: true, tag: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /tag-network/:bssid - Remove tag from network
 */
router.delete('/tag-network/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const bssidValidation = validateMACAddress(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    const result = await query(`DELETE FROM app.network_tags WHERE bssid = $1 RETURNING bssid`, [
      bssidValidation.cleaned,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tag not found for this BSSID' });
    }

    res.json({ ok: true, message: 'Tag removed successfully', bssid: bssidValidation.cleaned });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /networks/tag-threats - Bulk tag networks as threats
 */
router.post('/networks/tag-threats', async (req, res, next) => {
  try {
    const { bssids, reason } = req.body;

    const bssidListValidation = validateBSSIDList(bssids);
    if (!bssidListValidation.valid) {
      return res.status(400).json({ error: bssidListValidation.error });
    }

    if (bssidListValidation.value && bssidListValidation.value.length > 10000) {
      return res.status(400).json({ error: 'Maximum 10000 BSSIDs allowed' });
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
        const result = await query(
          `INSERT INTO app.network_tags (bssid, tag_type, confidence, threat_score, notes)
           VALUES ($1, 'THREAT', 0.9, 0.8, $2)
           ON CONFLICT (bssid) DO UPDATE SET
             tag_type = 'THREAT', confidence = 0.9, threat_score = 0.8, notes = $2
           RETURNING bssid, tag_type, confidence, threat_score`,
          [bssid, (reasonValidation as any).value || 'Manual threat tag']
        );

        results.push({ bssid: bssid, success: true, tag: result.rows[0] });
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
  } catch (err) {
    next(err);
  }
});

export default router;
