import express from 'express';
import { requireAdmin } from '../../../../middleware/authMiddleware';

const router = express.Router();
const keyringService = require('../../../../services/keyringService');
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

    const status = await Promise.all(
      secrets.map(async (key) => {
        const value = await keyringService.getCredential(key);
        return {
          key,
          configured: !!value,
          required: ['db_password', 'session_secret'].includes(key),
        };
      })
    );

    res.json({ ok: true, secrets: status });
  } catch (err) {
    logger.error('[Admin] Failed to list secrets', { error: err?.message });
    res.status(500).json({ ok: false, error: 'Failed to list secrets' });
  }
});

/**
 * POST /api/admin/secrets/:key
 * Store a secret in keyring
 */
router.post('/admin/secrets/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!value) {
      return res.status(400).json({ ok: false, error: 'Value is required' });
    }

    await keyringService.setCredential(key, value);
    logger.info('[Admin] Secret stored', { key });

    res.json({ ok: true, message: `Secret '${key}' stored successfully` });
  } catch (err) {
    logger.error('[Admin] Failed to store secret', { error: err?.message });
    res.status(500).json({ ok: false, error: 'Failed to store secret' });
  }
});

/**
 * DELETE /api/admin/secrets/:key
 * Remove a secret from keyring
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

    await keyringService.deleteCredential(key);
    logger.info('[Admin] Secret deleted', { key });

    res.json({ ok: true, message: `Secret '${key}' deleted successfully` });
  } catch (err) {
    logger.error('[Admin] Failed to delete secret', { error: err?.message });
    res.status(500).json({ ok: false, error: 'Failed to delete secret' });
  }
});

module.exports = router;
