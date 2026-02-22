/**
 * WiGLE Search API Routes
 * Live WiGLE API search with optional import
 */

import express from 'express';
const router = express.Router();
const { wigleService } = require('../../../../config/container');
import secretsManager from '../../../../services/secretsManager';
import logger from '../../../../logging/logger';
import { requireAdmin } from '../../../../middleware/authMiddleware';
import { withRetry } from '../../../../services/externalServiceHandler';

/**
 * POST /search-api - Search WiGLE API with optional import
 */
router.post('/search-api', requireAdmin, async (req, res, next) => {
  try {
    const wigleApiName = secretsManager.get('wigle_api_name');
    const wigleApiToken = secretsManager.get('wigle_api_token');

    if (!wigleApiName || !wigleApiToken) {
      return res.status(503).json({
        ok: false,
        error:
          'WiGLE API credentials not configured. Set wigle_api_name and wigle_api_token secrets.',
      });
    }

    const {
      ssid,
      bssid,
      latrange1,
      latrange2,
      longrange1,
      longrange2,
      country,
      region,
      city,
      resultsPerPage = 100,
      searchAfter,
    } = req.query;

    const shouldImport = req.body?.import === true;

    const params = new URLSearchParams();
    if (ssid) params.append('ssidlike', ssid as string);
    if (bssid) params.append('netid', bssid as string);
    if (latrange1) params.append('latrange1', latrange1 as string);
    if (latrange2) params.append('latrange2', latrange2 as string);
    if (longrange1) params.append('longrange1', longrange1 as string);
    if (longrange2) params.append('longrange2', longrange2 as string);
    if (country) params.append('country', country as string);
    if (region) params.append('region', region as string);
    if (city) params.append('city', city as string);
    params.append(
      'resultsPerPage',
      Math.min(parseInt(resultsPerPage as string) || 100, 1000).toString()
    );
    if (searchAfter) params.append('searchAfter', searchAfter as string);

    if (!ssid && !bssid && !latrange1 && !country && !region && !city) {
      return res.status(400).json({
        ok: false,
        error:
          'At least one search parameter required (ssid, bssid, latrange, country, region, or city)',
      });
    }

    const encodedAuth = Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');
    const apiUrl = `https://api.wigle.net/api/v2/network/search?${params.toString()}`;

    logger.info(`[WiGLE] Searching API: ${apiUrl.replace(/netid=[^&]+/, 'netid=***')}`);

    const response = await withRetry(
      () =>
        fetch(apiUrl, {
          headers: {
            Authorization: `Basic ${encodedAuth}`,
            Accept: 'application/json',
          },
        }),
      { serviceName: 'WiGLE Search API', timeoutMs: 30000, maxRetries: 2 }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[WiGLE] Search API error ${response.status}: ${errorText}`);
      return res.status(response.status).json({
        ok: false,
        error: 'WiGLE API request failed',
        status: response.status,
        details: errorText,
      });
    }

    const data = await response.json();
    const results = data.results || [];
    logger.info(
      `[WiGLE] Search returned ${results.length} results (total: ${data.totalResults || 'unknown'})`
    );

    let importedCount = 0;
    const importErrors: any[] = [];

    if (shouldImport && results.length > 0) {
      logger.info(`[WiGLE] Importing ${results.length} results to database...`);

      for (const network of results) {
        try {
          const rowCount = await wigleService.importWigleV2SearchResult(network);
          if (rowCount > 0) {
            importedCount++;
          }
        } catch (err: any) {
          logger.error(`[WiGLE] Import error for ${network.netid}: ${err.message}`);
          importErrors.push({ bssid: network.netid, error: err.message });
        }
      }

      logger.info(`[WiGLE] Import complete: ${importedCount}/${results.length} networks imported`);
    }

    res.json({
      ok: true,
      success: data.success,
      totalResults: data.totalResults,
      search_after: data.search_after,
      resultCount: results.length,
      results,
      imported: shouldImport,
      importedCount,
      importErrors: importErrors.length > 0 ? importErrors : undefined,
    });
  } catch (err: any) {
    logger.error(`[WiGLE] Search error: ${err.message}`, { error: err });
    next(err);
  }
});

export default router;
