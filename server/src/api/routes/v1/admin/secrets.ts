import express from 'express';
import { requireAdmin } from '../../../../middleware/authMiddleware';

const router = express.Router();
const { secretsManager } = require('../../../../config/container');
const logger = require('../../../../logging/logger');

/**
 * GET /api/admin/secrets
 * List all configured secrets (names only, no values)
 */
router.get('/admin/secrets', requireAdmin, async (req, res) => {
  try {
    const secrets = [
      'db_password',
      'session_secret',
      'mapbox_token',
      'wigle_api_key',
      'wigle_api_token',
      'opencage_api_key',
      'locationiq_api_key',
      'google_maps_api_key',
    ];

    const status = secrets.map((key) => ({
      key,
      configured: secretsManager.has(key),
      required: ['db_password', 'session_secret'].includes(key),
    }));

    res.json({ ok: true, secrets: status });
  } catch (err) {
    logger.error('[Admin] Failed to list secrets', { error: err?.message });
    res.status(500).json({ ok: false, error: 'Failed to list secrets' });
  }
});

/**
 * POST /api/admin/secrets/:key
 * Store a secret in AWS Secrets Manager
 */
router.post('/admin/secrets/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!value) {
      return res.status(400).json({ ok: false, error: 'Value is required' });
    }

    await secretsManager.putSecret(key, value);
    logger.info('[Admin] Secret stored', { key });

    res.json({ ok: true, message: `Secret '${key}' stored successfully` });
  } catch (err) {
    logger.error('[Admin] Failed to store secret', { error: err?.message });
    res.status(500).json({ ok: false, error: 'Failed to store secret' });
  }
});

/**
 * DELETE /api/admin/secrets/:key
 * Remove a secret from AWS Secrets Manager
 */
router.delete('/admin/secrets/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;

    // Prevent deletion of required secrets
    if (['db_password', 'session_secret'].includes(key)) {
      return res.status(400).json({
        ok: false,
        error: 'Cannot delete required secrets',
      });
    }

    await secretsManager.deleteSecret(key);
    logger.info('[Admin] Secret deleted', { key });

    res.json({ ok: true, message: `Secret '${key}' deleted successfully` });
  } catch (err) {
    logger.error('[Admin] Failed to delete secret', { error: err?.message });
    res.status(500).json({ ok: false, error: 'Failed to delete secret' });
  }
});

module.exports = router;
