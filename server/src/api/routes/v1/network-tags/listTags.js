/**
 * Network Tags List Routes
 * GET endpoints for listing and retrieving network tags
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../../../config/database');
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

/**
 * Validates query parameters for listing network tags.
 * @type {function}
 */
const validateNetworkTagsQuery = validateQuery({
  ignored: optional(validateBoolean),
  threat_tag: optional((value) => validateString(String(value), 1, 64, 'threat_tag')),
  has_notes: optional(validateBoolean),
  pending_wigle: optional(validateBoolean),
  limit: optional((value) => validateIntegerRange(value, 1, 5000, 'limit')),
  offset: optional((value) => validateIntegerRange(value, 0, 10000000, 'offset')),
});

// Validate BSSID path parameters for tag routes
router.use('/:bssid', bssidParamMiddleware);

/**
 * GET /api/network-tags/:bssid
 * Get tags for a specific network
 */
router.get('/:bssid', async (req, res) => {
  try {
    const { bssid } = req.params;
    const normalizedBssid = bssid.toUpperCase();

    const result = await query(
      `SELECT
        bssid,
        is_ignored,
        ignore_reason,
        threat_tag,
        threat_confidence,
        notes,
        wigle_lookup_requested,
        wigle_lookup_at,
        wigle_result,
        created_at,
        updated_at,
        tag_history
      FROM app.network_tags
      WHERE bssid = $1`,
      [normalizedBssid]
    );

    if (result.rows.length === 0) {
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

    res.json({ ...result.rows[0], exists: true });
  } catch (error) {
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
router.get('/', validateNetworkTagsQuery, async (req, res) => {
  try {
    const ignored = req.validated?.ignored;
    const threat_tag = req.validated?.threat_tag;
    const has_notes = req.validated?.has_notes;
    const pending_wigle = req.validated?.pending_wigle;
    const limit = req.validated?.limit ?? 100;
    const offset = req.validated?.offset ?? 0;

    const whereClauses = [];
    const params = [];

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

    params.push(limit);
    params.push(offset);

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const result = await query(
      `SELECT
        nt.*,
        n.ssid,
        n.type as network_type,
        n.frequency,
        n.bestlevel as signal_dbm,
        n.bestlat as latitude,
        n.bestlon as longitude,
        COUNT(*) OVER() as total_count
      FROM app.network_tags nt
      LEFT JOIN app.networks n ON nt.bssid = n.bssid
      ${whereClause}
      ORDER BY nt.updated_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    res.json({
      tags: result.rows.map((row) => {
        const { total_count: _total_count, ...rest } = row;
        return rest;
      }),
      total: totalCount,
      limit,
      offset,
    });
  } catch (error) {
    logger.error(`Error listing network tags: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
