import type { Request, Response, NextFunction } from 'express';
/**
 * WiGLE Detail & Import Routes
 * WiGLE API detail lookups and file imports
 */

import express from 'express';
const router = express.Router();
const { wigleService } = require('../../../../config/container');
import secretsManager from '../../../../services/secretsManager';
import logger from '../../../../logging/logger';
import { requireAdmin } from '../../../../middleware/authMiddleware';
import { withRetry } from '../../../../services/externalServiceHandler';
const { asyncHandler } = require('../../../../utils/asyncHandler');

const stripNullBytes = (value: any): string | null => {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).replace(/\u0000/g, '');
  return cleaned === '' ? null : cleaned;
};

const stripNullBytesKeepEmpty = (value: any): any => {
  if (value === undefined || value === null) return value;
  return String(value).replace(/\u0000/g, '');
};

const stripNullBytesDeep = (value: any): any => {
  if (value === undefined || value === null) return value;
  if (typeof value === 'string') return stripNullBytesKeepEmpty(value);
  if (Array.isArray(value)) return value.map((item) => stripNullBytesDeep(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, stripNullBytesDeep(val)])
    );
  }
  return value;
};

const parseJsonObject = (value: any): any | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const parseJsonArray = (value: any): any[] | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

function mapCachedDetailToApiShape(cached: any): any {
  return {
    networkId: cached.netid,
    name: cached.name ?? cached.ssid ?? null,
    ssid: cached.ssid ?? cached.name ?? null,
    encryption: cached.encryption ?? null,
    type: cached.type ?? null,
    channel: cached.channel ?? null,
    firstSeen: cached.first_seen ?? null,
    lastSeen: cached.last_seen ?? null,
    lastUpdate: cached.last_observed_at ?? cached.last_seen ?? null,
    trilateratedLatitude: cached.trilat ?? cached.last_lat ?? null,
    trilateratedLongitude: cached.trilon ?? cached.last_lon ?? null,
    streetAddress: parseJsonObject(cached.street_address),
    locationClusters: parseJsonArray(cached.location_clusters),
    comment: cached.comment ?? null,
    bestClusterWiGLEQoS: cached.qos ?? null,
  };
}

async function importWigleV3Observations(
  netid: string,
  locationClusters: any[]
): Promise<{ newCount: number; totalCount: number; failedCount: number }> {
  if (!locationClusters || !Array.isArray(locationClusters)) {
    return { newCount: 0, totalCount: 0, failedCount: 0 };
  }

  let newCount = 0;
  let totalCount = 0;
  let failedCount = 0;
  for (const cluster of locationClusters) {
    if (!cluster.locations || !Array.isArray(cluster.locations)) continue;

    for (const loc of cluster.locations) {
      totalCount++;
      try {
        const ssidToUse =
          loc.ssid && loc.ssid !== '?' && loc.ssid !== ''
            ? loc.ssid
            : cluster.clusterSsid || loc.ssid;
        const sanitizedSsid = stripNullBytes(ssidToUse);

        const inserted = await wigleService.importWigleV3Observation(netid, loc, sanitizedSsid);
        newCount += inserted;
      } catch (err: any) {
        failedCount++;
        logger.error(`[WiGLE] Failed to import observation for ${netid}: ${err.message}`);
      }
    }
  }
  return { newCount, totalCount, failedCount };
}

async function fetchWigleDetail(netid: string, endpoint: string) {
  const wigleApiName = secretsManager.get('wigle_api_name');
  const wigleApiToken = secretsManager.get('wigle_api_token');

  if (!wigleApiName || !wigleApiToken) {
    return { ok: false, status: 503, error: 'WiGLE API credentials not configured' };
  }

  const encodedAuth = Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');
  // MAC addresses (XX:XX:XX:XX:XX:XX) only contain hex digits and colons, both
  // URL-safe in path segments. encodeURIComponent turns ':' into '%3A' which
  // causes WiGLE's btNetworkId regex validation to fail.
  const apiUrl = `https://api.wigle.net/api/v3/detail/${endpoint}/${netid}`;

  logger.info(`[WiGLE] Fetching ${endpoint} detail for: ${netid}`);

  const response = await withRetry(
    () =>
      fetch(apiUrl, {
        headers: {
          Authorization: `Basic ${encodedAuth}`,
          Accept: 'application/json',
        },
      }),
    { serviceName: 'WiGLE Detail API', timeoutMs: 15000, maxRetries: 2 }
  );

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

async function handleWigleDetailRequest(req: any, res: any, next: any, endpoint: string) {
  try {
    const netid = (req.params.netid || '').trim().toUpperCase();
    const shouldImport = req.body?.import === true;

    if (!shouldImport) {
      const cached = await wigleService.getWigleDetail(netid);
      if (cached) {
        logger.info(`[WiGLE] Serving cached ${endpoint} detail for: ${netid}`);
        return res.json({
          ok: true,
          data: stripNullBytesDeep(mapCachedDetailToApiShape(cached)),
          imported: false,
          cached: true,
          importedObservations: 0,
          totalObservations: 0,
          attemptedObservations: 0,
          failedObservations: 0,
        });
      }
    }

    const detailResponse = await fetchWigleDetail(netid, endpoint);

    if (!detailResponse.ok) {
      return res.status(detailResponse.status).json({
        ok: false,
        error: detailResponse.error,
        status: detailResponse.status,
        details: (detailResponse as any).details,
      });
    }

    const data = (detailResponse as any).data;
    const normalizedData = stripNullBytesDeep(data);
    let newObservations = 0;
    let totalObservations = 0;
    let attemptedObservations = 0;
    let failedObservations = 0;

    if (shouldImport && data.networkId) {
      const sanitizedName = stripNullBytes(data.name);
      const sanitizedComment = stripNullBytes(data.comment);
      const sanitizedSsid = stripNullBytes(data.locationClusters?.[0]?.clusterSsid || data.name);
      const sanitizedEncryption = stripNullBytes(data.encryption);
      const sanitizedFreenet = stripNullBytes(data.freenet);
      const sanitizedDhcp = stripNullBytes(data.dhcp);
      const sanitizedPaynet = stripNullBytes(data.paynet);

      logger.info(`[WiGLE] Importing detail for ${netid} to database...`);

      await wigleService.importWigleV3NetworkDetail({
        netid: data.networkId,
        name: sanitizedName,
        type: data.type,
        comment: sanitizedComment,
        ssid: sanitizedSsid,
        trilat: data.trilateratedLatitude,
        trilon: data.trilateratedLongitude,
        encryption: sanitizedEncryption,
        channel: data.channel,
        bcninterval: data.bcninterval,
        freenet: sanitizedFreenet,
        dhcp: sanitizedDhcp,
        paynet: sanitizedPaynet,
        qos: data.bestClusterWiGLEQoS,
        first_seen: data.firstSeen,
        last_seen: data.lastSeen,
        last_update: data.lastUpdate,
        street_address: JSON.stringify(data.streetAddress),
        location_clusters: JSON.stringify(data.locationClusters),
      });

      const counts = await importWigleV3Observations(data.networkId, data.locationClusters);
      newObservations = counts.newCount;
      attemptedObservations = counts.totalCount;
      failedObservations = counts.failedCount;
      const importedSnapshot = await wigleService.getWigleObservations(data.networkId, 1, 0);
      totalObservations = importedSnapshot.total;
      logger.info(
        `[WiGLE] Imported ${newObservations} new observations (${totalObservations} total in DB, ${attemptedObservations} attempted, ${failedObservations} failed) for ${netid}`
      );
    }

    res.json({
      ok: true,
      data: normalizedData,
      imported: shouldImport,
      importedObservations: newObservations,
      totalObservations,
      attemptedObservations,
      failedObservations,
    });
  } catch (err: any) {
    logger.error(`[WiGLE] Detail error: ${err.message}`, { error: err });
    next(err);
  }
}

/**
 * POST /detail/:netid - Fetch WiGLE v3 WiFi detail and optionally import
 */
router.post(
  '/detail/:netid',
  requireAdmin,
  asyncHandler(async (req, res, next) => {
    await handleWigleDetailRequest(req, res, next, 'wifi');
  })
);

/**
 * POST /detail/bt/:netid - Fetch WiGLE v3 Bluetooth detail and optionally import
 */
router.post(
  '/detail/bt/:netid',
  requireAdmin,
  asyncHandler(async (req, res, next) => {
    await handleWigleDetailRequest(req, res, next, 'bt');
  })
);

/**
 * POST /import/v3 - Import WiGLE v3 detail JSON file
 */
router.post(
  '/import/v3',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.files || !(req.files as any).file) {
      return res.status(400).json({ ok: false, error: 'No file uploaded' });
    }

    const file = (req.files as any).file;
    const jsonString = file.data.toString('utf8');
    let data;

    try {
      data = JSON.parse(jsonString);
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid JSON file' });
    }

    if (!data.networkId) {
      return res.status(400).json({ ok: false, error: 'JSON missing networkId field' });
    }

    const sanitizedName = stripNullBytes(data.name);
    const sanitizedComment = stripNullBytes(data.comment);
    const sanitizedSsid = stripNullBytes(data.locationClusters?.[0]?.clusterSsid || data.name);
    const sanitizedEncryption = stripNullBytes(data.encryption);
    const sanitizedFreenet = stripNullBytes(data.freenet);
    const sanitizedDhcp = stripNullBytes(data.dhcp);
    const sanitizedPaynet = stripNullBytes(data.paynet);

    logger.info(`[WiGLE] Importing v3 detail for ${data.networkId} from file...`);

    await wigleService.importWigleV3NetworkDetail({
      netid: data.networkId,
      name: sanitizedName,
      type: data.type,
      comment: sanitizedComment,
      ssid: sanitizedSsid,
      trilat: data.trilateratedLatitude,
      trilon: data.trilateratedLongitude,
      encryption: sanitizedEncryption,
      channel: data.channel,
      bcninterval: data.bcninterval,
      freenet: sanitizedFreenet,
      dhcp: sanitizedDhcp,
      paynet: sanitizedPaynet,
      qos: data.bestClusterWiGLEQoS,
      first_seen: data.firstSeen,
      last_seen: data.lastSeen,
      last_update: data.lastUpdate,
      street_address: JSON.stringify(data.streetAddress),
      location_clusters: JSON.stringify(data.locationClusters),
    });

    const counts = await importWigleV3Observations(data.networkId, data.locationClusters);
    const importedSnapshot = await wigleService.getWigleObservations(data.networkId, 1, 0);
    logger.info(
      `[WiGLE] Imported ${counts.newCount} new observations (${importedSnapshot.total} total in DB, ${counts.totalCount} attempted, ${counts.failedCount} failed) for ${data.networkId}`
    );

    res.json({
      ok: true,
      data: stripNullBytesDeep(data),
      importedObservations: counts.newCount,
      totalObservations: importedSnapshot.total,
      attemptedObservations: counts.totalCount,
      failedObservations: counts.failedCount,
    });
  })
);

export default router;
