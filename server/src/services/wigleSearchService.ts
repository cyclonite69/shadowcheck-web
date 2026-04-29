/**
 * WiGLE Search Service
 * Orchestrates credential resolution, API fetch, cursor computation, and optional import.
 */

import logger from '../logging/logger';
import secretsManager from './secretsManager';
import { buildSearchParams, DEFAULT_RESULTS_PER_PAGE } from './wigleImport/params';
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

  const encodedAuth = Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');
  const apiVer: 'v2' | 'v3' = query.version === 'v3' ? 'v3' : 'v2';
  const searchAfter = query.searchAfter ? String(query.searchAfter) : null;
  const resultsPerPage = parseInt(String(query.resultsPerPage || DEFAULT_RESULTS_PER_PAGE), 10);
  const params = buildSearchParams(query, searchAfter, apiVer);

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

  const nextSearchAfter = computeNextCursor(apiVer, data, results, resultsPerPage, searchAfter);

  let importedCount = 0;
  let importErrors: Array<{ bssid: string; error: string }> = [];

  if (shouldImport && results.length > 0) {
    logger.info(`[WiGLE] Importing ${results.length} results to database...`);
    ({ importedCount, importErrors } = await importSearchResults(results));
    logger.info(`[WiGLE] Import complete: ${importedCount}/${results.length} networks imported`);
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
