/**
 * WiGLE Search API Routes
 * Live WiGLE API search with optional import
 */

import express from 'express';
const router = express.Router();
const { wigleService } = require('../../../../config/container');
const { wigleImportRunService } = require('../../../../config/container');
import secretsManager from '../../../../services/secretsManager';
import logger from '../../../../logging/logger';
import { requireAdmin } from '../../../../middleware/authMiddleware';
import { withRetry } from '../../../../services/externalServiceHandler';
import {
  buildSearchParams,
  validateImportQuery as validateSearchQuery,
  DEFAULT_RESULTS_PER_PAGE,
} from '../../../../services/wigleImport/params';

async function fetchWiglePage(
  encodedAuth: string,
  apiVer: 'v2' | 'v3',
  params: URLSearchParams
): Promise<any> {
  const apiUrl = `https://api.wigle.net/api/${apiVer}/network/search?${params.toString()}`;

  logger.info(`[WiGLE] Searching API (${apiVer}): ${apiUrl.replace(/netid=[^&]+/, 'netid=***')}`);

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
    const error: any = new Error(`WiGLE API request failed with status ${response.status}`);
    error.status = response.status;
    error.details = errorText;
    throw error;
  }

  return response.json();
}

async function importSearchResults(results: any[]): Promise<{
  importedCount: number;
  importErrors: Array<{ bssid: string; error: string }>;
}> {
  let importedCount = 0;
  const importErrors: Array<{ bssid: string; error: string }> = [];

  for (const network of results) {
    try {
      const rowCount = await wigleService.importWigleV2SearchResult(network);
      if (rowCount > 0) importedCount++;
    } catch (err: any) {
      const bssid = network.netid || network.bssid;
      logger.error(`[WiGLE] Import error for ${bssid}: ${err.message}`);
      importErrors.push({ bssid, error: err.message });
    }
  }

  return { importedCount, importErrors };
}

function buildRunImportResponse(run: any) {
  return {
    ok: true,
    imported: true,
    totalResults: run.apiTotalResults,
    loadedCount: run.rowsReturned,
    resultCount: run.rowsReturned,
    importedCount: run.rowsInserted,
    pagesProcessed: run.pagesFetched,
    totalPages: run.totalPages,
    hasMore: run.status === 'running' || run.status === 'paused' || run.status === 'failed',
    searchAfter: run.apiCursor,
    results: [],
    run,
  };
}

/**
 * POST/GET /search-api - Search WiGLE API with optional import
 */
router.all('/search-api', requireAdmin, async (req, res, next) => {
  try {
    // Only allow GET and POST
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const wigleApiName = secretsManager.get('wigle_api_name');
    const wigleApiToken = secretsManager.get('wigle_api_token');

    if (!wigleApiName || !wigleApiToken) {
      return res.status(503).json({
        ok: false,
        error:
          'WiGLE API credentials not configured. Set wigle_api_name and wigle_api_token secrets.',
      });
    }

    const { version = 'v2' } = req.query;

    // Support 'import' from body (POST) or query (GET)
    const shouldImport = req.body?.import === true || req.query?.import === 'true';

    const validationError = validateSearchQuery(req.query);
    if (validationError) {
      return res.status(400).json({
        ok: false,
        error: validationError,
      });
    }

    const encodedAuth = Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');
    const searchAfter = req.query.searchAfter ? String(req.query.searchAfter) : null;

    // Select API version first so we can pass it to buildSearchParams
    const apiVer = version === 'v3' ? 'v3' : 'v2';
    const resultsPerPage = parseInt(
      String(req.query.resultsPerPage || DEFAULT_RESULTS_PER_PAGE),
      10
    );
    const params = buildSearchParams(req.query as any, searchAfter, apiVer);

    let data;
    try {
      data = await fetchWiglePage(encodedAuth, apiVer, params);
    } catch (error: any) {
      logger.error(
        `[WiGLE] Search API error ${error.status || 500}: ${error.details || error.message}`
      );
      return res.status(error.status || 500).json({
        ok: false,
        error: 'WiGLE API request failed',
        status: error.status,
        details: error.details || error.message,
      });
    }
    const results = data.results || [];
    logger.info(
      `[WiGLE] Search returned ${results.length} results (total: ${data.totalResults || 'unknown'})`
    );

    // Compute the next-page cursor.
    // v3: WiGLE returns search_after directly.
    // v2: WiGLE uses offset pagination (first=N). We synthesise a numeric cursor so
    //     the client can drive infinite scroll the same way for both versions.
    let nextSearchAfter: string | null = null;
    if (apiVer === 'v3') {
      nextSearchAfter = data.search_after ?? null;
    } else {
      const currentOffset =
        searchAfter && /^\d+$/.test(searchAfter) ? parseInt(searchAfter, 10) : 0;
      if (results.length >= resultsPerPage) {
        nextSearchAfter = String(currentOffset + results.length);
      }
    }

    let importedCount = 0;
    let importErrors: Array<{ bssid: string; error: string }> = [];

    if (shouldImport && results.length > 0) {
      logger.info(`[WiGLE] Importing ${results.length} results to database...`);
      const importResult = await importSearchResults(results);
      importedCount = importResult.importedCount;
      importErrors = importResult.importErrors;

      logger.info(`[WiGLE] Import complete: ${importedCount}/${results.length} networks imported`);
    }

    res.json({
      ok: true,
      success: data.success,
      totalResults: data.totalResults,
      search_after: nextSearchAfter,
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

router.post('/search-api/import-all', requireAdmin, async (req, res, next) => {
  try {
    const query = { ...req.query, ...req.body };
    const validationError = wigleImportRunService.validateImportQuery(query);
    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
    }

    const runId =
      query.runId !== undefined && query.runId !== null
        ? Number.parseInt(String(query.runId), 10)
        : null;
    const resumeLatest = query.resumeLatest === true || query.resumeLatest === 'true';

    const run = runId
      ? await wigleImportRunService.resumeImportRun(runId)
      : resumeLatest
        ? await wigleImportRunService.resumeLatestImportRun(query)
        : await wigleImportRunService.startImportRun(query);

    return res.json(buildRunImportResponse(run));
  } catch (err: any) {
    logger.error(`[WiGLE] Import-all error: ${err.message}`, { error: err });
    next(err);
  }
});

router.get('/search-api/import-runs', requireAdmin, async (req, res, next) => {
  try {
    const runs = await wigleImportRunService.listImportRuns({
      limit: req.query.limit ? Number.parseInt(String(req.query.limit), 10) : 20,
      status: req.query.status ? String(req.query.status) : undefined,
      state: req.query.state ? String(req.query.state) : undefined,
      searchTerm: req.query.searchTerm ? String(req.query.searchTerm) : undefined,
      incompleteOnly: req.query.incompleteOnly === 'true',
    });
    return res.json({ ok: true, runs });
  } catch (err: any) {
    logger.error(`[WiGLE] Import-runs list error: ${err.message}`, { error: err });
    next(err);
  }
});

router.get('/search-api/import-runs/completeness/summary', requireAdmin, async (req, res, next) => {
  try {
    const report = await wigleImportRunService.getImportCompletenessReport({
      searchTerm: req.query.searchTerm ? String(req.query.searchTerm) : undefined,
      state: req.query.state ? String(req.query.state).toUpperCase() : undefined,
    });
    return res.json({ ok: true, report });
  } catch (err: any) {
    logger.error(`[WiGLE] Completeness report error: ${err.message}`, { error: err });
    next(err);
  }
});

router.get('/search-api/import-runs/:id', requireAdmin, async (req, res, next) => {
  try {
    const runId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(runId)) {
      return res.status(400).json({ ok: false, error: 'Invalid run id' });
    }
    const run = await wigleImportRunService.getImportRun(runId);
    return res.json({ ok: true, run });
  } catch (err: any) {
    logger.error(`[WiGLE] Import-run status error: ${err.message}`, { error: err });
    next(err);
  }
});

router.post('/search-api/import-runs/resume-latest', requireAdmin, async (req, res, next) => {
  try {
    const query = { ...req.query, ...req.body };
    const validationError = wigleImportRunService.validateImportQuery(query);
    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
    }
    const run = await wigleImportRunService.resumeLatestImportRun(query);
    return res.json(buildRunImportResponse(run));
  } catch (err: any) {
    logger.error(`[WiGLE] Resume-latest error: ${err.message}`, { error: err });
    next(err);
  }
});

router.get('/search-api/import-runs/resumable/latest', requireAdmin, async (req, res, next) => {
  try {
    const query = { ...req.query, ...req.body };
    const validationError = wigleImportRunService.validateImportQuery(query);
    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
    }
    const run = await wigleImportRunService.getLatestResumableImportRun(query);
    return res.json({ ok: true, run });
  } catch (err: any) {
    logger.error(`[WiGLE] Latest resumable error: ${err.message}`, { error: err });
    next(err);
  }
});

router.post('/search-api/import-runs/:id/resume', requireAdmin, async (req, res, next) => {
  try {
    const runId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(runId)) {
      return res.status(400).json({ ok: false, error: 'Invalid run id' });
    }
    const run = await wigleImportRunService.resumeImportRun(runId);
    return res.json(buildRunImportResponse(run));
  } catch (err: any) {
    logger.error(`[WiGLE] Resume run error: ${err.message}`, { error: err });
    next(err);
  }
});

router.post('/search-api/import-runs/:id/pause', requireAdmin, async (req, res, next) => {
  try {
    const runId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(runId)) {
      return res.status(400).json({ ok: false, error: 'Invalid run id' });
    }
    const run = await wigleImportRunService.pauseImportRun(runId);
    return res.json({ ok: true, run });
  } catch (err: any) {
    logger.error(`[WiGLE] Pause run error: ${err.message}`, { error: err });
    next(err);
  }
});

router.post('/search-api/import-runs/:id/cancel', requireAdmin, async (req, res, next) => {
  try {
    const runId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(runId)) {
      return res.status(400).json({ ok: false, error: 'Invalid run id' });
    }
    const run = await wigleImportRunService.cancelImportRun(runId);
    return res.json({ ok: true, run });
  } catch (err: any) {
    logger.error(`[WiGLE] Cancel run error: ${err.message}`, { error: err });
    next(err);
  }
});

export default router;
