/**
 * WiGLE Search Service
 * Orchestrates credential resolution, API fetch, cursor computation, and optional import.
 */

import logger from '../logging/logger';
import secretsManager from './secretsManager';
import { getEncodedWigleAuth } from './wigleRequestUtils';
import { buildSearchParams } from './wigleImport/params';
import { fetchWigleSearchPage } from './wigleSearchApiService';
import { computeNextCursor, importSearchResults } from './wigleSearchTransforms';

export interface SearchResult {
  ok: true;
  success: any;
  totalResults: any;
  search_after: string | null;
  resultCount: number;
  results: any[];
  imported: boolean;
  importedCount: number;
  importErrors?: Array<{ bssid: string; error: string }>;
}

export interface SearchError {
  ok: false;
  error: string;
  status: number;
  details?: string;
}

/**
 * Convert URLSearchParams to a plain object for JSON serialization.
 */
function urlSearchParamsToObject(params: URLSearchParams): Record<string, any> {
  const obj: Record<string, any> = {};
  params.forEach((value, key) => {
    if (obj[key]) {
      if (Array.isArray(obj[key])) {
        obj[key].push(value);
      } else {
        obj[key] = [obj[key], value];
      }
    } else {
      obj[key] = value;
    }
  });
  return obj;
}

/**
 * Execute a WiGLE search and optionally import results into the local DB.
 */
export async function searchWigle(
  query: Record<string, any>,
  shouldImport: boolean
): Promise<SearchResult | SearchError> {
  const wigleApiName = secretsManager.get('wigle_api_name');
  const wigleApiToken = secretsManager.get('wigle_api_token');

  if (!wigleApiName || !wigleApiToken) {
    return {
      ok: false,
      status: 503,
      error:
        'WiGLE API credentials not configured. Set wigle_api_name and wigle_api_token secrets.',
    };
  }

  const encodedAuth = getEncodedWigleAuth();
  // WiGLE v3 network search does not exist — v2 only per spec
  // If user requests v3 network search, log warning and force to v2
  if (query.version === 'v3') {
    logger.warn(
      '[WiGLE] User requested WiGLE v3 network search which is not supported; downgrading to v2'
    );
  }
  const apiVer: 'v2' = 'v2';
  const searchAfter = query.searchAfter ? String(query.searchAfter) : null;
  const params = buildSearchParams(query, searchAfter);

  let data: any;
  try {
    data = await fetchWigleSearchPage({ encodedAuth, apiVer, params, entrypoint: 'manual-search' });
  } catch (error: any) {
    logger.error(
      `[WiGLE] Search API error ${error.status || 500}: ${error.details || error.message}`
    );
    return {
      ok: false,
      status: error.status || 500,
      error: 'WiGLE API request failed',
      details: error.details || error.message,
    };
  }

  const results = data.results || [];
  logger.info(
    `[WiGLE] Search returned ${results.length} results (total: ${data.totalResults || 'unknown'})`
  );

  const nextSearchAfter = computeNextCursor(apiVer, data.search_after ?? null);

  let importedCount = 0;
  let importErrors: Array<{ bssid: string; error: string }> = [];
  let runId: number | null = null;

  if (shouldImport && results.length > 0) {
    logger.info(`[WiGLE] Importing ${results.length} results to database...`);

    // Create a wigle_import_runs record to track this quick search + import
    // Store the exact API params sent to WiGLE
    const requestParams = urlSearchParamsToObject(params);
    const searchTerm = query.ssid || query.bssid || query.city || query.country || '';

    const { query: dbQuery } = require('../config/database');
    const runResult = await dbQuery(
      `INSERT INTO app.wigle_import_runs (
        source,
        api_version,
        search_term,
        state,
        request_params,
        status,
        page_size,
        started_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, now())
      RETURNING id`,
      [
        'wigle_v2',
        'v2',
        searchTerm,
        query.region || null,
        JSON.stringify(requestParams),
        'running',
        query.resultsPerPage || 100,
      ]
    );

    if (runResult.rows && runResult.rows.length > 0) {
      runId = runResult.rows[0].id;
    }

    try {
      ({ importedCount, importErrors } = await importSearchResults(results));
      logger.info(`[WiGLE] Import complete: ${importedCount}/${results.length} networks imported`);

      // Mark run as completed
      if (runId) {
        await dbQuery(
          `UPDATE app.wigle_import_runs
           SET status = $1,
               rows_inserted = $2,
               rows_returned = $3,
               pages_fetched = 1,
               total_pages = 1,
               api_total_results = $4,
               completed_at = now()
           WHERE id = $5`,
          [
            importErrors.length === 0 ? 'completed' : 'completed_with_errors',
            importedCount,
            results.length,
            data.totalResults || results.length,
            runId,
          ]
        );
      }
    } catch (importError: any) {
      // Mark run as failed if import fails
      if (runId) {
        await dbQuery(
          `UPDATE app.wigle_import_runs
           SET status = $1, last_error = $2, completed_at = now() WHERE id = $3`,
          ['failed', importError.message, runId]
        );
      }
      throw importError;
    }
  }

  return {
    ok: true,
    success: data.success,
    totalResults: data.totalResults,
    search_after: nextSearchAfter,
    resultCount: results.length,
    results,
    imported: shouldImport,
    importedCount,
    importErrors: importErrors.length > 0 ? importErrors : undefined,
  };
}

const { query: dbQuery } = require('../config/database');

/**
 * Fetch all saved SSID search terms, most-recently-used first.
 */
export async function getSavedSsidTerms(): Promise<any[]> {
  const { rows } = await dbQuery(
    'SELECT id, term, last_used_at FROM app.wigle_saved_ssid_terms ORDER BY last_used_at DESC, term ASC'
  );
  return rows;
}

/**
 * Insert or update a saved SSID term. Returns the upserted row.
 */
export async function upsertSavedSsidTerm(raw: string): Promise<any> {
  const normalized = raw.toLowerCase();
  const { rows } = await dbQuery(
    `INSERT INTO app.wigle_saved_ssid_terms (term, term_normalized)
     VALUES ($1, $2)
     ON CONFLICT (term_normalized)
     DO UPDATE SET last_used_at = now(), term = EXCLUDED.term
     RETURNING id, term, last_used_at`,
    [raw, normalized]
  );
  return rows[0];
}

/**
 * Delete a saved SSID term by id. Returns true if a row was deleted.
 */
export async function deleteSavedSsidTerm(id: number): Promise<boolean> {
  const result = await dbQuery(
    'DELETE FROM app.wigle_saved_ssid_terms WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rowCount > 0;
}
