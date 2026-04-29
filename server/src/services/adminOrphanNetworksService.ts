export {};

const { adminQuery } = require('./adminDbService');
const wigleService = require('./wigleService');
const logger = require('../logging/logger');
import { stripNullBytes, inferWigleEndpoint } from './wigleDetailTransforms';
import { fetchUpstream, importObservations } from './wigleDetailService';

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
    const detailResponse = await fetchUpstream(orphan.bssid, endpoint);
    const data = detailResponse.ok ? detailResponse.data : null;
    const detailStatus: number = detailResponse.ok ? 200 : detailResponse.status;

    // Check if payload has actual observation data. networkId alone is not sufficient —
    // WiGLE echoes the queried ID back even when it has no location data for the network.
    // Clusters may exist but contain zero location points — count actual locations to be sure.
    const locationCount = Array.isArray(data?.locationClusters)
      ? data.locationClusters.reduce(
          (sum: number, c: any) => sum + (Array.isArray(c?.locations) ? c.locations.length : 0),
          0
        )
      : 0;
    const hasObservations = locationCount > 0;
    if (
      !detailResponse.ok ||
      !data ||
      data.success === false ||
      !data.networkId ||
      !hasObservations
    ) {
      const isRateLimit = data?.message?.toLowerCase().includes('too many') || detailStatus === 429;
      const isNotFound =
        detailStatus === 404 ||
        data?.message?.toLowerCase().includes('not found') ||
        (detailResponse.ok && data?.networkId && !hasObservations);

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

    const counts = await importObservations(data.networkId, data.locationClusters);
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

module.exports = {
  listOrphanNetworks,
  getOrphanNetworkCounts,
  backfillOrphanNetworkFromWigle,
};
