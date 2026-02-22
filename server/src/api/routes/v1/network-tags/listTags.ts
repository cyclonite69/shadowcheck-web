/**
 * Network Tags List Routes
 * GET endpoints for listing and retrieving network tags
 */

export {};

const express = require('express');
const router = express.Router();
const { networkService } = require('../../../../config/container');
const logger = require('../../../../logging/logger');
const {
  bssidParamMiddleware,
  validateQuery,
  optional,
} = require('../../../../validation/middleware');
const {
  validateBoolean,
  validateIntegerRange,
  validateString,
} = require('../../../../validation/schemas');

const validateNetworkTagsQuery = validateQuery({
  ignored: optional(validateBoolean),
  threat_tag: optional((value: unknown) => validateString(String(value), 1, 64, 'threat_tag')),
  has_notes: optional(validateBoolean),
  pending_wigle: optional(validateBoolean),
  limit: optional((value: unknown) => validateIntegerRange(value, 1, 5000, 'limit')),
  offset: optional((value: unknown) => validateIntegerRange(value, 0, 10000000, 'offset')),
});

// Validate BSSID path parameters for tag routes
router.use('/:bssid', bssidParamMiddleware);

/**
 * GET /api/network-tags/:bssid
 * Get tags for a specific network
 */
router.get('/:bssid', async (req: any, res: any) => {
  try {
    const { bssid } = req.params;
    const normalizedBssid = bssid.toUpperCase();

    const tag = await networkService.getNetworkTagByBssid(normalizedBssid);

    if (!tag) {
      return res.json({
        bssid: normalizedBssid,
        is_ignored: false,
        ignore_reason: null,
        threat_tag: null,
        threat_confidence: null,
        notes: null,
        exists: false,
      });
    }

    res.json({ ...tag, exists: true });
  } catch (error: any) {
    logger.error(`Error fetching network tag: ${error.message}`, {
      error,
      bssid: req.params.bssid,
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/network-tags
 * List all tagged networks with optional filters
 */
router.get('/', validateNetworkTagsQuery, async (req: any, res: any) => {
  try {
    const ignored = req.validated?.ignored;
    const threat_tag = req.validated?.threat_tag;
    const has_notes = req.validated?.has_notes;
    const pending_wigle = req.validated?.pending_wigle;
    const limit = req.validated?.limit ?? 100;
    const offset = req.validated?.offset ?? 0;

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (ignored === true) {
      whereClauses.push('nt.is_ignored = true');
    } else if (ignored === false) {
      whereClauses.push('nt.is_ignored = false');
    }

    if (threat_tag) {
      params.push(threat_tag);
      whereClauses.push(`nt.threat_tag = $${params.length}`);
    }

    if (has_notes === true) {
      whereClauses.push('nt.notes IS NOT NULL');
    }

    if (pending_wigle === true) {
      whereClauses.push('nt.wigle_lookup_requested = true AND nt.wigle_result IS NULL');
    }

    const { rows, totalCount } = await networkService.listNetworkTags(
      whereClauses,
      params,
      limit,
      offset
    );

    res.json({
      tags: rows.map((row: any) => {
        const { total_count: _total_count, ...rest } = row;
        return rest;
      }),
      total: totalCount,
      limit,
      offset,
    });
  } catch (error: any) {
    logger.error(`Error listing network tags: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
