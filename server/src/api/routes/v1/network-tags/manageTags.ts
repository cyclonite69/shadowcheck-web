/**
 * Network Tags Management Routes
 * POST, PATCH, DELETE endpoints for managing network tags
 */

export {};

const express = require('express');
const router = express.Router();
const { networkService, adminDbService } = require('../../../../config/container');
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
router.post('/:bssid', requireAdmin, async (req: any, res: any) => {
  try {
    const { bssid } = req.params;
    const normalizedBssid = bssid.toUpperCase();
    const { is_ignored, ignore_reason, threat_tag, threat_confidence, notes } = req.body;

    if (
      threat_tag !== undefined &&
      threat_tag !== null &&
      !VALID_THREAT_TAGS.includes(threat_tag)
    ) {
      return res.status(400).json({
        error: `Invalid threat_tag. Must be one of: ${VALID_THREAT_TAGS.join(', ')}`,
      });
    }

    if (
      ignore_reason !== undefined &&
      ignore_reason !== null &&
      !VALID_IGNORE_REASONS.includes(ignore_reason)
    ) {
      return res.status(400).json({
        error: `Invalid ignore_reason. Must be one of: ${VALID_IGNORE_REASONS.join(', ')}`,
      });
    }

    if (threat_confidence !== undefined && threat_confidence !== null) {
      const conf = parseFloat(threat_confidence);
      if (isNaN(conf) || conf < 0 || conf > 1) {
        return res.status(400).json({
          error: 'threat_confidence must be a number between 0 and 1',
        });
      }
    }

    const result = await adminDbService.upsertNetworkTag(
      normalizedBssid,
      is_ignored ?? null,
      ignore_reason ?? null,
      threat_tag ?? null,
      threat_confidence ?? null,
      notes ?? null
    );

    logger.info(`Network tagged: ${normalizedBssid}`, {
      bssid: normalizedBssid,
      is_ignored,
      threat_tag,
    });

    res.json({ ok: true, tag: result });
  } catch (error: any) {
    logger.error(`Error tagging network: ${error.message}`, { error, bssid: req.params.bssid });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/network-tags/:bssid/ignore
 * Toggle ignore status for a network
 */
router.patch('/:bssid/ignore', requireAdmin, async (req: any, res: any) => {
  try {
    const { bssid } = req.params;
    const normalizedBssid = bssid.toUpperCase();
    const { ignore_reason } = req.body;

    const existing = await networkService.getNetworkTagByBssid(normalizedBssid);

    let result;
    if (!existing) {
      result = await adminDbService.insertNetworkTagIgnore(
        normalizedBssid,
        true,
        ignore_reason ?? null
      );
    } else {
      const newIgnoreState = !existing.is_ignored;
      result = await adminDbService.updateNetworkTagIgnore(
        normalizedBssid,
        newIgnoreState,
        newIgnoreState ? (ignore_reason ?? null) : null
      );
    }

    logger.info(`Network ignore toggled: ${normalizedBssid} -> ${result.is_ignored}`, {
      bssid: normalizedBssid,
      is_ignored: result.is_ignored,
    });

    res.json({ ok: true, tag: result });
  } catch (error: any) {
    logger.error(`Error toggling ignore: ${error.message}`, { error, bssid: req.params.bssid });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/network-tags/:bssid/threat
 * Set threat classification for a network
 */
router.patch('/:bssid/threat', requireAdmin, async (req: any, res: any) => {
  try {
    const { bssid } = req.params;
    const normalizedBssid = bssid.toUpperCase();
    const { threat_tag, threat_confidence } = req.body;

    if (threat_tag !== null && !VALID_THREAT_TAGS.includes(threat_tag)) {
      return res.status(400).json({
        error: `Invalid threat_tag. Must be one of: ${VALID_THREAT_TAGS.join(', ')}, or null to clear`,
      });
    }

    const existing = await networkService.getNetworkTagByBssid(normalizedBssid);

    let result;
    if (!existing) {
      result = await adminDbService.insertNetworkThreatTag(
        normalizedBssid,
        threat_tag,
        threat_confidence ?? null
      );
    } else {
      result = await adminDbService.updateNetworkThreatTag(
        normalizedBssid,
        threat_tag,
        threat_confidence ?? null
      );
    }

    logger.info(`Network threat tagged: ${normalizedBssid} -> ${threat_tag}`, {
      bssid: normalizedBssid,
      threat_tag,
      threat_confidence,
    });

    res.json({ ok: true, tag: result });
  } catch (error: any) {
    logger.error(`Error setting threat tag: ${error.message}`, { error, bssid: req.params.bssid });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/network-tags/:bssid/notes
 * Update notes for a network
 */
router.patch('/:bssid/notes', requireAdmin, async (req: any, res: any) => {
  try {
    const { bssid } = req.params;
    const normalizedBssid = bssid.toUpperCase();
    const { notes } = req.body;

    const existing = await networkService.getNetworkTagByBssid(normalizedBssid);

    let result;
    if (!existing) {
      result = await adminDbService.insertNetworkTagNotes(normalizedBssid, notes);
    } else {
      result = await adminDbService.updateNetworkTagNotes(normalizedBssid, notes);
    }

    res.json({ ok: true, tag: result });
  } catch (error: any) {
    logger.error(`Error updating notes: ${error.message}`, { error, bssid: req.params.bssid });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/network-tags/:bssid/investigate
 * Queue network for WiGLE lookup
 */
router.patch('/:bssid/investigate', requireAdmin, async (req: any, res: any) => {
  try {
    const { bssid } = req.params;
    const normalizedBssid = bssid.toUpperCase();

    const existing = await networkService.getNetworkTagByBssid(normalizedBssid);

    let result;
    if (!existing) {
      result = await adminDbService.upsertNetworkTag(
        normalizedBssid,
        null,
        null,
        'INVESTIGATE',
        null,
        null
      );
      result = await adminDbService.requestWigleLookup(normalizedBssid);
    } else {
      result = await adminDbService.updateNetworkThreatTag(normalizedBssid, 'INVESTIGATE', null);
      result = await adminDbService.requestWigleLookup(normalizedBssid);
    }

    logger.info(`Network queued for investigation: ${normalizedBssid}`, { bssid: normalizedBssid });

    res.json({ ok: true, tag: result });
  } catch (error: any) {
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
router.delete('/:bssid', requireAdmin, async (req: any, res: any) => {
  try {
    const { bssid } = req.params;
    const normalizedBssid = bssid.toUpperCase();

    const rowCount = await adminDbService.deleteNetworkTag(normalizedBssid);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'No tags found for this network' });
    }

    logger.info(`Network tags removed: ${normalizedBssid}`, { bssid: normalizedBssid });

    res.json({ ok: true, deleted: normalizedBssid });
  } catch (error: any) {
    logger.error(`Error deleting tags: ${error.message}`, { error, bssid: req.params.bssid });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/network-tags/export/ml
 * Export tagged networks for ML training
 */
router.get('/export/ml', requireAdmin, async (req: any, res: any) => {
  try {
    const trainingData = await adminDbService.exportMLTrainingData();

    res.json({
      training_data: trainingData,
      count: trainingData.length,
      exported_at: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error(`Error exporting ML data: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
