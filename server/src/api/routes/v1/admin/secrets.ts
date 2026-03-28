import express from 'express';
import { requireAdmin } from '../../../../middleware/authMiddleware';

const router = express.Router();
const logger = require('../../../../logging/logger');
const {
  listSecretsStatus,
  storeSecret,
  deleteSecret,
} = require('./adminSecretsHelpers');

/**
 * GET /api/admin/secrets
 * List all configured secrets (names only, no values)
 */
router.get('/admin/secrets', requireAdmin, async (_req: any, res: any) => {
  try {
    res.json({ ok: true, secrets: listSecretsStatus() });
  } catch (err: any) {
    logger.error('[Admin] Failed to list secrets', { error: err?.message });
    res.status(500).json({ ok: false, error: 'Failed to list secrets' });
  }
});

/**
 * POST /api/admin/secrets/:key
 * Store a secret in AWS Secrets Manager
 */
router.post('/admin/secrets/:key', requireAdmin, async (req: any, res: any) => {
  try {
    await storeSecret(req.params.key, req.body.value);
    logger.info('[Admin] Secret stored', { key: req.params.key });
    res.json({ ok: true, message: `Secret '${req.params.key}' stored successfully` });
  } catch (err: any) {
    logger.error('[Admin] Failed to store secret', { error: err?.message });
    res.status(500).json({ ok: false, error: err.message || 'Failed to store secret' });
  }
});

/**
 * DELETE /api/admin/secrets/:key
 * Remove a secret from AWS Secrets Manager
 */
router.delete('/admin/secrets/:key', requireAdmin, async (req: any, res: any) => {
  try {
    await deleteSecret(req.params.key);
    logger.info('[Admin] Secret deleted', { key: req.params.key });
    res.json({ ok: true, message: `Secret '${req.params.key}' deleted successfully` });
  } catch (err: any) {
    const status = err.code === 'REQUIRED' ? 400 : 500;
    logger.error('[Admin] Failed to delete secret', { error: err?.message });
    res.status(status).json({ ok: false, error: err.message || 'Failed to delete secret' });
  }
});

module.exports = router;
