export {};
const express = require('express');
const router = express.Router();
const { query } = require('../../../../config/database');
const { adminQuery } = require('../../../../services/adminDbService');
const logger = require('../../../../logging/logger');

/**
 * GET /api/admin/settings
 * Get all settings
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT key, value, description, updated_at FROM app.settings ORDER BY key'
    );
    const settings = {};
    result.rows.forEach((row) => {
      settings[row.key] = {
        value: row.value,
        description: row.description,
        updatedAt: row.updated_at,
      };
    });
    res.json({ success: true, settings });
  } catch (error) {
    logger.error('Failed to get settings', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/settings/:key
 * Get a specific setting
 */
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const result = await query(
      'SELECT value, description, updated_at FROM app.settings WHERE key = $1',
      [key]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }
    res.json({ success: true, key, ...result.rows[0] });
  } catch (error) {
    logger.error('Failed to get setting', { error: error.message, key: req.params.key });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/settings/:key
 * Update a setting
 */
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }

    const result = await adminQuery(
      'UPDATE app.settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
      [JSON.stringify(value), key]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }

    logger.info('Setting updated', { key, value });
    res.json({ success: true, setting: result.rows[0] });
  } catch (error) {
    logger.error('Failed to update setting', { error: error.message, key: req.params.key });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/settings/ml-blending/toggle
 * Quick toggle for ML blending
 */
router.post('/ml-blending/toggle', async (req, res) => {
  try {
    const result = await adminQuery(`
      UPDATE app.settings
      SET value = CASE WHEN value::text = 'true' THEN 'false' ELSE 'true' END,
          updated_at = NOW()
      WHERE key = 'ml_blending_enabled'
      RETURNING value
    `);

    const newValue = result.rows[0]?.value;
    logger.info('ML blending toggled', { enabled: newValue });
    res.json({ success: true, ml_blending_enabled: newValue });
  } catch (error) {
    logger.error('Failed to toggle ML blending', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
