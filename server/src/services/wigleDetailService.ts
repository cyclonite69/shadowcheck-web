/**
 * WiGLE Detail Service
 * Orchestrates cache lookup, dedup check, upstream API fetch, and v3 import.
 */

import logger from '../logging/logger';
import secretsManager from './secretsManager';
import { fetchWigle } from './wigleClient';
import { hashRecord } from './wigleRequestUtils';
import { logWigleAuditEvent } from './wigleAuditLogger';
import {
  stripNullBytes,
  stripNullBytesDeep,
  mapCachedDetailToApiShape,
} from './wigleDetailTransforms';

const { wigleService } = require('../config/container');

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

async function fetchUpstream(
  netid: string,
  endpoint: string
): Promise<{ ok: true; data: any } | DetailError> {
  const wigleApiName = secretsManager.get('wigle_api_name');
  const wigleApiToken = secretsManager.get('wigle_api_token');

  if (!wigleApiName || !wigleApiToken) {
    return { ok: false, status: 503, error: 'WiGLE API credentials not configured' };
  }

  const encodedAuth = Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');
  // MAC addresses only contain hex digits and colons — both URL-safe in path segments.
  // encodeURIComponent turns ':' into '%3A' which breaks WiGLE's btNetworkId regex.
  const apiUrl = `https://api.wigle.net/api/v3/detail/${endpoint}/${netid}`;

  logger.info(`[WiGLE] Fetching ${endpoint} detail for: ${netid}`);

  const response = await fetchWigle({
    kind: 'detail',
    url: apiUrl,
    timeoutMs: 15000,
    maxRetries: 1,
    label: 'WiGLE Detail API',
    entrypoint: 'manual-detail',
    paramsHash: hashRecord({ endpoint, netid }),
    endpointType: `v3/detail/${endpoint}`,
    init: {
      headers: {
        Authorization: `Basic ${encodedAuth}`,
        Accept: 'application/json',
      },
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`[WiGLE] Detail API error ${response.status}: ${errorText}`);
    return {
      ok: false,
      status: response.status,
      error: 'WiGLE Detail API request failed',
      details: errorText,
    };
  }

  const data = await response.json();
  return { ok: true, data };
}

async function importObservations(
  netid: string,
  locationClusters: any[]
): Promise<{ newCount: number; totalCount: number; failedCount: number }> {
  if (!Array.isArray(locationClusters)) return { newCount: 0, totalCount: 0, failedCount: 0 };

  let newCount = 0,
    totalCount = 0,
    failedCount = 0;

  for (const cluster of locationClusters) {
    if (!Array.isArray(cluster.locations)) continue;
    for (const loc of cluster.locations) {
      totalCount++;
      try {
        const ssidToUse =
          loc.ssid && loc.ssid !== '?' && loc.ssid !== ''
            ? loc.ssid
            : cluster.clusterSsid || loc.ssid;
        const inserted = await wigleService.importWigleV3Observation(
          netid,
          loc,
          stripNullBytes(ssidToUse)
        );
        newCount += inserted;
      } catch (err: any) {
        failedCount++;
        logger.error(`[WiGLE] Failed to import observation for ${netid}: ${err.message}`);
      }
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
  shouldImport: boolean
): Promise<DetailResult | DetailError> {
  const recentImportHours = Math.max(1, Number(process.env.WIGLE_DETAIL_IMPORT_DEDUPE_HOURS || 24));

  // Cache-only path (no import requested)
  if (!shouldImport) {
    const cached = await wigleService.getWigleDetail(netid);
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
    const recentImport = await wigleService.getRecentWigleDetailImport(netid, recentImportHours);
    if (recentImport) {
      const snapshot = await wigleService.getWigleObservations(netid, 1, 0);
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
  const upstream = await fetchUpstream(netid, endpoint);
  if (!upstream.ok) return upstream;

  const { data } = upstream;
  let newObservations = 0,
    totalObservations = 0,
    attemptedObservations = 0,
    failedObservations = 0;

  if (shouldImport && data.networkId) {
    logger.info(`[WiGLE] Importing detail for ${netid} to database...`);

    await wigleService.importWigleV3NetworkDetail({
      netid: data.networkId,
      name: stripNullBytes(data.name),
      type: data.type,
      comment: stripNullBytes(data.comment),
      ssid: stripNullBytes(data.locationClusters?.[0]?.clusterSsid || data.name),
      trilat: data.trilateratedLatitude,
      trilon: data.trilateratedLongitude,
      encryption: stripNullBytes(data.encryption),
      channel: data.channel,
      bcninterval: data.bcninterval,
      freenet: stripNullBytes(data.freenet),
      dhcp: stripNullBytes(data.dhcp),
      paynet: stripNullBytes(data.paynet),
      qos: data.bestClusterWiGLEQoS,
      first_seen: data.firstSeen,
      last_seen: data.lastSeen,
      last_update: data.lastUpdate,
      street_address: JSON.stringify(data.streetAddress),
      location_clusters: JSON.stringify(data.locationClusters),
    });

    const counts = await importObservations(data.networkId, data.locationClusters);
    newObservations = counts.newCount;
    attemptedObservations = counts.totalCount;
    failedObservations = counts.failedCount;
    const snapshot = await wigleService.getWigleObservations(data.networkId, 1, 0);
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

  await wigleService.importWigleV3NetworkDetail({
    netid: data.networkId,
    name: stripNullBytes(data.name),
    type: data.type,
    comment: stripNullBytes(data.comment),
    ssid: stripNullBytes(data.locationClusters?.[0]?.clusterSsid || data.name),
    trilat: data.trilateratedLatitude,
    trilon: data.trilateratedLongitude,
    encryption: stripNullBytes(data.encryption),
    channel: data.channel,
    bcninterval: data.bcninterval,
    freenet: stripNullBytes(data.freenet),
    dhcp: stripNullBytes(data.dhcp),
    paynet: stripNullBytes(data.paynet),
    qos: data.bestClusterWiGLEQoS,
    first_seen: data.firstSeen,
    last_seen: data.lastSeen,
    last_update: data.lastUpdate,
    street_address: JSON.stringify(data.streetAddress),
    location_clusters: JSON.stringify(data.locationClusters),
  });

  const counts = await importObservations(data.networkId, data.locationClusters);
  const snapshot = await wigleService.getWigleObservations(data.networkId, 1, 0);

  logger.info(
    `[WiGLE] Imported ${counts.newCount} new observations (${snapshot.total} total, ${counts.totalCount} attempted, ${counts.failedCount} failed) for ${data.networkId}`
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
