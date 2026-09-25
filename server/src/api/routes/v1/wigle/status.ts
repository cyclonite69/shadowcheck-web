/**
 * WiGLE Status Routes
 * API connectivity checks
 */

import express from 'express';
const router = express.Router();
import secretsManager from '../../../../services/secretsManager';
import { requireAdmin } from '../../../../middleware/authMiddleware';
import { getQuotaStatus, resetQuotaLedger } from '../../../../services/wigleRequestLedger';

/**
 * GET /wigle/api-status - Check WiGLE API connectivity
 */
router.get('/api-status', async (req, res) => {
  const wigleApiName = secretsManager.get('wigle_api_name');
  const wigleApiToken = secretsManager.get('wigle_api_token');

  res.json({
    configured: Boolean(wigleApiName && wigleApiToken),
    hasApiName: Boolean(wigleApiName),
    hasApiToken: Boolean(wigleApiToken),
  });
});

router.get('/quota-status', requireAdmin, async (_req, res) => {
  res.json({
    ok: true,
    quota: getQuotaStatus(),
  });
});

/**
 * POST /wigle/quota-reset - Reset the in-memory WiGLE request ledger (admin only)
 */
router.post('/quota-reset', requireAdmin, async (_req, res) => {
  resetQuotaLedger();
  res.json({ ok: true, quota: getQuotaStatus() });
});

export default router;
