import logger from '../../logging/logger';
import secretsManager from '../secretsManager';
import { wigleGatewayFetch } from './wigleGateway';
import { query } from '../../config/database';
import { findKmlFilesByHashes } from '../../repositories/kmlImportRepository';
import { getKmlImportCommand, PROJECT_ROOT, parseKmlImportCounts } from '../admin/adminHelpers';
const adminImportHistoryService = require('../adminImportHistoryService');
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import crypto from 'crypto';
import { spawn } from 'child_process';

export interface WigleSyncOptions {
  limit?: number;
  dryRun?: boolean;
  force?: boolean;
}

export interface WigleSyncResult {
  ok: boolean;
  syncedCount: number;
  skippedCount: number;
  failedCount: number;
  results: {
    transid: string;
    fileName: string;
    status: 'imported' | 'skipped' | 'failed' | 'deferred';
    error?: string;
    pointsImported?: number;
  }[];
  remoteCount?: number;
  eligibleCount?: number;
  skippedAlreadyImportedCount?: number;
  skippedIncompleteCount?: number;
  skippedReasons?: string[];
  deferredCount?: number;
  rateLimited?: boolean;
  rateLimitMessage?: string;
  remainingDeferredCount?: number;
}

/**
 * List file transactions uploaded by the user from the WiGLE API (v2)
 */
export async function listTransactions(pageStart = 0, pageEnd = 100): Promise<any> {
  const name = secretsManager.get('wigle_api_name');
  const token = secretsManager.get('wigle_api_token');

  if (!name || !token) {
    const err: any = new Error('WiGLE API credentials not configured');
    err.status = 503;
    throw err;
  }

  const encoded = Buffer.from(`${name}:${token}`).toString('base64');

  const result = await wigleGatewayFetch({
    kind: 'stats',
    url: `https://api.wigle.net/api/v2/file/transactions?pagestart=${pageStart}&pageend=${pageEnd}`,
    timeoutMs: 15000,
    maxRetries: 0,
    label: 'WiGLE File Transactions',
    entrypoint: 'kml_sync',
    endpointType: 'v2/file/transactions',
    query_source: 'scheduled',
    init: {
      headers: {
        Authorization: `Basic ${encoded}`,
      },
    },
  });

  if (!result.ok) {
    const err: any = new Error(result.error || `WiGLE API error: ${result.status}`);
    if (result.status !== undefined) {
      err.status = result.status;
    }
    throw err;
  }

  const response = result.response;
  if (!response.ok) {
    const errorData: any = await response.json().catch(() => ({}));
    const err: any = new Error(errorData.message || `WiGLE API error: ${response.status}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

/**
 * Download KML file from the WiGLE API (v2)
 */
export async function downloadKml(transid: string): Promise<Buffer> {
  const name = secretsManager.get('wigle_api_name');
  const token = secretsManager.get('wigle_api_token');

  if (!name || !token) {
    const err: any = new Error('WiGLE API credentials not configured');
    err.status = 503;
    throw err;
  }

  const encoded = Buffer.from(`${name}:${token}`).toString('base64');

  const result = await wigleGatewayFetch({
    kind: 'stats',
    url: `https://api.wigle.net/api/v2/file/kml/${transid}`,
    timeoutMs: 30000,
    maxRetries: 1,
    label: 'WiGLE KML Download',
    entrypoint: 'kml_sync',
    endpointType: 'v2/file/kml',
    query_source: 'scheduled',
    init: {
      headers: {
        Authorization: `Basic ${encoded}`,
        Accept: 'application/vnd.google-earth.kml+xml',
      },
    },
  });

  if (!result.ok) {
    const err: any = new Error(result.error || `WiGLE API error: ${result.status}`);
    if (result.status !== undefined) {
      err.status = result.status;
    }
    throw err;
  }

  const response = result.response;
  if (!response.ok) {
    const textData = await response
      .clone()
      .text()
      .catch(() => '');
    const err: any = new Error(textData.substring(0, 500) || `WiGLE API error: ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Helper to check if a WiGLE transaction is successfully completed.
 * Maps: status === "D" OR percentDone === 100 OR status === "SUCCESS"
 */
export function isCompletedWigleTransaction(tx: any): boolean {
  if (!tx.transid) {
    return false;
  }
  const statusStr = String(tx.status || '').toUpperCase();
  return statusStr === 'D' || statusStr === 'SUCCESS' || tx.percentDone === 100;
}

/**
 * Maps WiGLE raw transaction status to display/persistence status.
 * Maps completed status (e.g. "D") to "SUCCESS", preserving others.
 */
export function mapWigleStatus(tx: any): string {
  const statusStr = String(tx.status || '').toUpperCase();
  if (statusStr === 'D' || statusStr === 'SUCCESS' || tx.percentDone === 100) {
    return 'SUCCESS';
  }
  return tx.status || 'UNKNOWN';
}

function isWigleQuotaError(e: any): boolean {
  if (!e) {
    return false;
  }
  if (e.status === 429 || e.status === 503) {
    return true;
  }
  const msg = String(e.message || '').toLowerCase();
  return (
    msg.includes('soft limit reached') ||
    msg.includes('circuit breaker') ||
    msg.includes('rate limit') ||
    msg.includes('quota')
  );
}

/**
 * Main function to sync missing KML files from WiGLE upload history
 */
export async function syncKmlTransactions(
  options: WigleSyncOptions = {}
): Promise<WigleSyncResult> {
  const limit = options.limit ?? 10;
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;

  logger.info(
    `[WiGLE KML Sync] Starting sync run | limit=${limit} | dryRun=${dryRun} | force=${force}`
  );

  // 1. Fetch remote transactions
  const apiResponse = await listTransactions(0, 100);
  if (!apiResponse.success || !Array.isArray(apiResponse.results)) {
    throw new Error('WiGLE transactions endpoint returned unsuccessful response');
  }

  // Filter to SUCCESS/completed transactions
  const successTransactions = apiResponse.results.filter((tx: any) =>
    isCompletedWigleTransaction(tx)
  );

  // 2. Fetch already imported transids
  const existingTransidsResult = await query(
    'SELECT DISTINCT wigle_transid FROM app.kml_files WHERE wigle_transid IS NOT NULL'
  );
  const existingTransidsSet = new Set(
    existingTransidsResult.rows.map((row: any) => row.wigle_transid)
  );

  // 3. Filter candidates
  const candidates = successTransactions.filter((tx: any) => !existingTransidsSet.has(tx.transid));

  logger.info(`[WiGLE KML Sync] Found ${candidates.length} candidate transactions not yet in DB`);

  const toSync = candidates.slice(0, limit);
  const results: WigleSyncResult['results'] = [];
  let syncedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let rateLimited = false;
  let rateLimitMessage = '';
  let deferredCount = 0;

  // Prepare standard debug fields
  const debugFields = {
    remoteCount: apiResponse.results.length,
    eligibleCount: successTransactions.length,
    skippedAlreadyImportedCount: successTransactions.length - candidates.length,
    skippedIncompleteCount: apiResponse.results.length - successTransactions.length,
    skippedReasons: [
      `Remote queue stats: processing=${apiResponse.processingQueueDepth || 0}, geo=${apiResponse.geoQueueDepth || 0}, trilateration=${apiResponse.trilaterationQueueDepth || 0}`,
    ],
  };

  if (dryRun) {
    return {
      ok: true,
      syncedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      deferredCount: 0,
      rateLimited: false,
      remainingDeferredCount: candidates.length,
      results: toSync.map((tx: any) => {
        let filename = tx.fileName || `${tx.transid}.kml`;
        if (!filename.toLowerCase().endsWith('.kml')) {
          if (filename.toLowerCase().endsWith('.csv')) {
            filename = `${filename.substring(0, filename.length - 4)}.kml`;
          } else {
            filename = `${filename}.kml`;
          }
        }
        return {
          transid: tx.transid,
          fileName: filename,
          status: 'skipped', // dryRun behaves as skipped for actual download
        };
      }),
      ...debugFields,
    };
  }

  for (const tx of toSync) {
    let filename = tx.fileName || `${tx.transid}.kml`;
    if (!filename.toLowerCase().endsWith('.kml')) {
      if (filename.toLowerCase().endsWith('.csv')) {
        filename = `${filename.substring(0, filename.length - 4)}.kml`;
      } else {
        filename = `${filename}.kml`;
      }
    }
    const transid = tx.transid;
    const uploadedAt = tx.lastupdt || tx.firstTime || new Date().toISOString();
    const txStatus = mapWigleStatus(tx);

    if (rateLimited) {
      results.push({
        transid,
        fileName: filename,
        status: 'deferred',
        error: 'WiGLE request budget exhausted; remaining transactions deferred.',
      });
      deferredCount++;
      continue;
    }

    try {
      logger.info(`[WiGLE KML Sync] Processing transaction ${transid} | file=${filename}`);

      // Download KML
      const buffer = await downloadKml(transid);

      // Verify and hash
      const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

      // Check duplicates by file_hash
      if (!force) {
        const hashMatch = await findKmlFilesByHashes([fileHash]);
        if (hashMatch.length > 0) {
          logger.info(
            `[WiGLE KML Sync] Duplicate file hash found for transaction ${transid} | hash=${fileHash}. Associating existing record.`
          );
          // Associate the existing record with this transid so it is marked as synced
          await query(
            `UPDATE app.kml_files
             SET wigle_transid = $1,
                 wigle_file_name = $2,
                 wigle_uploaded_at = $3,
                 wigle_status = $4
             WHERE file_hash = $5`,
            [transid, filename, uploadedAt, txStatus, fileHash]
          );

          results.push({ transid, fileName: filename, status: 'skipped' });
          skippedCount++;
          continue;
        }
      }

      // Write to temp dir
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wigle-kml-sync-'));
      const destPath = path.join(tempDir, filename);
      await fs.writeFile(destPath, buffer);

      const metricsBefore = await adminImportHistoryService.captureImportMetrics();
      const historyId = await adminImportHistoryService.createImportHistoryEntry(
        'wigle-sync',
        filename,
        metricsBefore
      );

      const startTime = Date.now();
      const commandSpec = getKmlImportCommand(tempDir, 'wigle');
      const cmd = commandSpec.command;
      const { args } = commandSpec;

      // Spawn staging importer child process
      const importResult = await new Promise<{
        code: number | null;
        output: string;
        errorOutput: string;
      }>((resolve, reject) => {
        const p = spawn(cmd, args, {
          cwd: PROJECT_ROOT,
          env: {
            ...process.env,
            DB_ADMIN_PASSWORD: secretsManager.get('db_admin_password') || '',
            DB_ADMIN_USER: 'shadowcheck_admin',
          },
        });
        let output = '',
          errorOutput = '';
        p.stdout.on('data', (d) => (output += d));
        p.stderr.on('data', (d) => (errorOutput += d));
        p.on('close', (code) => resolve({ code, output, errorOutput }));
        p.on('error', reject);
      });

      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

      if (importResult.code !== 0) {
        await adminImportHistoryService.failImportHistory(
          historyId,
          importResult.errorOutput || `code ${importResult.code}`,
          durationSec
        );
        throw new Error(
          `ETL importer failed with exit code ${importResult.code}: ${importResult.errorOutput}`
        );
      }

      const { pointsImported } = parseKmlImportCounts(importResult.output, 1);
      const metricsAfter = await adminImportHistoryService.captureImportMetrics();
      await adminImportHistoryService.completeImportSuccess(
        historyId,
        pointsImported,
        0,
        durationSec,
        metricsAfter
      );

      // Now populate the new WiGLE fields only for this WiGLE API-sourced KML
      await query(
        `UPDATE app.kml_files
         SET wigle_transid = $1,
             wigle_file_name = $2,
             wigle_uploaded_at = $3,
             wigle_status = $4
         WHERE file_hash = $5`,
        [transid, filename, uploadedAt, txStatus, fileHash]
      );

      results.push({ transid, fileName: filename, status: 'imported', pointsImported });
      syncedCount++;
    } catch (e: any) {
      // Redact credential references if present in error message
      const rawMsg = e?.message || String(e);
      const safeMsg = rawMsg
        .replace(/Authorization: Basic [A-Za-z0-9+/=]+/gi, 'Authorization: Basic [REDACTED]')
        .substring(0, 500);

      if (isWigleQuotaError(e)) {
        logger.warn(`[WiGLE KML Sync] Quota/rate-limit hit at transaction ${transid}: ${safeMsg}`);
        rateLimited = true;
        rateLimitMessage =
          'Deferred — WiGLE request budget exhausted. Try again after the request window resets.';
        results.push({
          transid,
          fileName: filename,
          status: 'deferred',
          error: 'WiGLE request budget exhausted; remaining transactions deferred.',
        });
        deferredCount++;
      } else {
        logger.error(`[WiGLE KML Sync] Failed transaction ${transid}: ${safeMsg}`, { error: e });
        results.push({ transid, fileName: filename, status: 'failed', error: safeMsg });
        failedCount++;
      }
    }
  }

  const processedSoFar = results.filter(
    (r) => r.status === 'imported' || r.status === 'skipped' || r.status === 'failed'
  ).length;
  const remainingDeferredCount = rateLimited
    ? candidates.length - processedSoFar
    : candidates.length - results.length;

  return {
    ok: failedCount === 0 && !rateLimited,
    syncedCount,
    skippedCount,
    failedCount,
    deferredCount,
    rateLimited,
    rateLimitMessage: rateLimited ? rateLimitMessage : undefined,
    remainingDeferredCount: remainingDeferredCount >= 0 ? remainingDeferredCount : 0,
    results,
    ...debugFields,
  };
}
