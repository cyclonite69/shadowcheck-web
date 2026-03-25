export {};
const express = require('express');
const router = express.Router();
const { settingsAdminService } = require('../../../../config/container');
const { backgroundJobsService } = require('../../../../config/container');
const logger = require('../../../../logging/logger');

/**
 * GET /api/admin/settings
 * Get all settings
 */
router.get('/', async (req: any, res: any) => {
  try {
    const rows = await settingsAdminService.getAllSettings();
    const settings: any = {};
    rows.forEach((row: any) => {
      settings[row.key] = {
        value: row.value,
        description: row.description,
        updatedAt: row.updated_at,
      };
    });
    res.json({ success: true, settings });
  } catch (error: any) {
    logger.error('Failed to get settings', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/settings/jobs/status
 * Get background job runtime status and recent history
 */
router.get('/jobs/status', async (req: any, res: any) => {
  try {
    const status = await backgroundJobsService.getJobStatus();
    res.json({ success: true, ...status });
  } catch (error: any) {
    logger.error('Failed to get background job status', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/settings/:key
 * Get a specific setting
 */
router.get('/:key', async (req: any, res: any) => {
  try {
    const { key } = req.params;
    const setting = await settingsAdminService.getSettingByKey(key);
    if (!setting) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }
    res.json({ success: true, key, ...setting });
  } catch (error: any) {
    logger.error('Failed to get setting', { error: error.message, key: req.params.key });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/settings/:key
 * Update a setting
 */
router.put('/:key', async (req: any, res: any) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }

    const setting = await settingsAdminService.updateSetting(key, value);

    if (!setting) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }

    logger.info('Setting updated', { key, value });
    res.json({ success: true, setting });
  } catch (error: any) {
    logger.error('Failed to update setting', { error: error.message, key: req.params.key });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/settings/ml-blending/toggle
 * Quick toggle for ML blending
 */
router.post('/ml-blending/toggle', async (req: any, res: any) => {
  try {
    const newValue = await settingsAdminService.toggleMLBlending();
    logger.info('ML blending toggled', { enabled: newValue });
    res.json({ success: true, ml_blending_enabled: newValue });
  } catch (error: any) {
    logger.error('Failed to toggle ML blending', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
