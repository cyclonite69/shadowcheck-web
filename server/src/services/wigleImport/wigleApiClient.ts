import logger from '../../logging/logger';
import { buildSearchParams, type WigleImportParams } from './params';
import { fetchWigleSearchPage } from '../wigleSearchApiService';

/**
 * WiGLE API page response structure
 */
export interface WiglePageResponse {
  success?: boolean;
  totalResults?: number;
  search_after?: string | null;
  results?: any[];
}

/**
 * Fetch a single page from WiGLE API with built search parameters
 */
export const fetchWiglePage = async (
  encodedAuth: string,
  requestParams: WigleImportParams,
  searchAfter: string | null
): Promise<WiglePageResponse> => {
  const params = buildSearchParams(requestParams, searchAfter);
  logger.info('[WiGLE Import] Fetch page request', {
    searchAfter: searchAfter || null,
  });

  const data = await fetchWigleSearchPage({
    encodedAuth,
    apiVer: 'v2',
    params,
    entrypoint: 'import-run',
  });
  if (!data || typeof data !== 'object') {
    throw new Error('WiGLE API returned a malformed response');
  }
  return data;
};
