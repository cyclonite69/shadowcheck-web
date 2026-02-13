export {};
/**
 * Admin Network Tags Routes
 * Tag management operations for networks
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../../../config/database');
const { adminQuery } = require('../../../../services/adminDbService');
const logger = require('../../../../logging/logger');
const { validateString, validateIntegerRange } = require('../../../../validation/schemas');

// POST /api/admin/network-tags/toggle - Toggle tag on/off (add if missing, remove if present)
router.post('/admin/network-tags/toggle', async (req, res, next) => {
  try {
    const { bssid, tag, notes } = req.body;

    if (!bssid || !tag) {
      return res.status(400).json({
        error: { message: 'BSSID and tag are required' },
      });
    }

    // Valid tags
    const validTags = ['THREAT', 'INVESTIGATE', 'FALSE_POSITIVE', 'SUSPECT'];
    if (!validTags.includes(tag)) {
      return res.status(400).json({
        error: { message: `Invalid tag. Must be one of: ${validTags.join(', ')}` },
      });
    }

    // Check if network exists and has the tag
    const existingResult = await query('SELECT tags FROM app.network_tags WHERE bssid = $1', [
      bssid,
    ]);

    let action, _newTags;

    if (existingResult.rows.length === 0) {
      // Network doesn't exist, create with tag
      await adminQuery(
        `
        INSERT INTO app.network_tags (bssid, tags, notes, created_by)
        VALUES ($1, $2::jsonb, $3, 'admin')
      `,
        [bssid, JSON.stringify([tag]), notes]
      );
      action = 'added';
      _newTags = [tag];
    } else {
      // Network exists, toggle the tag
      const currentTags = existingResult.rows[0].tags || [];
      const hasTag = currentTags.includes(tag);

      if (hasTag) {
        // Remove tag
        await adminQuery(
          `
          UPDATE app.network_tags
          SET tags = app.network_remove_tag(tags, $2),
              updated_at = NOW()
          WHERE bssid = $1
        `,
          [bssid, tag]
        );
        action = 'removed';
        _newTags = currentTags.filter((t) => t !== tag);
      } else {
        // Add tag
        await adminQuery(
          `
          UPDATE app.network_tags
          SET tags = app.network_add_tag(tags, $2),
              notes = COALESCE($3, notes),
              updated_at = NOW()
          WHERE bssid = $1
        `,
          [bssid, tag, notes]
        );
        action = 'added';
        _newTags = [...currentTags, tag];
      }
    }

    // Get updated network info
    const result = await query('SELECT bssid, tags, notes FROM app.network_tags WHERE bssid = $1', [
      bssid,
    ]);

    res.json({
      ok: true,
      action: action,
      message: `Tag '${tag}' ${action} ${action === 'added' ? 'to' : 'from'} network ${bssid}`,
      network: result.rows[0],
    });
  } catch (error) {
    logger.error(`Toggle tag error: ${error.message}`);
    next(error);
  }
});

// DELETE /api/admin/network-tags/remove - Remove tag from network
router.delete('/admin/network-tags/remove', async (req, res, next) => {
  try {
    const { bssid, tag } = req.body;

    if (!bssid || !tag) {
      return res.status(400).json({
        error: { message: 'BSSID and tag are required' },
      });
    }

    // Remove tag
    await adminQuery(
      `
      UPDATE app.network_tags
      SET tags = app.network_remove_tag(tags, $2),
          updated_at = NOW()
      WHERE bssid = $1
    `,
      [bssid, tag]
    );

    // Get updated tags
    const result = await query('SELECT bssid, tags, notes FROM app.network_tags WHERE bssid = $1', [
      bssid,
    ]);

    res.json({
      ok: true,
      message: `Tag '${tag}' removed from network ${bssid}`,
      network: result.rows[0],
    });
  } catch (error) {
    logger.error(`Remove tag error: ${error.message}`);
    next(error);
  }
});

// GET /api/admin/network-tags/:bssid - Get all tags for a network
router.get('/admin/network-tags/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const result = await query(
      `
      SELECT
        bssid,
        tags,
        tag_array,
        is_threat,
        is_investigate,
        is_false_positive,
        is_suspect,
        notes,
        created_at,
        updated_at
      FROM app.network_tags_expanded
      WHERE bssid = $1
    `,
      [bssid]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: { message: `No tags found for network ${bssid}` },
      });
    }

    res.json({
      ok: true,
      network: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/network-tags/search - Search networks by tags
router.get('/admin/network-tags/search', async (req, res, next) => {
  try {
    const { tags, limit = 50 } = req.query;

    const tagsValidation = validateString(String(tags || ''), 1, 512, 'tags');
    if (!tagsValidation.valid) {
      return res.status(400).json({
        error: { message: tagsValidation.error || 'tags parameter required (comma-separated)' },
      });
    }

    const tagArray = String(tags)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagArray.length === 0) {
      return res.status(400).json({
        error: { message: 'tags parameter required (comma-separated)' },
      });
    }

    const limitValidation = validateIntegerRange(limit, 1, 1000, 'limit');
    if (!limitValidation.valid) {
      return res.status(400).json({ error: { message: limitValidation.error } });
    }

    // Find networks that have ALL specified tags
    const result = await query(
      `
      SELECT
        bssid,
        tags,
        tag_array,
        is_threat,
        is_investigate,
        is_false_positive,
        is_suspect,
        notes,
        updated_at
      FROM app.network_tags_expanded
      WHERE tags ?& $1
      ORDER BY updated_at DESC
      LIMIT $2
    `,
      [tagArray, limitValidation.value]
    );

    res.json({
      ok: true,
      searchTags: tagArray,
      networks: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
