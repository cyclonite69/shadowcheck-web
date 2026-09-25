import logger from '../../../../logging/logger';
import { buildRefreshChunkSql } from '../../siblingDetectionQueries';
import {
  normalizeOptions,
  state,
  type SiblingRefreshOptions,
  type SiblingRefreshResult,
} from '../../siblingDetectionState';
import { EXTRA_SIBLING_RULES, type SiblingExtraRuleDefinition } from '../rules/extraRules';
import { adminQuery, longRunningAdminQuery } from '../adminQueryAdapter';
import { SiblingRunRepository } from '../../../../repositories/siblingRunRepository';
import { SiblingPruningRepository } from '../../../../repositories/siblingPruningRepository';

type SiblingDetectionOrchestratorDeps = {
  adminQuery: typeof adminQuery;
  longRunningAdminQuery: typeof longRunningAdminQuery;
  normalizeOptions: typeof normalizeOptions;
  state: typeof state;
  extraRules: SiblingExtraRuleDefinition[];
  siblingRunRepository: SiblingRunRepository;
  siblingPruningRepository: SiblingPruningRepository;
};

const defaultDeps: SiblingDetectionOrchestratorDeps = {
  adminQuery,
  longRunningAdminQuery,
  normalizeOptions,
  state,
  extraRules: EXTRA_SIBLING_RULES,
  siblingRunRepository: new SiblingRunRepository(),
  siblingPruningRepository: new SiblingPruningRepository(),
};

/**
 * Coordinates the sibling refresh batch lifecycle, including chunked refresh,
 * extra rule execution, run bookkeeping, and progress updates.
 */
export class SiblingDetectionOrchestrator {
  constructor(private readonly deps: SiblingDetectionOrchestratorDeps = defaultDeps) {}

  /**
   * Execute a full sibling refresh run and return the persisted result summary.
   */
  async runRefreshJob(options: SiblingRefreshOptions = {}): Promise<SiblingRefreshResult> {
    const normalized = this.deps.normalizeOptions(options);
    const started = Date.now();
    const targetBssids = options.targetBssids;
    const hasTargets = Array.isArray(targetBssids) && targetBssids.length > 0;

    if (hasTargets) {
      normalized.incremental = false;
    }

    const runMode = hasTargets
      ? 'test'
      : normalized.maxBatches !== null
        ? 'test'
        : normalized.incremental
          ? 'incremental'
          : 'full';

    const runId = await this.deps.siblingRunRepository.createRun(runMode, normalized);

    if (hasTargets) {
      const noteText = options.notes || `Targeted run on ${targetBssids!.length} BSSIDs`;
      await this.deps.adminQuery('UPDATE app.sibling_runs SET notes = $1 WHERE id = $2', [
        noteText,
        runId,
      ]);
      logger.info(
        `[Siblings] Starting targeted run on ${targetBssids!.length} BSSIDs (runId: ${runId})`
      );
    }

    const incrementalCutoff = await this.deps.siblingRunRepository.getPreviousRunCutoff();

    let cursor: string | null = null;
    let batchesRun = 0;
    let seedsProcessed = 0;
    let rowsUpserted = 0;
    let completed = true;

    const pairAudit =
      process.env.SIBLING_REFRESH_PAIR_AUDIT === '1' ||
      process.env.SIBLING_REFRESH_PAIR_AUDIT === 'true';
    const refreshChunkSql = buildRefreshChunkSql({ pairAudit, targetBssids: hasTargets });

    while (true) {
      if (this.deps.state.cancelRequested) {
        completed = false;
        logger.info('[Siblings] Cancel requested — stopping batch loop');
        break;
      }
      if (normalized.maxBatches !== null && batchesRun >= normalized.maxBatches) {
        completed = false;
        break;
      }

      const queryParams: any[] = [
        normalized.batchSize,
        cursor,
        normalized.maxOctetDelta,
        normalized.maxDistanceM,
        normalized.minCandidateConf,
        normalized.incremental,
        incrementalCutoff,
        runId,
      ];
      if (hasTargets) {
        queryParams.push(targetBssids);
      }

      const result: any = await this.deps.longRunningAdminQuery(refreshChunkSql, queryParams);

      const row = result.rows[0] || {};
      const seedCount = Number(row.seed_count || 0);
      const upsertedCount = Number(row.upserted_count || 0);
      const nextCursor = row.next_cursor || null;

      if (pairAudit) {
        const events = row.debug_audit_events;
        const list = Array.isArray(events) ? events : events ? [events] : [];
        if (list.length > 0) {
          logger.info('[Siblings][PAIR_AUDIT] batch forensic snapshot', {
            siblingRunId: runId,
            batch: batchesRun + 1,
            eventCount: list.length,
            events: list,
          });
        }
      }

      if (seedCount === 0) {
        if (!cursor || cursor >= 'FF:FF:FF:FF:FF:FF') {
          break;
        }
        break;
      }

      batchesRun += 1;
      seedsProcessed += seedCount;
      rowsUpserted += upsertedCount;
      cursor = nextCursor;

      this.deps.state.progress = {
        batchesRun,
        seedsProcessed,
        rowsUpserted,
        lastCursor: cursor,
      };

      if (batchesRun % 10 === 0) {
        logger.info('[Siblings] Batch progress', {
          batchesRun,
          seedsProcessed,
          rowsUpserted,
          lastCursor: cursor,
        });
      }
    }

    const extraRuleResults = await this.runExtraRules(runId);

    // Enforce Criteria 3: Check for hardware overflow (>= 17 connected nodes)
    const overflowCheck = await this.deps.siblingPruningRepository.checkHardwareOverflow();

    if (overflowCheck.length > 0) {
      for (const row of overflowCheck) {
        logger.warn(
          `[HARDWARE OVERFLOW - INVESTIGATE] Cluster OUI ${row.oui} with SSID "${row.ssid}" has ${row.node_count} connected nodes. Dropping from active sibling tracking.`
        );
      }

      await this.deps.siblingPruningRepository.pruneHardwareOverflow();
    }

    // Enforce 16-Node Connected Component Ceiling for sequential rules (Class A/B/C and legacy sequential)
    const sequentialOverflowCheck =
      await this.deps.siblingPruningRepository.checkSequentialOverflow();

    if (sequentialOverflowCheck.length > 0) {
      for (const row of sequentialOverflowCheck) {
        logger.warn(
          `[HARDWARE OVERFLOW - INVESTIGATE] Connected component starting at BSSID ${row.component_id} for rule "${row.rule}" has ${row.node_count} connected nodes. Dropping this component from active sibling tracking.`
        );
      }

      const prunedCount = await this.deps.siblingPruningRepository.pruneSequentialOverflow();

      logger.info(
        `[Siblings] Component-level pruning complete. Pruned ${sequentialOverflowCheck.length} overflowing components, deleting ${prunedCount} exact overflow edges.`
      );
    }

    logger.info('[Siblings] Extra rules complete', extraRuleResults);

    const finalStatus = completed ? 'completed' : 'truncated';
    await this.deps.siblingRunRepository.completeRun(runId, finalStatus, {
      seedsProcessed,
      rowsUpserted,
      // TODO: SiblingDetectionOrchestrator does not currently track updates separately from inserts.
      // SQL CTE only returns upserted_count representing both inserts and updates. Using 0 as placeholder.
      rowsUpdated: 0,
    });

    await this.deps.longRunningAdminQuery('SELECT app.refresh_oui_sibling_profiles()');
    logger.info('[Siblings] OUI sibling profiles refreshed');

    // Run ANALYZE on network sibling pairs and networks to refresh stats
    await this.deps.longRunningAdminQuery('ANALYZE app.network_sibling_pairs');
    await this.deps.longRunningAdminQuery('ANALYZE app.networks');
    logger.info('[Siblings] Database stats analyzed for networks and sibling pairs');

    // Refresh the materialized view for sibling groups
    try {
      logger.info('[Siblings] Refreshing app.mv_sibling_groups...');
      await this.deps.longRunningAdminQuery(
        'REFRESH MATERIALIZED VIEW CONCURRENTLY app.mv_sibling_groups'
      );
      logger.info('[Siblings] Refreshed app.mv_sibling_groups');
    } catch (err: any) {
      logger.error('[Siblings] Failed to refresh app.mv_sibling_groups:', err?.message);
    }

    return {
      success: true,
      batchesRun,
      seedsProcessed,
      rowsUpserted,
      lastCursor: cursor,
      executionTimeMs: Date.now() - started,
      completed,
      sibling_run_id: runId,
    };
  }

  private async runExtraRules(runId: number) {
    const results: Record<string, number> = {};

    for (const rule of this.deps.extraRules) {
      results[rule.logKey] = await this.runExtraRule(rule, runId);
    }

    return results;
  }

  private async runExtraRule(rule: SiblingExtraRuleDefinition, runId: number) {
    try {
      const params = rule.includeRunId ? [runId] : [];
      const res: any = await this.deps.longRunningAdminQuery(rule.query, params);
      return Number(res.rows[0]?.count || 0);
    } catch (err: any) {
      logger.error(`[Siblings] Extra rule ${rule.name} failed:`, { error: err?.message });
      return 0;
    }
  }
}
