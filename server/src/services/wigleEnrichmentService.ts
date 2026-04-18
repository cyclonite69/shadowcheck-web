/**
 * WiGLE v3 Enrichment Service
 * Batches v3 detail lookups for existing v2 search results.
 */

const { adminQuery } = require('./adminDbService');
const wigleService = require('./wigleService');
const secretsManager = require('./secretsManager').default;
const logger = require('../logging/logger');
const { withRetry } = require('./externalServiceHandler');
const {
  createImportRun,
  getImportRun,
  markRunControlStatus,
  markRunFailure,
  completeRun,
} = require('./wigleImport/runRepository');

export {};

const ENRICHMENT_DELAY_MS = 1500;
const BATCH_SIZE = 100;

/**
 * Get count of unique BSSIDs in v2 search results
 */
export async function getPendingEnrichmentCount(): Promise<number> {
  const sql = `SELECT COUNT(DISTINCT bssid)::int AS count FROM app.wigle_v2_networks_search`;
  const { rows } = await adminQuery(sql);
  return rows[0]?.count || 0;
}

/**
 * Get the full enrichment catalog with current v3 stats
 */
export async function getEnrichmentCatalog(options: {
  page?: number;
  limit?: number;
  region?: string;
  city?: string;
  ssid?: string;
  bssid?: string;
}) {
  const page = options.page || 1;
  const limit = options.limit || 50;
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const filterParams: any[] = [];

  if (options.region) {
    where.push(`TRIM(region) ILIKE $${filterParams.push(options.region.trim() + '%')}`);
  }
  if (options.city) {
    where.push(`TRIM(city) ILIKE $${filterParams.push(options.city.trim() + '%')}`);
  }
  if (options.ssid) {
    where.push(`ssid ILIKE $${filterParams.push('%' + options.ssid.trim() + '%')}`);
  }
  if (options.bssid) {
    where.push(`bssid ILIKE $${filterParams.push(options.bssid.trim() + '%')}`);
  }

  const subWhereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  // Main query parameters: [limit, offset, ...filters]
  const queryParams = [limit, offset, ...filterParams];

  const sql = `
    SELECT 
      v2.bssid, 
      v2.ssid, 
      v2.region, 
      v2.city, 
      v2.type,
      v2.lasttime,
      v3.imported_at as last_v3_import,
      (SELECT COUNT(*)::int FROM app.wigle_v3_observations o WHERE o.netid = v2.bssid) as v3_obs_count
    FROM (
      SELECT DISTINCT ON (bssid) bssid, ssid, region, city, type, lasttime
      FROM app.wigle_v2_networks_search
      ${subWhereClause}
      ORDER BY bssid, lasttime DESC
    ) v2
    LEFT JOIN app.wigle_v3_network_details v3 ON v3.netid = v2.bssid
    ORDER BY v2.lasttime DESC, v2.bssid ASC
    LIMIT $1 OFFSET $2
  `;

  // For the main query, filters start at $3
  let mainSql = sql;
  filterParams.forEach((_, i) => {
    // Replace the $N in subWhereClause which were $1, $2... with $3, $4...
    // We do this by calculating the offset.
    // Actually, it's easier to just build the WHERE clause with the correct numbers.
  });

  // Re-build where with correct numbering for each query
  const getWhere = (startIndex: number) => {
    const w: string[] = [];
    let idx = startIndex;
    if (options.region) w.push(`TRIM(region) ILIKE $${idx++}`);
    if (options.city) w.push(`TRIM(city) ILIKE $${idx++}`);
    if (options.ssid) w.push(`ssid ILIKE $${idx++}`);
    if (options.bssid) w.push(`bssid ILIKE $${idx++}`);
    return w.length > 0 ? `WHERE ${w.join(' AND ')}` : '';
  };

  const mainWhere = getWhere(3);
  const countWhere = getWhere(1);

  const finalSql = `
    SELECT
      v2.bssid,
      v2.ssid,
      v2.region,
      v2.city,
      v2.type,
      v2.firsttime,
      v2.lasttime,
      v3.imported_at as last_v3_import,
      (SELECT COUNT(*)::int FROM app.wigle_v3_observations o WHERE o.netid = v2.bssid) as v3_obs_count
    FROM (
      SELECT DISTINCT ON (bssid) bssid, ssid, region, city, type, firsttime, lasttime
      FROM app.wigle_v2_networks_search
      ${mainWhere}
      ORDER BY bssid, lasttime DESC
    ) v2
    LEFT JOIN app.wigle_v3_network_details v3 ON v3.netid = v2.bssid
    ORDER BY v2.lasttime DESC, v2.bssid ASC
    LIMIT $1 OFFSET $2
  `;

  const countSql = `
    SELECT COUNT(DISTINCT bssid)::int 
    FROM app.wigle_v2_networks_search
    ${countWhere}
  `;

  const [dataResult, countResult] = await Promise.all([
    adminQuery(finalSql, queryParams),
    adminQuery(countSql, filterParams),
  ]);

  return {
    data: dataResult.rows,
    total: countResult.rows[0]?.count || 0,
    page,
    limit,
  };
}

/**
 * Get next batch of BSSIDs to enrich
 */
async function getNextEnrichmentBatch(limit = BATCH_SIZE, manualList?: string[]): Promise<any[]> {
  if (manualList && manualList.length > 0) {
    // For manual runs, we pull the requested BSSIDs
    const sql = `
      SELECT DISTINCT ON (bssid) bssid, type
      FROM app.wigle_v2_networks_search
      WHERE bssid = ANY($2::text[])
      ORDER BY bssid, lasttime DESC
      LIMIT $1
    `;
    const { rows } = await adminQuery(sql, [limit, manualList]);
    return rows;
  }

  // Global batch: pull those missing v3 details first
  const sql = `
    SELECT DISTINCT ON (v2.bssid) v2.bssid, v2.type
    FROM app.wigle_v2_networks_search v2
    LEFT JOIN app.wigle_v3_network_details v3 ON v3.netid = v2.bssid
    WHERE v3.netid IS NULL
    ORDER BY v2.bssid, v2.lasttime DESC
    LIMIT $1
  `;
  const { rows } = await adminQuery(sql, [limit]);
  return rows;
}

const inferWigleEndpoint = (networkType: string | null | undefined): 'wifi' | 'bt' => {
  const normalized = String(networkType || '')
    .trim()
    .toUpperCase();
  if (normalized === 'B' || normalized === 'E') return 'bt';
  return 'wifi';
};

async function fetchAndImportDetail(bssid: string, type: string) {
  const wigleApiName = secretsManager.get('wigle_api_name');
  const wigleApiToken = secretsManager.get('wigle_api_token');
  if (!wigleApiName || !wigleApiToken) throw new Error('WiGLE API credentials not configured');

  const endpoint = inferWigleEndpoint(type);
  const encodedAuth = Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');

  const response = await withRetry(
    () =>
      fetch(`https://api.wigle.net/api/v3/detail/${endpoint}/${bssid}`, {
        headers: {
          Authorization: `Basic ${encodedAuth}`,
          Accept: 'application/json',
        },
      }),
    { serviceName: 'WiGLE Batch Enrichment', timeoutMs: 15000, maxRetries: 1 }
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WiGLE API failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data?.networkId) return null;

  // Import detail (using UPSERT logic inside wigleService if it already handles it,
  // or relying on ON CONFLICT logic in the DB layer)
  await wigleService.importWigleV3NetworkDetail({
    netid: data.networkId,
    name: data.name,
    type: data.type,
    comment: data.comment,
    ssid: data.locationClusters?.[0]?.clusterSsid || data.name,
    trilat: data.trilateratedLatitude,
    trilon: data.trilateratedLongitude,
    encryption: data.encryption,
    channel: data.channel,
    first_seen: data.firstSeen,
    last_seen: data.lastSeen,
    last_update: data.lastUpdate,
    street_address: JSON.stringify(data.streetAddress || null),
    location_clusters: JSON.stringify(data.locationClusters || []),
  });

  // Import observations
  let obsCount = 0;
  if (Array.isArray(data.locationClusters)) {
    for (const cluster of data.locationClusters) {
      if (!Array.isArray(cluster.locations)) continue;
      for (const loc of cluster.locations) {
        try {
          const inserted = await wigleService.importWigleV3Observation(
            data.networkId,
            loc,
            loc.ssid || cluster.clusterSsid || data.name
          );
          obsCount += inserted;
        } catch (e) {
          // Continue on individual obs failure
        }
      }
    }
  }

  return { bssid, obsCount };
}

async function runEnrichmentLoop(runId: number, manualList?: string[]) {
  let run = await getImportRun(runId);
  if (run.status === 'completed' || run.status === 'cancelled') return run;

  // Track processed BSSIDs for manual runs to avoid infinite loops if results aren't clearing
  const processed = new Set<string>();

  logger.info(
    `[v3 Enrichment] Starting batch loop for run #${runId}${manualList ? ` (Manual: ${manualList.length} items)` : ''}`
  );

  try {
    for (;;) {
      // Re-fetch run to check for pause/cancel
      const { rows } = await adminQuery('SELECT status FROM app.wigle_import_runs WHERE id = $1', [
        runId,
      ]);
      const currentStatus = rows[0]?.status;
      if (currentStatus === 'paused' || currentStatus === 'cancelled') {
        logger.info(`[v3 Enrichment] Loop stopped: ${currentStatus}`);
        return;
      }

      // If manual, filter out what we already did this loop
      const activeManualList = manualList ? manualList.filter((b) => !processed.has(b)) : undefined;

      const batch = await getNextEnrichmentBatch(5, activeManualList);
      if (batch.length === 0) {
        await completeRun(runId);
        logger.info(`[v3 Enrichment] Completed run #${runId}`);
        return;
      }

      for (const item of batch) {
        try {
          await fetchAndImportDetail(item.bssid, item.type);
          processed.add(item.bssid);

          // Update progress in run table
          await adminQuery(
            `UPDATE app.wigle_import_runs
             SET rows_inserted = rows_inserted + 1,
                 pages_fetched = pages_fetched + 1,
                 updated_at = NOW()
             WHERE id = $1`,
            [runId]
          );

          await new Promise((resolve) => setTimeout(resolve, ENRICHMENT_DELAY_MS));
        } catch (err: any) {
          if (err.message?.includes('429')) {
            await markRunControlStatus(runId, 'paused');
            logger.warn(`[v3 Enrichment] Rate limited. Pausing run #${runId}`);
            return;
          }
          // Log but continue for other errors
          logger.error(`[v3 Enrichment] Failed item ${item.bssid}: ${err.message}`);
          processed.add(item.bssid); // Don't retry failed item in this loop pass
        }
      }
    }
  } catch (err: any) {
    await markRunFailure(runId, err.message);
    logger.error(`[v3 Enrichment] Fatal loop error: ${err.message}`);
  }
}

export async function startBatchEnrichment(bssids?: string[]) {
  const isManual = Array.isArray(bssids) && bssids.length > 0;
  const pending = isManual ? bssids!.length : await getPendingEnrichmentCount();

  if (pending === 0) {
    throw new Error(
      isManual ? 'No valid BSSIDs provided for enrichment' : 'No networks found in v2 catalog'
    );
  }

  const run = await createImportRun({
    version: 'v3',
    source: isManual ? 'v3_manual' : 'v3_batch',
    searchTerm: isManual
      ? `Targeted Enrichment (${pending} items)`
      : `Full Catalog Enrichment (${pending} items)`,
    resultsPerPage: 1,
  });

  // Set total items in api_total_results for progress bar
  await adminQuery('UPDATE app.wigle_import_runs SET api_total_results = $1 WHERE id = $2', [
    pending,
    run.id,
  ]);

  // Start background loop
  void runEnrichmentLoop(run.id, bssids);

  return run;
}

export async function resumeEnrichment(runId: number) {
  const { rows } = await adminQuery(
    "UPDATE app.wigle_import_runs SET status = 'running', last_error = NULL WHERE id = $1 RETURNING *",
    [runId]
  );
  if (rows.length === 0) throw new Error('Run not found');

  void runEnrichmentLoop(runId);
  return rows[0];
}

module.exports = {
  getPendingEnrichmentCount,
  getEnrichmentCatalog,
  startBatchEnrichment,
  resumeEnrichment,
  validateWigleApiCredit,
};

/**
 * Validates that the WiGLE API key has remaining credit.
 * Returns { hasCredit: boolean, message: string }
 */
export async function validateWigleApiCredit() {
  try {
    const wigleApiName = secretsManager.get('wigle_api_name');
    const wigleApiToken = secretsManager.get('wigle_api_token');

    if (!wigleApiName || !wigleApiToken) {
      return { hasCredit: false, message: 'WiGLE API credentials not configured' };
    }

    const encodedAuth = Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');

    // WiGLE API: GET /api/v2/stats
    // Returns { estimatedApiQuotaRemaining: number }
    const response = await fetch('https://api.wigle.net/api/v2/stats', {
      headers: {
        Authorization: `Basic ${encodedAuth}`,
      },
    });

    if (response.status === 401) {
      return {
        hasCredit: false,
        message: 'Invalid WiGLE API key',
      };
    }

    const data = (await response.json()) as any;
    const remaining = data?.estimatedApiQuotaRemaining || 0;

    if (remaining === 0) {
      return {
        hasCredit: false,
        message: `No API credit remaining (0 requests)`,
      };
    }

    if (remaining < 10) {
      logger.warn(`[WiGLE] Low API credit: ${remaining} requests remaining`);
    }

    return {
      hasCredit: true,
      message: `${remaining} requests available`,
    };
  } catch (err) {
    logger.error('[WiGLE] Error checking API credit:', err);
    // Fail open: if we can't check credit, don't block the request
    // (but log it for investigation)
    return {
      hasCredit: true,
      message: 'Credit check unavailable (proceeding with request)',
    };
  }
}
