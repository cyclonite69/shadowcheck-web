export {};

const { adminQuery } = require('./adminDbService');
const wigleService = require('./wigleService');
const secretsManager = require('./secretsManager').default;
const logger = require('../logging/logger');
const { withRetry } = require('./externalServiceHandler');

type ListOrphanNetworksOptions = {
  search?: string;
  limit?: number;
  offset?: number;
};

type OrphanBackfillStatus =
  | 'not_attempted'
  | 'wigle_match_imported_v3'
  | 'no_wigle_match'
  | 'error';

const stripNullBytes = (value: any): string | null => {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).replace(/\u0000/g, '');
  return cleaned === '' ? null : cleaned;
};

const inferWigleEndpoint = (networkType: string | null | undefined): 'wifi' | 'bt' => {
  const normalized = String(networkType || '')
    .trim()
    .toUpperCase();
  if (normalized === 'B' || normalized === 'E') return 'bt';
  return 'wifi';
};

async function recordBackfillAttempt(input: {
  bssid: string;
  status: OrphanBackfillStatus;
  matchedNetid?: string | null;
  detailImported?: boolean;
  observationsImported?: number;
  lastError?: string | null;
}) {
  await adminQuery(
    `INSERT INTO app.orphan_network_backfills (
       bssid,
       status,
       matched_netid,
       detail_imported,
       observations_imported,
       last_attempted_at,
       last_error,
       updated_at
     ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, NOW())
     ON CONFLICT (bssid) DO UPDATE SET
       status = EXCLUDED.status,
       matched_netid = EXCLUDED.matched_netid,
       detail_imported = EXCLUDED.detail_imported,
       observations_imported = EXCLUDED.observations_imported,
       last_attempted_at = EXCLUDED.last_attempted_at,
       last_error = EXCLUDED.last_error,
       updated_at = NOW()`,
    [
      input.bssid,
      input.status,
      input.matchedNetid || null,
      Boolean(input.detailImported),
      Number(input.observationsImported || 0),
      input.lastError || null,
    ]
  );
}

async function importWigleV3Observations(
  netid: string,
  locationClusters: any[]
): Promise<{ newCount: number; totalCount: number; failedCount: number }> {
  if (!Array.isArray(locationClusters)) {
    return { newCount: 0, totalCount: 0, failedCount: 0 };
  }

  let newCount = 0;
  let totalCount = 0;
  let failedCount = 0;

  for (const cluster of locationClusters) {
    if (!Array.isArray(cluster?.locations)) continue;
    for (const loc of cluster.locations) {
      totalCount += 1;
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
      } catch (error: any) {
        failedCount += 1;
        logger.warn(`[Orphan Backfill] Observation import failed for ${netid}: ${error.message}`);
      }
    }
  }

  return { newCount, totalCount, failedCount };
}

async function fetchWigleDetail(bssid: string, endpoint: 'wifi' | 'bt') {
  const wigleApiName = secretsManager.get('wigle_api_name');
  const wigleApiToken = secretsManager.get('wigle_api_token');

  if (!wigleApiName || !wigleApiToken) {
    throw new Error('WiGLE API credentials not configured');
  }

  const encodedAuth = Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');
  const response = await withRetry(
    () =>
      fetch(`https://api.wigle.net/api/v3/detail/${endpoint}/${bssid}`, {
        headers: {
          Authorization: `Basic ${encodedAuth}`,
          Accept: 'application/json',
        },
      }),
    { serviceName: 'WiGLE Orphan Backfill', timeoutMs: 15000, maxRetries: 2 }
  );

  if (response.status === 404) {
    return { ok: false, status: 404, data: null };
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`WiGLE detail request failed (${response.status}): ${details}`);
  }

  return { ok: true, status: response.status, data: await response.json() };
}

async function listOrphanNetworks(opts: ListOrphanNetworksOptions = {}): Promise<any[]> {
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 500);
  const offset = Math.max(Number(opts.offset) || 0, 0);
  const search = String(opts.search || '').trim();
  const params: any[] = [];
  const where: string[] = [];

  if (search) {
    params.push(`%${search}%`, `%${search}%`);
    where.push(`(o.bssid ILIKE $${params.length - 1} OR o.ssid ILIKE $${params.length})`);
  }

  params.push(limit);
  params.push(offset);

  const sql = `
    SELECT
      o.bssid,
      o.ssid,
      o.type,
      o.frequency,
      o.capabilities,
      o.source_device,
      o.lasttime_ms,
      o.lastlat,
      o.lastlon,
      o.bestlevel,
      o.bestlat,
      o.bestlon,
      o.unique_days,
      o.unique_locations,
      o.is_sentinel,
      o.wigle_v3_observation_count,
      o.wigle_v3_last_import_at,
      o.moved_at,
      o.move_reason,
      COALESCE(ob.status, 'not_attempted') AS backfill_status,
      ob.matched_netid,
      ob.detail_imported,
      ob.observations_imported,
      ob.last_attempted_at,
      ob.last_promoted_at,
      ob.last_error
    FROM app.networks_orphans o
    LEFT JOIN app.orphan_network_backfills ob ON ob.bssid = o.bssid
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY o.moved_at DESC, o.bssid ASC
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
  `;

  const { rows } = await adminQuery(sql, params);
  return rows;
}

async function getOrphanNetworkCounts(
  opts: Pick<ListOrphanNetworksOptions, 'search'> = {}
): Promise<{
  total: number;
}> {
  const search = String(opts.search || '').trim();
  const params: any[] = [];
  const where: string[] = [];

  if (search) {
    params.push(`%${search}%`, `%${search}%`);
    where.push(`(bssid ILIKE $${params.length - 1} OR ssid ILIKE $${params.length})`);
  }

  const sql = `
    SELECT COUNT(*)::int AS total
    FROM app.networks_orphans
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `;

  const { rows } = await adminQuery(sql, params);
  return { total: rows[0]?.total || 0 };
}

async function backfillOrphanNetworkFromWigle(bssid: string): Promise<any> {
  const { rows } = await adminQuery(
    `SELECT bssid, ssid, type
       FROM app.networks_orphans
      WHERE bssid = $1
      LIMIT 1`,
    [
      String(bssid || '')
        .trim()
        .toUpperCase(),
    ]
  );

  const orphan = rows[0];
  if (!orphan) {
    throw new Error(`Orphan network not found: ${bssid}`);
  }

  const endpoint = inferWigleEndpoint(orphan.type);

  try {
    const detailResponse = await fetchWigleDetail(orphan.bssid, endpoint);
    const data = detailResponse.data;

    // Check if payload explicitly mentions a result or if it's a known 'not found' / 'rate limit'
    if (!detailResponse.ok || !data || data.success === false || !data.networkId) {
      const isRateLimit =
        data?.message?.toLowerCase().includes('too many') || detailResponse.status === 429;
      const isNotFound =
        detailResponse.status === 404 || data?.message?.toLowerCase().includes('not found');

      if (isRateLimit) {
        throw new Error('WiGLE API rate limit reached. Try again later.');
      }

      await recordBackfillAttempt({
        bssid: orphan.bssid,
        status: isNotFound ? 'no_wigle_match' : 'error',
        matchedNetid: null,
        detailImported: false,
        observationsImported: 0,
        lastError: isNotFound ? null : data?.message || 'API response missing network data',
      });

      return {
        ok: true,
        bssid: orphan.bssid,
        status: isNotFound ? 'no_wigle_match' : 'error',
        endpoint,
        importedObservations: 0,
        message: data?.message,
      };
    }

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
      street_address: JSON.stringify(data.streetAddress || null),
      location_clusters: JSON.stringify(data.locationClusters || []),
    });

    const counts = await importWigleV3Observations(data.networkId, data.locationClusters);
    const importedSnapshot = await wigleService.getWigleObservations(data.networkId, 1, 0);

    await recordBackfillAttempt({
      bssid: orphan.bssid,
      status: 'wigle_match_imported_v3',
      matchedNetid: data.networkId,
      detailImported: true,
      observationsImported: importedSnapshot.total,
      lastError: null,
    });

    return {
      ok: true,
      bssid: orphan.bssid,
      status: 'wigle_match_imported_v3',
      endpoint,
      matchedNetid: data.networkId,
      importedObservations: counts.newCount,
      totalObservations: importedSnapshot.total,
      attemptedObservations: counts.totalCount,
      failedObservations: counts.failedCount,
    };
  } catch (error: any) {
    await recordBackfillAttempt({
      bssid: orphan.bssid,
      status: 'error',
      matchedNetid: null,
      detailImported: false,
      observationsImported: 0,
      lastError: error.message || 'Unknown error',
    });
    throw error;
  }
}

async function promoteOrphanNetworkToCanonical(bssid: string): Promise<any> {
  const { rows } = await adminQuery(
    `SELECT o.bssid, o.ssid, o.type, ob.matched_netid, ob.status
       FROM app.networks_orphans o
       JOIN app.orphan_network_backfills ob ON ob.bssid = o.bssid
      WHERE o.bssid = $1
      LIMIT 1`,
    [bssid]
  );

  const orphan = rows[0];
  if (!orphan) {
    throw new Error(`Orphan network not found or not checked: ${bssid}`);
  }

  if (orphan.status !== 'wigle_match_imported_v3') {
    throw new Error(`Orphan network ${bssid} has no WiGLE match to promote`);
  }

  // 1. Copy observations from WiGLE v3 to canonical app.observations
  const copyResult = await adminQuery(
    `INSERT INTO app.observations (
       device_id, bssid, ssid, radio_type, radio_frequency, level,
       lat, lon, accuracy, time, observed_at_ms, external, geom
     )
     SELECT
       'wigle_backfill',
       $1,
       ssid,
       'wifi',
       2437, -- Default if unknown
       -70,  -- Default if unknown
       trilat,
       trilong,
       50,   -- Accuracy guess
       fetched_at,
       EXTRACT(EPOCH FROM fetched_at) * 1000,
       true,
       location
     FROM app.wigle_v3_observations
     WHERE bssid = $1
     ON CONFLICT DO NOTHING`,
    [orphan.bssid]
  );

  // 2. Update promotion status
  await adminQuery(
    `UPDATE app.orphan_network_backfills
        SET last_promoted_at = NOW()
      WHERE bssid = $1`,
    [orphan.bssid]
  );

  // 3. Remove from orphan table (it is now in app.networks via triggers/auto-insert)
  // Actually we need to make sure it exists in app.networks first if not there
  await adminQuery(
    `INSERT INTO app.networks (bssid, ssid, type, capabilities, lasttime_ms, lastlat, lastlon)
     SELECT bssid, ssid, type, capabilities, lasttime_ms, lastlat, lastlon
     FROM app.networks_orphans
     WHERE bssid = $1
     ON CONFLICT (bssid) DO UPDATE SET
       ssid = EXCLUDED.ssid,
       lasttime_ms = GREATEST(app.networks.lasttime_ms, EXCLUDED.lasttime_ms)`,
    [orphan.bssid]
  );

  await adminQuery(`DELETE FROM app.networks_orphans WHERE bssid = $1`, [orphan.bssid]);

  return {
    ok: true,
    bssid: orphan.bssid,
    observationsPromoted: copyResult.rowCount,
  };
}

module.exports = {
  listOrphanNetworks,
  getOrphanNetworkCounts,
  backfillOrphanNetworkFromWigle,
  promoteOrphanNetworkToCanonical,
};
