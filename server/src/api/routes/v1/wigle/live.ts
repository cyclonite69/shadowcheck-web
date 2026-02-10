/**
 * WiGLE Live API Routes
 * Real-time lookups against WiGLE API
 */

import express from 'express';
const router = express.Router();
import secretsManager from '../../../../services/secretsManager';
import logger from '../../../../logging/logger';
import { withRetry } from '../../../../services/externalServiceHandler';
import { macParamMiddleware } from '../../../../validation/middleware';

/**
 * GET /live/:bssid - Query live WiGLE API for network
 */
router.get('/live/:bssid', macParamMiddleware, async (req, res, next) => {
  try {
    const { bssid } = req.params;
    const wigleApiName = secretsManager.get('wigle_api_name');
    const wigleApiToken = secretsManager.get('wigle_api_token');

    if (!wigleApiName || !wigleApiToken) {
      return res.status(503).json({ error: 'WiGLE API credentials not configured' });
    }

    const encodedAuth = Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');
    logger.info(`[WiGLE] Querying for BSSID: ${bssid}`);

    const response = await withRetry(
      () =>
        fetch(`https://api.wigle.net/api/v3/detail/wifi/${encodeURIComponent(bssid)}`, {
          headers: {
            Authorization: `Basic ${encodedAuth}`,
            Accept: 'application/json',
          },
        }),
      {
        serviceName: 'WiGLE API',
        timeoutMs: 10000,
        maxRetries: 2,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[WiGLE] API error ${response.status}: ${errorText}`);
      return res.status(response.status).json({
        error: 'WiGLE API request failed',
        status: response.status,
        details: errorText,
      });
    }

    const data = await response.json();
    logger.info(`[WiGLE] Found ${data.resultCount || 0} results for ${bssid}`);

    res.json({
      success: true,
      network: data.results && data.results.length > 0 ? data.results[0] : null,
      totalResults: data.resultCount || 0,
      results: data.results || [],
    });
  } catch (err: any) {
    logger.error(`[WiGLE] Error: ${err.message}`, { error: err });
    next(err);
  }
});

export default router;
