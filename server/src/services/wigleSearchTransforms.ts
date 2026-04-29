/**
 * WiGLE Search — Pure Transform Utilities
 * Stateless helpers for cursor computation, result importing, and run response shaping.
 */

import * as container from '../config/container';
import logger from '../logging/logger';

const { wigleService } = container as any;

/** Shape a completed/in-progress import run into the standard search response envelope. */
export function buildRunImportResponse(run: any) {
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
 * Compute the next-page cursor from a search response.
 * v3: WiGLE returns search_after directly.
 * v2: offset-based — synthesise a numeric cursor for uniform client pagination.
 */
export function computeNextCursor(
  apiVer: 'v2' | 'v3',
  data: any,
  results: any[],
  resultsPerPage: number,
  currentSearchAfter: string | null
): string | null {
  if (apiVer === 'v3') return data.search_after ?? null;

  const currentOffset =
    currentSearchAfter && /^\d+$/.test(currentSearchAfter) ? parseInt(currentSearchAfter, 10) : 0;
  return results.length >= resultsPerPage ? String(currentOffset + results.length) : null;
}

/** Import a page of v2 search results into the local DB. */
export async function importSearchResults(results: any[]): Promise<{
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
