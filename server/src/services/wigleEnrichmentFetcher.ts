/**
 * WiGLE Enrichment Fetcher
 * Single-item v3 detail fetch and import for the batch enrichment pipeline.
 * Delegates to fetchOrImportDetail — same path as manual WiGLE detail import.
 */

import { inferWigleEndpoint } from './wigleDetailTransforms';
import { fetchOrImportDetail } from './wigleDetailService';
import { normalizeMacAddress } from './wigleEnrichment/mappers/enrichmentMapper';

/**
 * Fetch v3 detail for a single BSSID from the WiGLE API and import it into the DB.
 * Returns null only when the network was not found (404).
 * Throws on API errors, credential issues, or a successful response without a network ID.
 */
export async function fetchAndImportDetail(
  bssid: string,
  type: string
): Promise<{ bssid: string; obsCount: number } | null> {
  const netid = normalizeMacAddress(bssid);
  if (!netid) {
    throw new Error(`Invalid BSSID: ${bssid}`);
  }

  const endpoint = inferWigleEndpoint(type);
  const result = await fetchOrImportDetail(netid, endpoint, true, 'enrichment');

  if (!result.ok) {
    if (result.status === 404) {
      return null;
    }
    throw Object.assign(new Error(result.error || `WiGLE API failed (${result.status})`), {
      status: result.status,
    });
  }

  if (!result.data?.networkId && !result.cached && !result.deduplicated) {
    throw new Error(`WiGLE detail response missing networkId for ${netid}`);
  }

  return {
    bssid: netid,
    obsCount: result.importedObservations ?? 0,
  };
}
