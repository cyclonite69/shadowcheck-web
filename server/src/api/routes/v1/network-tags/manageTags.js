/**
 * Network Tags Management Routes
 * POST, PATCH, DELETE endpoints for managing network tags
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../../../config/database');
const logger = require('../../../../logging/logger');
const { requireAdmin } = require('../../../../middleware/authMiddleware');
const { bssidParamMiddleware } = require('../../../../validation/middleware');

// Valid threat tag values
const VALID_THREAT_TAGS = ['THREAT', 'SUSPECT', 'FALSE_POSITIVE', 'INVESTIGATE'];
const VALID_IGNORE_REASONS = [
  'own_device',
  'known_friend',
  'neighbor',
  'business',
  'infrastructure',
  'other',
];

// Validate BSSID path parameters for tag routes
router.use('/:bssid', bssidParamMiddleware);

/**
 * POST /api/network-tags/:bssid
 * Create or update tags for a network (upsert)
 */
router.post('/:bssid', requireAdmin, async (req, res) => {
  try {
    const { bssid } = req.params;
    const normalizedBssid = bssid.toUpperCase();
    const { is_ignored, ignore_reason, threat_tag, threat_confidence, notes } = req.body;

    // Validate threat_tag if provided
    if (
      threat_tag !== undefined &&
      threat_tag !== null &&
      !VALID_THREAT_TAGS.includes(threat_tag)
    ) {
      return res.status(400).json({
        error: `Invalid threat_tag. Must be one of: ${VALID_THREAT_TAGS.join(', ')}`,
      });
    }

    // Validate ignore_reason if provided
    if (
      ignore_reason !== undefined &&
      ignore_reason !== null &&
      !VALID_IGNORE_REASONS.includes(ignore_reason)
    ) {
      return res.status(400).json({
        error: `Invalid ignore_reason. Must be one of: ${VALID_IGNORE_REASONS.join(', ')}`,
      });
    }

    // Validate threat_confidence if provided
    if (threat_confidence !== undefined && threat_confidence !== null) {
      const conf = parseFloat(threat_confidence);
      if (isNaN(conf) || conf < 0 || conf > 1) {
        return res.status(400).json({
          error: 'threat_confidence must be a number between 0 and 1',
        });
      }
    }

    const result = await query(
      `INSERT INTO app.network_tags (
        bssid, is_ignored, ignore_reason, threat_tag, threat_confidence, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (bssid) DO UPDATE SET
        is_ignored = COALESCE($2, app.network_tags.is_ignored),
        ignore_reason = CASE WHEN $2 IS NOT NULL THEN $3 ELSE app.network_tags.ignore_reason END,
        threat_tag = COALESCE($4, app.network_tags.threat_tag),
        threat_confidence = CASE WHEN $4 IS NOT NULL THEN $5 ELSE app.network_tags.threat_confidence END,
        notes = COALESCE($6, app.network_tags.notes),
        updated_at = NOW()
      RETURNING *`,
      [
        normalizedBssid,
        is_ignored ?? null,
        ignore_reason ?? null,
        threat_tag ?? null,
        threat_confidence ?? null,
        notes ?? null,
      ]
    );

    logger.info(`Network tagged: ${normalizedBssid}`, {
      bssid: normalizedBssid,
      is_ignored,
      threat_tag,
    });

    res.json({ ok: true, tag: result.rows[0] });
  } catch (error) {
    logger.error(`Error tagging network: ${error.message}`, { error, bssid: req.params.bssid });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/network-tags/:bssid/ignore
 * Toggle ignore status for a network
 */
router.patch('/:bssid/ignore', requireAdmin, async (req, res) => {
  try {
    const { bssid } = req.params;
    const normalizedBssid = bssid.toUpperCase();
    const { ignore_reason } = req.body;

    // First check if tag exists and get current state
    const existing = await query('SELECT is_ignored FROM app.network_tags WHERE bssid = $1', [
      normalizedBssid,
    ]);

    let result;
    if (existing.rows.length === 0) {
      // Create new with is_ignored = true
      result = await query(
        `INSERT INTO app.network_tags (bssid, is_ignored, ignore_reason)
         VALUES ($1, true, $2)
         RETURNING *`,
        [normalizedBssid, ignore_reason ?? null]
      );
    } else {
      // Toggle existing (COALESCE handles NULL as false)
      result = await query(
        `UPDATE app.network_tags
         SET is_ignored = NOT COALESCE(is_ignored, false),
             ignore_reason = CASE WHEN NOT COALESCE(is_ignored, false) THEN $2 ELSE NULL END,
             updated_at = NOW()
         WHERE bssid = $1
         RETURNING *`,
        [normalizedBssid, ignore_reason ?? null]
      );
    }

    logger.info(`Network ignore toggled: ${normalizedBssid} -> ${result.rows[0].is_ignored}`, {
      bssid: normalizedBssid,
      is_ignored: result.rows[0].is_ignored,
    });

    res.json({ ok: true, tag: result.rows[0] });
  } catch (error) {
    logger.error(`Error toggling ignore: ${error.message}`, { error, bssid: req.params.bssid });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/network-tags/:bssid/threat
 * Set threat classification for a network
 */
router.patch('/:bssid/threat', requireAdmin, async (req, res) => {
  try {
    const { bssid } = req.params;
    const normalizedBssid = bssid.toUpperCase();
    const { threat_tag, threat_confidence } = req.body;

    // Validate threat_tag
    if (threat_tag !== null && !VALID_THREAT_TAGS.includes(threat_tag)) {
      return res.status(400).json({
        error: `Invalid threat_tag. Must be one of: ${VALID_THREAT_TAGS.join(', ')}, or null to clear`,
      });
    }

    // Check if exists
    const existing = await query('SELECT id FROM app.network_tags WHERE bssid = $1', [
      normalizedBssid,
    ]);

    let result;
    if (existing.rows.length === 0) {
      result = await query(
        `INSERT INTO app.network_tags (bssid, threat_tag, threat_confidence)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [normalizedBssid, threat_tag, threat_confidence ?? null]
      );
    } else {
      result = await query(
        `UPDATE app.network_tags
         SET threat_tag = $2,
             threat_confidence = $3,
             updated_at = NOW()
         WHERE bssid = $1
         RETURNING *`,
        [normalizedBssid, threat_tag, threat_confidence ?? null]
      );
    }

    logger.info(`Network threat tagged: ${normalizedBssid} -> ${threat_tag}`, {
      bssid: normalizedBssid,
      threat_tag,
      threat_confidence,
    });

    res.json({ ok: true, tag: result.rows[0] });
  } catch (error) {
    logger.error(`Error setting threat tag: ${error.message}`, { error, bssid: req.params.bssid });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/network-tags/:bssid/notes
 * Update notes for a network
 */
router.patch('/:bssid/notes', requireAdmin, async (req, res) => {
  try {
    const { bssid } = req.params;
    const normalizedBssid = bssid.toUpperCase();
    const { notes } = req.body;

    // Check if exists
    const existing = await query('SELECT id FROM app.network_tags WHERE bssid = $1', [
      normalizedBssid,
    ]);

    let result;
    if (existing.rows.length === 0) {
      result = await query(
        `INSERT INTO app.network_tags (bssid, notes)
         VALUES ($1, $2)
         RETURNING *`,
        [normalizedBssid, notes]
      );
    } else {
      result = await query(
        `UPDATE app.network_tags
         SET notes = $2,
             updated_at = NOW()
         WHERE bssid = $1
         RETURNING *`,
        [normalizedBssid, notes]
      );
    }

    res.json({ ok: true, tag: result.rows[0] });
  } catch (error) {
    logger.error(`Error updating notes: ${error.message}`, { error, bssid: req.params.bssid });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/network-tags/:bssid/investigate
 * Queue network for WiGLE lookup
 */
router.patch('/:bssid/investigate', requireAdmin, async (req, res) => {
  try {
    const { bssid } = req.params;
    const normalizedBssid = bssid.toUpperCase();

    // Check if exists
    const existing = await query('SELECT id FROM app.network_tags WHERE bssid = $1', [
      normalizedBssid,
    ]);

    let result;
    if (existing.rows.length === 0) {
      result = await query(
        `INSERT INTO app.network_tags (bssid, threat_tag, wigle_lookup_requested)
         VALUES ($1, 'INVESTIGATE', true)
         RETURNING *`,
        [normalizedBssid]
      );
    } else {
      result = await query(
        `UPDATE app.network_tags
         SET threat_tag = 'INVESTIGATE',
             wigle_lookup_requested = true,
             updated_at = NOW()
         WHERE bssid = $1
         RETURNING *`,
        [normalizedBssid]
      );
    }

    logger.info(`Network queued for investigation: ${normalizedBssid}`, { bssid: normalizedBssid });

    res.json({ ok: true, tag: result.rows[0] });
  } catch (error) {
    logger.error(`Error queuing investigation: ${error.message}`, {
      error,
      bssid: req.params.bssid,
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/network-tags/:bssid
 * Remove all tags for a network
 */
router.delete('/:bssid', requireAdmin, async (req, res) => {
  try {
    const { bssid } = req.params;
    const normalizedBssid = bssid.toUpperCase();

    const result = await query('DELETE FROM app.network_tags WHERE bssid = $1 RETURNING bssid', [
      normalizedBssid,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No tags found for this network' });
    }

    logger.info(`Network tags removed: ${normalizedBssid}`, { bssid: normalizedBssid });

    res.json({ ok: true, deleted: normalizedBssid });
  } catch (error) {
    logger.error(`Error deleting tags: ${error.message}`, { error, bssid: req.params.bssid });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/network-tags/export/ml
 * Export tagged networks for ML training
 */
router.get('/export/ml', requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        nt.bssid,
        nt.threat_tag,
        nt.threat_confidence,
        nt.is_ignored,
        nt.tag_history,
        n.ssid,
        n.type as network_type,
        n.frequency,
        n.capabilities,
        n.bestlevel as signal_dbm,
        COUNT(o.id) as observation_count,
        COUNT(DISTINCT DATE(o.observed_at)) as unique_days,
        ST_Distance(
          ST_MakePoint(MIN(o.lon), MIN(o.lat))::geography,
          ST_MakePoint(MAX(o.lon), MAX(o.lat))::geography
        ) / 1000.0 as distance_range_km
      FROM app.network_tags nt
      LEFT JOIN app.networks n ON nt.bssid = n.bssid
      LEFT JOIN app.observations o ON nt.bssid = o.bssid
      WHERE nt.threat_tag IS NOT NULL
      GROUP BY nt.bssid, nt.threat_tag, nt.threat_confidence, nt.is_ignored,
               nt.tag_history, n.ssid, n.type, n.frequency, n.capabilities, n.bestlevel, nt.updated_at
      ORDER BY nt.updated_at DESC`
    );

    res.json({
      training_data: result.rows,
      count: result.rows.length,
      exported_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Error exporting ML data: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
