/**
 * WiGLE Detail Service
 * Orchestrates cache lookup, dedup check, upstream API fetch, and v3 import.
 */

import logger from '../logging/logger';
import secretsManager from './secretsManager';
import { wigleGatewayFetch } from './wigle/wigleGateway';
import { hashRecord, getEncodedWigleAuth } from './wigleRequestUtils';
import { logWigleAuditEvent } from './wigleAuditLogger';
import {
  stripNullBytes,
  stripNullBytesDeep,
  mapCachedDetailToApiShape,
} from './wigleDetailTransforms';
import { getRecentWigleDetailImport, getWigleObservations } from './wigle/database';
import { getWigleDetail } from './wigle/detail';
import {
  mapV3ApiDetailObservationRows,
  mapV3ApiDetailToNetworkDetail,
} from './wigleEnrichment/mappers/enrichmentMapper';
import { importWigleV3NetworkDetail, importWigleV3ObservationRow } from './wigle/persistence';

export interface DetailResult {
  ok: true;
  data: any;
  imported: boolean;
  cached: boolean;
  deduplicated?: boolean;
  importedObservations: number;
  totalObservations: number;
  attemptedObservations: number;
  failedObservations: number;
}

export interface DetailError {
  ok: false;
  error: string;
  status: number;
  details?: string;
}

/**
 * Check if a MAC address (BSSID) is locally administered (randomized).
 * The 2nd hex digit of the first octet will be 2, 3, 6, 7, A, B, E, or F.
 */
export function isLocallyAdministeredMac(mac: string): boolean {
  const clean = mac.replace(/[^0-9A-Fa-f]/g, '');
  if (clean.length < 2) {
    return false;
  }
  const firstByte = parseInt(clean.substring(0, 2), 16);
  return (firstByte & 0x02) !== 0;
}

/**
 * Fetch raw WiGLE v3 detail response without importing.
 * Returns { ok: true, data } on success or { ok: false, status, error } on failure.
 */
export async function fetchUpstream(
  netid: string,
  endpoint: string,
  query_source = 'manual'
): Promise<{ ok: true; data: any } | DetailError> {
  const wigleApiName = secretsManager.get('wigle_api_name');
  const wigleApiToken = secretsManager.get('wigle_api_token');

  if (!wigleApiName || !wigleApiToken) {
    return { ok: false, status: 503, error: 'WiGLE API credentials not configured' };
  }

  if (isLocallyAdministeredMac(netid)) {
    logger.info(
      `[WiGLE][v3/detail/${endpoint}][404] Skipping upstream call for locally-administered/randomized MAC: ${netid}`
    );
    return {
      ok: false,
      status: 404,
      error:
        'Network not found in WiGLE. This is expected for randomized or locally-administered MAC addresses.',
    };
  }

  const encodedAuth = getEncodedWigleAuth();
  // MAC addresses only contain hex digits and colons — both URL-safe in path segments.
  // encodeURIComponent turns ':' into '%3A' which breaks WiGLE's btNetworkId regex.
  const apiUrl = `https://api.wigle.net/api/v3/detail/${endpoint}/${netid}`;

  logger.info(
    `[WiGLE][v3/detail/${endpoint}][PRE] sending request | url=${apiUrl} | params=${JSON.stringify({
      netid,
      endpoint,
    })}`
  );

  const gatewayResult = await wigleGatewayFetch({
    kind: 'detail',
    url: apiUrl,
    timeoutMs: 15000,
    maxRetries: 1,
    label: 'WiGLE Detail API',
    entrypoint: 'manual-detail',
    endpointType: `v3/detail/${endpoint}`,
    query_source,
    init: {
      headers: {
        Authorization: `Basic ${encodedAuth}`,
        Accept: 'application/json',
      },
    },
  });
  if (!gatewayResult.ok) {
    const status = gatewayResult.status ?? 500;
    logger.error(
      `[WiGLE][v3/detail/${endpoint}][ERROR] Detail fetch exception: ${gatewayResult.error}`,
      {
        url: apiUrl,
        netid,
        endpoint,
      }
    );
    return { ok: false, status, error: gatewayResult.error };
  }
  const response = gatewayResult.response;

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 404) {
      logger.info(
        `[WiGLE][v3/detail/${endpoint}][404] Network not found (likely randomized/local MAC)`,
        {
          netid,
        }
      );
      return {
        ok: false,
        status: 404,
        error:
          'Network not found in WiGLE. This is expected for randomized or locally-administered MAC addresses.',
      };
    }
    logger.error(
      `[WiGLE][v3/detail/${endpoint}][${response.status}] request failed | url=${apiUrl} | params=${JSON.stringify(
        { netid, endpoint }
      )} | body=${errorText.substring(0, 500)}`
    );
    return {
      ok: false,
      status: response.status,
      error: 'WiGLE Detail API request failed',
      details: errorText,
    };
  }

  const data: any = await response.json();
  const clusterCount = Array.isArray(data?.locationClusters) ? data.locationClusters.length : null;
  logger.info(
    `[WiGLE][v3/detail/${endpoint}][${response.status}] request succeeded | url=${apiUrl} | params=${JSON.stringify(
      { netid, endpoint }
    )}${clusterCount !== null ? ` | clusters=${clusterCount}` : ''}`
  );
  return { ok: true, data };
}

/** Import v3 observation points from locationClusters into the local DB. */
export async function importObservations(
  netid: string,
  locationClusters: any[]
): Promise<{ newCount: number; totalCount: number; failedCount: number }> {
  if (!Array.isArray(locationClusters)) {
    return { newCount: 0, totalCount: 0, failedCount: 0 };
  }

  let newCount = 0,
    totalCount = 0,
    failedCount = 0;

  const observationRows = mapV3ApiDetailObservationRows(netid, locationClusters);
  for (const row of observationRows) {
    totalCount++;
    try {
      const inserted = await importWigleV3ObservationRow(row);
      newCount += inserted;
    } catch (err: any) {
      failedCount++;
      logger.error(`[WiGLE] Failed to import observation for ${netid}: ${err.message}`);
    }
  }

  return { newCount, totalCount, failedCount };
}

/**
 * Fetch or import a WiGLE v3 network detail record.
 * Handles cache hit, dedup, upstream fetch, and DB import in one call.
 */
export async function fetchOrImportDetail(
  netid: string,
  endpoint: string,
  shouldImport: boolean,
  query_source = 'manual'
): Promise<DetailResult | DetailError> {
  const recentImportHours = Math.max(1, Number(process.env.WIGLE_DETAIL_IMPORT_DEDUPE_HOURS || 24));

  // Cache-only path (no import requested)
  if (!shouldImport) {
    const cached = await getWigleDetail(netid);
    if (cached) {
      logger.info(`[WiGLE] Serving cached ${endpoint} detail for: ${netid}`);
      return {
        ok: true,
        data: stripNullBytesDeep(mapCachedDetailToApiShape(cached)),
        imported: false,
        cached: true,
        importedObservations: 0,
        totalObservations: 0,
        attemptedObservations: 0,
        failedObservations: 0,
      };
    }
  }

  // Dedup check for import path
  if (shouldImport) {
    const recentImport = await getRecentWigleDetailImport(netid, recentImportHours);
    if (recentImport) {
      const snapshot = await getWigleObservations(netid, 1, 0);
      logger.info('[WiGLE] Skipping upstream detail call — recent import exists', {
        endpoint,
        netid,
        recentImportHours,
      });
      logWigleAuditEvent({
        entrypoint: 'manual-detail-import',
        endpointType: `v3/detail/${endpoint}`,
        paramsHash: hashRecord({ endpoint, netid }),
        status: 'CACHE_HIT',
        latencyMs: 0,
        servedFromCache: true,
        retryCount: 0,
        kind: 'detail',
      });
      return {
        ok: true,
        data: stripNullBytesDeep(mapCachedDetailToApiShape(recentImport)),
        imported: false,
        cached: true,
        deduplicated: true,
        importedObservations: 0,
        totalObservations: snapshot.total,
        attemptedObservations: 0,
        failedObservations: 0,
      };
    }
  }

  // Upstream fetch
  const upstream = await fetchUpstream(netid, endpoint, query_source);
  if (!upstream.ok) {
    return upstream;
  }

  const { data } = upstream;
  let newObservations = 0,
    totalObservations = 0,
    attemptedObservations = 0,
    failedObservations = 0;

  if (shouldImport && data.networkId) {
    logger.info(`[WiGLE] Importing detail for ${netid} to database...`);

    const networkDetail = mapV3ApiDetailToNetworkDetail(data);
    await importWigleV3NetworkDetail(networkDetail);

    const counts = await importObservations(networkDetail.netid, data.locationClusters);
    newObservations = counts.newCount;
    attemptedObservations = counts.totalCount;
    failedObservations = counts.failedCount;
    const snapshot = await getWigleObservations(data.networkId, 1, 0);
    totalObservations = snapshot.total;

    logger.info(
      `[WiGLE] Imported ${newObservations} new observations (${totalObservations} total, ${attemptedObservations} attempted, ${failedObservations} failed) for ${netid}`
    );
  }

  return {
    ok: true,
    data: stripNullBytesDeep(data),
    imported: shouldImport,
    cached: false,
    importedObservations: newObservations,
    totalObservations,
    attemptedObservations,
    failedObservations,
  };
}

/**
 * Import a WiGLE v3 detail record from a pre-parsed JSON object (file upload path).
 */
export async function importDetailFromJson(
  data: any
): Promise<Omit<DetailResult, 'imported' | 'cached'>> {
  logger.info(`[WiGLE] Importing v3 detail for ${data.networkId} from file...`);

  const networkDetail = mapV3ApiDetailToNetworkDetail(data);
  await importWigleV3NetworkDetail(networkDetail);

  const counts = await importObservations(networkDetail.netid, data.locationClusters);
  const snapshot = await getWigleObservations(networkDetail.netid, 1, 0);

  logger.info(
    `[WiGLE] Imported ${counts.newCount} new observations (${snapshot.total} total, ${counts.totalCount} attempted, ${counts.failedCount} failed) for ${networkDetail.netid}`
  );

  return {
    ok: true,
    data: stripNullBytesDeep(data),
    importedObservations: counts.newCount,
    totalObservations: snapshot.total,
    attemptedObservations: counts.totalCount,
    failedObservations: counts.failedCount,
  };
}
