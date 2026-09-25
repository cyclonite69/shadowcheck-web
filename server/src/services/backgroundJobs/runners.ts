export {};

const logger = require('../../logging/logger');
const { runPostgresBackup } = require('../backupService');
const mlScoringRepository = require('../ml/repository');
const networkTagService = require('../networkTagService');
const OUIGroupingService = require('../ouiGroupingService');

import { scoreBehavioralThreats } from './mlBehavioralScoring';
import { scoreSurveillanceCandidates } from './surveillanceScoring';
import { SurveillanceScanDryRunResult } from '../../types/surveillanceScan';

const survRepo = require('../../repositories/surveillanceDetectionRepository');

const ML_SCORING_LIMIT = 10000;
const ML_RECOMPUTE_LIMIT = 200000;
const MAX_BSSID_LENGTH = 17;
const MIN_OBSERVATIONS = 2;

const runBackupJob = async () => {
  logger.info('[Backup Job] Starting scheduled backup...');
  const result = await runPostgresBackup({ uploadToS3: true });
  const primaryFile = Array.isArray(result.files)
    ? result.files.find((file: any) => file.type === 'database') || result.files[0]
    : null;
  const uploadedDatabase = Array.isArray(result.s3)
    ? result.s3.find((file: any) => file.type === 'database') || result.s3[0]
    : null;
  const fileName = result.fileName || primaryFile?.name || null;
  const bytes = result.bytes || primaryFile?.bytes || null;

  if (uploadedDatabase) {
    logger.info(
      `[Backup Job] Complete: ${fileName} (${bytes} bytes) uploaded to ${uploadedDatabase.url}`
    );
  } else if (result.s3Error) {
    logger.warn(
      `[Backup Job] Backup created locally (${fileName}) but S3 upload failed: ${result.s3Error}`
    );
  }

  return {
    fileName,
    bytes,
    s3Url: uploadedDatabase?.url || null,
    s3Error: result.s3Error || null,
  };
};

const runBehavioralMlScoringJob = async () => {
  logger.info('[ML Scoring Job] Starting behavioral threat scoring v2.0 (simple)...');

  const pendingRecompute =
    await mlScoringRepository.getNetworksNeedingRecompute(ML_RECOMPUTE_LIMIT);
  const hasPending = pendingRecompute.length > 0;

  const networks = hasPending
    ? pendingRecompute
    : await mlScoringRepository.getNetworksForBehavioralScoring(
        ML_SCORING_LIMIT,
        MIN_OBSERVATIONS,
        MAX_BSSID_LENGTH
      );

  logger.info(
    `[ML Scoring Job] Analyzing ${networks.length} networks with feedback-aware behavioral model`,
    { recomputeMode: hasPending }
  );

  const tagRows = await networkTagService.getManualThreatTags();
  const { scores, tagMap } = scoreBehavioralThreats(networks, tagRows);

  logger.info(`[ML Scoring Job] Found ${tagMap.size} manual tags for feedback adjustment`);

  const inserted = await mlScoringRepository.bulkUpsertThreatScores(scores);
  logger.info(`[ML Scoring Job] Complete: ${inserted} networks scored with behavioral model v2.0`);

  if (hasPending && scores.length > 0) {
    const bssids = scores.map((s: { bssid: string }) => s.bssid);
    await mlScoringRepository.resetNeedsRecompute(bssids);
    logger.info(`[ML Scoring Job] Reset needs_recompute for ${bssids.length} networks`);
  }

  logger.info('[ML Scoring Job] Running OUI grouping analysis...');
  await OUIGroupingService.generateOUIGroups();
  await OUIGroupingService.detectMACRandomization();
  logger.info('[ML Scoring Job] OUI grouping complete');

  return {
    analyzedNetworks: networks.length,
    insertedScores: inserted,
    feedbackTaggedNetworks: tagMap.size,
  };
};

const runSiblingDetectionJob = async (options: any = {}) => {
  const { adminQuery } = require('../adminDbService');
  logger.info('[Sibling Detection Job] Starting sibling radio discovery...');

  const { runSiblingRefreshJob } = require('../admin/siblingDetectionAdminService');

  // Set a generous timeout — the chunked loop can take a while on large datasets.
  // This applies to the connection used by the job, not the app pool.
  await adminQuery("SET LOCAL statement_timeout = '30min'");

  // Handle both snake_case (from config) and camelCase (from API)
  const batchSize = options.batch_size ?? options.batchSize ?? 250;
  const maxOctetDelta = options.max_octet_delta ?? options.maxOctetDelta ?? 6;
  const maxDistanceM = options.max_distance_m ?? options.maxDistanceM ?? 1500;
  const minCandidateConf = options.min_candidate_conf ?? options.minCandidateConf ?? 0.9;
  const maxBatches = options.max_batches ?? options.maxBatches ?? null;
  // seed_limit is UI form field for batch size
  const seedLimitBatchSize = options.seed_limit ?? null;
  const finalBatchSize = seedLimitBatchSize ?? batchSize;

  const result = await runSiblingRefreshJob({
    batchSize: finalBatchSize,
    maxOctetDelta,
    maxDistanceM,
    minCandidateConf,
    maxBatches,
    // Scheduled runs are incremental — only process BSSIDs not yet in sibling_pairs.
    // Manual runs (options.incremental explicitly false) do a full pass.
    incremental: options.incremental !== undefined ? options.incremental : true,
  });

  logger.info('[Sibling Detection Job] Complete', result);

  return {
    pairsProcessed: result.rowsUpserted,
    seedsProcessed: result.seedsProcessed,
    batchesRun: result.batchesRun,
    executionTimeMs: result.executionTimeMs,
    completed: result.completed,
  };
};

const runSurveillanceScanJob = async (
  options: { dryRun?: boolean; sampleLimit?: number } = {}
): Promise<
  | SurveillanceScanDryRunResult
  | { detectionCount: number; taggedCount: number; falsePositiveCount: number }
> => {
  const { adminQuery } = require('../adminDbService');
  const dryRun = options.dryRun === true;
  const sampleLimit = options.sampleLimit ?? 100;

  logger.info(
    `[Surveillance Scan] Starting multi-factor surveillance detection scan (v2.0) | dryRun=${dryRun}...`
  );

  // Phase 1: SQL — get enriched candidates with observation stats (all tier hits per bssid)
  let candidates;
  try {
    candidates = await survRepo.getEnrichedCandidates(adminQuery);
  } catch (err: any) {
    logger.error('[Surveillance Scan] SQL error fetching candidates', {
      message: err?.message,
      detail: err?.detail,
      code: err?.code,
    });
    throw err;
  }

  const uniqueBssids = new Set(candidates.map((c: any) => c.bssid));
  logger.info(
    `[Surveillance Scan] Found ${candidates.length} raw candidate signals across ${uniqueBssids.size} unique devices`
  );

  // Phase 2: TypeScript — apply multi-factor scoring per SURVEILLANCE_DEVICE_SIGNATURES.md §5
  const scored = scoreSurveillanceCandidates(candidates);
  const fpCount = scored.filter((s) => s.false_positive).length;
  logger.info(
    `[Surveillance Scan] Scored ${scored.length} devices (${fpCount} auto-flagged false positive)`
  );

  if (dryRun) {
    const existingResult = await adminQuery(
      `
      SELECT bssid, device_type, confidence, threat_score, detection_method, matched_signals, false_positive
      FROM app.surveillance_detections
      WHERE bssid = ANY($1)
    `,
      [scored.map((s) => s.bssid)]
    );

    const existingMap = new Map<
      string,
      {
        bssid: string;
        device_type: string;
        confidence: string | number;
        threat_score: string | number;
        detection_method: string;
        matched_signals: string[];
        false_positive: boolean;
      }
    >();

    for (const row of existingResult.rows) {
      existingMap.set(row.bssid, row);
    }

    const summary = {
      insert: 0,
      update: 0,
      unchanged: 0,
      skip_false_positive: 0,
    };
    const byDeviceType: Record<string, typeof summary> = {};
    const samples: SurveillanceScanDryRunResult['samples'] = [];

    // Map candidates by BSSID to get SSIDs
    const bssidToSsid = new Map<string, string | null>();
    for (const c of candidates) {
      if (c.ssid) {
        bssidToSsid.set(c.bssid, c.ssid);
      }
    }

    const normalize = (v: any) => JSON.stringify(Array.isArray(v) ? [...v].sort() : []);

    for (const s of scored) {
      const existing = existingMap.get(s.bssid);
      let action: 'insert' | 'update' | 'unchanged' | 'skip_false_positive' = 'insert';
      let reason = 'No existing detection found';

      if (existing) {
        if (existing.false_positive) {
          action = 'skip_false_positive';
          reason = 'Existing detection is marked as false positive';
        } else {
          // Normalize confidence/threat_score as floats before comparing
          const existingConf = parseFloat(String(existing.confidence || 0));
          const candidateConf = parseFloat(String(s.confidence || 0));
          const confidenceDiff = existingConf !== candidateConf;

          const existingThreat = parseFloat(String(existing.threat_score || 0));
          const candidateThreat = parseFloat(String(s.threat_score || 0));
          const threatScoreDiff = existingThreat !== candidateThreat;

          const deviceTypeDiff = existing.device_type !== s.device_type;
          const detectionMethodDiff = existing.detection_method !== s.detection_method;
          const matchedSignalsDiff =
            normalize(existing.matched_signals) !== normalize(s.matched_signals);

          if (
            deviceTypeDiff ||
            confidenceDiff ||
            threatScoreDiff ||
            detectionMethodDiff ||
            matchedSignalsDiff
          ) {
            action = 'update';
            const diffs: string[] = [];
            if (deviceTypeDiff) {
              diffs.push(`device_type (${existing.device_type} -> ${s.device_type})`);
            }
            if (confidenceDiff) {
              diffs.push(`confidence (${existingConf} -> ${candidateConf})`);
            }
            if (threatScoreDiff) {
              diffs.push(`threat_score (${existingThreat} -> ${candidateThreat})`);
            }
            if (detectionMethodDiff) {
              diffs.push(
                `detection_method (${existing.detection_method} -> ${s.detection_method})`
              );
            }
            if (matchedSignalsDiff) {
              diffs.push('matched_signals changed');
            }
            reason = `Values changed: ${diffs.join(', ')}`;
          } else {
            action = 'unchanged';
            reason = 'No changes detected';
          }
        }
      }

      summary[action]++;

      if (!byDeviceType[s.device_type]) {
        byDeviceType[s.device_type] = {
          insert: 0,
          update: 0,
          unchanged: 0,
          skip_false_positive: 0,
        };
      }
      byDeviceType[s.device_type][action]++;

      if (samples.length < sampleLimit) {
        const sample: SurveillanceScanDryRunResult['samples'][number] = {
          bssid: s.bssid,
          ssid: bssidToSsid.get(s.bssid) || null,
          device_type: s.device_type,
          confidence: s.confidence,
          threat_score: s.threat_score,
          detection_method: s.detection_method,
          matched_signals: Array.isArray(s.matched_signals) ? s.matched_signals : [],
          action,
          reason,
        };
        if (existing) {
          sample.existing = {
            device_type: existing.device_type,
            confidence: existing.confidence,
            threat_score: parseFloat(String(existing.threat_score)),
            detection_method: existing.detection_method,
            matched_signals: Array.isArray(existing.matched_signals)
              ? existing.matched_signals
              : [],
            false_positive: existing.false_positive,
          };
        }
        samples.push(sample);
      }
    }

    return {
      dryRun: true as const,
      candidateCount: scored.length,
      existingDetectionCount: existingResult.rows.length,
      summary,
      byDeviceType,
      samples,
    };
  }

  // Phase 3: SQL — bulk upsert scored detections
  let upsertedCount: number;
  try {
    upsertedCount = await survRepo.bulkUpsertDetections(adminQuery, scored);
  } catch (err: any) {
    logger.error('[Surveillance Scan] SQL error upserting detections', {
      message: err?.message,
      detail: err?.detail,
      code: err?.code,
    });
    throw err;
  }

  logger.info(`[Surveillance Scan] Upserted ${upsertedCount} surveillance detections`);

  // Phase 4: Tag networks in network_tags (non-FP detections only)
  const nonFpDetections = scored.filter((s) => !s.false_positive);
  let taggedCount = 0;

  if (nonFpDetections.length > 0) {
    const bssids = nonFpDetections.map((r) => r.bssid);
    const confidences = nonFpDetections.map((r) => r.confidence);
    const deviceTypes = nonFpDetections.map((r) => r.device_type);
    const methods = nonFpDetections.map((r) => r.detection_method);

    const tagResult = await adminQuery(
      `
      INSERT INTO app.network_tags (bssid, threat_tag, threat_confidence, notes, tags, created_by)
      SELECT b, 'THREAT', c, 'Surveillance: ' || d || ' (' || m || ')',
        CASE
          WHEN dt = 'SHOTSPOTTER_SENSOR' THEN '["surveillance","shotspotter"]'::jsonb
          WHEN dt IN ('AXON_BODY_CAMERA','MOTOROLA_BWC','AXON_SIGNAL_PERIPHERAL','DEI_BWC','BT_IMAGING_DEVICE') THEN '["surveillance","bwc"]'::jsonb
          WHEN dt = 'DASHCAM' THEN '["surveillance","dashcam"]'::jsonb
          WHEN dt = 'RESIDENTIAL_CAMERA' THEN '["surveillance","residential_cam"]'::jsonb
          WHEN dt IN ('FLOCK_SAFETY_CAMERA','RAVEN_GUNSHOT_DETECTOR','FS_EXT_BATTERY') THEN '["surveillance","flock"]'::jsonb
          ELSE '["surveillance"]'::jsonb
        END,
        'surveillance_scan_job'
      FROM unnest($1::text[], $2::numeric[], $3::text[], $4::text[], $5::text[]) AS t(b, c, d, m, dt)
      ON CONFLICT (bssid) DO UPDATE SET
        threat_tag        = CASE WHEN app.network_tags.threat_tag = 'FALSE_POSITIVE'
                              THEN app.network_tags.threat_tag ELSE 'THREAT' END,
        threat_confidence = EXCLUDED.threat_confidence,
        notes             = EXCLUDED.notes,
        tags              = CASE
                              WHEN COALESCE(app.network_tags.tags, '[]'::jsonb) @> '["surveillance"]'::jsonb
                                THEN app.network_tags.tags
                              ELSE COALESCE(app.network_tags.tags, '[]'::jsonb) || EXCLUDED.tags
                            END,
        updated_at        = NOW()
      WHERE NOT COALESCE(app.network_tags.is_ignored, false)
      `,
      [bssids, confidences, deviceTypes, methods, deviceTypes]
    );

    taggedCount = tagResult.rowCount ?? 0;
    logger.info(`[Surveillance Scan] Tagged ${taggedCount} networks in network_tags`);
  }

  // Phase 5: Refresh materialized view
  try {
    await adminQuery('REFRESH MATERIALIZED VIEW CONCURRENTLY app.surveillance_density_zones');
    logger.info('[Surveillance Scan] Refreshed surveillance_density_zones MV');
  } catch (err: any) {
    logger.warn('[Surveillance Scan] Could not refresh surveillance_density_zones MV', {
      message: err?.message,
    });
  }

  return { detectionCount: upsertedCount, taggedCount, falsePositiveCount: fpCount };
};

export { runBackupJob, runBehavioralMlScoringJob, runSiblingDetectionJob, runSurveillanceScanJob };
