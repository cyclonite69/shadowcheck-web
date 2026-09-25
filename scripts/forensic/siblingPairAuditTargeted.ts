/**
 * Forensic audit for explicit PAS/MDT (or any) sibling pairs — simulates refresh pipeline stages.
 * Uses the EXACT production SQL path in READ-ONLY mode.
 *
 * Usage: DB_HOST=127.0.0.1 npx tsx scripts/forensic/siblingPairAuditTargeted.ts
 */
import '../../server/src/config/loadEnv';
import secretsManager from '../../server/src/services/secretsManager';
import { buildRefreshChunkSql } from '../../server/src/services/admin/siblingDetectionQueries';
import { SIBLING_DETECTION_DEFAULTS } from '../../server/src/services/admin/siblingDetectionConstants';
import { forensicQuery } from '../../server/src/services/adminDbService';

const TARGET_BSSIDS = [
  '00:14:3E:1F:DE:30', // PAS 1
  '00:14:3E:1F:DE:31', // PAS 2
  '00:14:3E:68:5F:60', // MDT 1
  '00:14:3E:68:5F:61', // MDT 2
];

async function main(): Promise<void> {
  process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
  await secretsManager.load();

  console.log(
    `[FORENSIC_TARGETED] Starting targeted forensic audit of ${TARGET_BSSIDS.length} BSSIDs`
  );
  console.log(
    '[FORENSIC_TARGETED] Enforcing READ ONLY transaction safety and production-parity logic'
  );

  const refreshChunkSql = buildRefreshChunkSql({
    pairAudit: true,
    readOnly: true,
    targetBssids: true,
  });

  const result = await forensicQuery(refreshChunkSql, [
    100, // $1: batchSize
    null, // $2: cursor
    SIBLING_DETECTION_DEFAULTS.MAX_OCTET_DELTA, // $3: maxOctetDelta
    SIBLING_DETECTION_DEFAULTS.MAX_DISTANCE_M, // $4: maxDistanceM
    SIBLING_DETECTION_DEFAULTS.CONFIDENCE_THRESHOLD, // $5: confidenceThreshold
    false, // $6: incremental
    null, // $7: incrementalCutoff
    null, // $8: runId (Read-only)
    TARGET_BSSIDS, // $9: targetBssids
  ]);

  const row = result.rows[0] as {
    seed_count: number;
    upserted_count: number;
    debug_audit_events: Array<Record<string, unknown>>;
  };

  console.log(`\n[RESULT] Seeds Found: ${row.seed_count}`);
  console.log(`[RESULT] Potential Upserts (Simulated): ${row.upserted_count}`);

  const events = row.debug_audit_events || [];
  console.log(`[RESULT] Forensic Audit Events: ${events.length}`);

  if (events.length > 0) {
    events.forEach((ev, idx) => {
      console.log(`\n--- EVENT ${idx + 1}: ${ev.bssid1} <-> ${ev.bssid2} ---`);
      console.log(`    SSIDs:    ${ev.ssid1} / ${ev.ssid2}`);
      console.log(`    Winner:   ${ev.final_rule} @ ${ev.incoming_confidence}`);

      if (ev.prev_persisted_rule) {
        console.log(`    Previous: ${ev.prev_persisted_rule} @ ${ev.prev_persisted_confidence}`);
        if (ev.would_downgrade_confidence) {
          console.log('    WARNING: Incoming confidence is LOWER than persisted!');
        }
        if (ev.would_replace_deterministic_with_probabilistic) {
          console.log('    WARNING: Deterministic rule would be REPLACED by probabilistic!');
        }
      }

      if (ev.top_two_hits_confidence_tie) {
        console.log('    STABILITY: Top two hits have equal confidence (Tie-breaker applied)');
      }

      if (Array.isArray(ev.competing_hits)) {
        console.log('    Competing Hits:');
        ev.competing_hits.forEach((h: any) => {
          console.log(`      - ${h.rule}: ${h.confidence} (${h.target_ssid} / ${h.sibling_ssid})`);
        });
      }
    });
  }

  console.log('\n[FORENSIC_TARGETED] Audit complete (ZERO mutations executed)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
