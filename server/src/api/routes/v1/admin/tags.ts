export {};
/**
 * Admin Network Tags Routes
 * Tag management operations for networks
 */

const express = require('express');
const router = express.Router();
const { adminNetworkTagsService } = require('../../../../config/container');
const logger = require('../../../../logging/logger');
const { validateString, validateIntegerRange } = require('../../../../validation/schemas');

// POST /api/admin/network-tags/toggle - Toggle tag on/off (add if missing, remove if present)
router.post('/admin/network-tags/toggle', async (req: any, res: any, next: any) => {
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
    const existingResult = await adminNetworkTagsService.getNetworkTagsByBssid(bssid);

    let action, _newTags;

    if (!existingResult) {
      // Network doesn't exist, create with tag
      await adminNetworkTagsService.insertNetworkTagWithNotes(bssid, [tag], notes);
      action = 'added';
      _newTags = [tag];
    } else {
      // Network exists, toggle the tag
      const currentTags = existingResult.tags || [];
      const hasTag = currentTags.includes(tag);

      if (hasTag) {
        // Remove tag
        await adminNetworkTagsService.removeTagFromNetwork(bssid, tag);
        action = 'removed';
        _newTags = currentTags.filter((t: any) => t !== tag);
      } else {
        // Add tag
        await adminNetworkTagsService.addTagToNetwork(bssid, tag, notes);
        action = 'added';
        _newTags = [...currentTags, tag];
      }
    }

    // Get updated network info
    const result = await adminNetworkTagsService.getNetworkTagsAndNotes(bssid);

    res.json({
      ok: true,
      action: action,
      message: `Tag '${tag}' ${action} ${action === 'added' ? 'to' : 'from'} network ${bssid}`,
      network: result.rows[0],
    });
  } catch (error: any) {
    logger.error(`Toggle tag error: ${error.message}`);
    next(error);
  }
});

// DELETE /api/admin/network-tags/remove - Remove tag from network
router.delete('/api/admin/network-tags/remove', async (req: any, res: any, next: any) => {
  try {
    const { bssid, tag } = req.body;

    if (!bssid || !tag) {
      return res.status(400).json({
        error: { message: 'BSSID and tag are required' },
      });
    }

    // Remove tag
    await adminNetworkTagsService.removeTagFromNetwork(bssid, tag);

    // Get updated tags
    const result = await adminNetworkTagsService.getNetworkTagsAndNotes(bssid);

    res.json({
      ok: true,
      message: `Tag '${tag}' removed from network ${bssid}`,
      network: result,
    });
  } catch (error: any) {
    logger.error(`Remove tag error: ${error.message}`);
    next(error);
  }
});

// GET /api/admin/network-tags/:bssid - Get all tags for a network
router.get('/admin/network-tags/:bssid', async (req: any, res: any, next: any) => {
  try {
    const { bssid } = req.params;

    const result = await adminNetworkTagsService.getNetworkTagsExpanded(bssid);

    if (!result) {
      return res.status(404).json({
        error: { message: `No tags found for network ${bssid}` },
      });
    }

    res.json({
      ok: true,
      network: result,
    });
  } catch (error: any) {
    next(error);
  }
});

// GET /api/admin/network-tags/search - Search networks by tags
router.get('/admin/network-tags/search', async (req: any, res: any, next: any) => {
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
      .map((t: any) => t.trim())
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
    const result = await adminNetworkTagsService.searchNetworksByTagArray(
      tagArray,
      limitValidation.value
    );

    res.json({
      ok: true,
      searchTags: tagArray,
      networks: result,
      count: result.length,
    });
  } catch (error: any) {
    next(error);
  }
});

module.exports = router;
