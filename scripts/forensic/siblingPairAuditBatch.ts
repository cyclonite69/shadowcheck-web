/**
 * One-batch sibling refresh with PAIR_AUDIT forensic output (stdout JSON).
 * Validates deterministic dedup stability and ON CONFLICT guard effectiveness.
 *
 * Usage (from repo root):
 *   DB_HOST=127.0.0.1 SIBLING_REFRESH_PAIR_AUDIT=1 npx tsx scripts/forensic/siblingPairAuditBatch.ts
 *
 * This script is READ-ONLY by default and enforces READ ONLY transaction safety.
 */
import '../../server/src/config/loadEnv';
import secretsManager from '../../server/src/services/secretsManager';
import { buildRefreshChunkSql } from '../../server/src/services/admin/siblingDetectionQueries';
import { SIBLING_DETECTION_DEFAULTS } from '../../server/src/services/admin/siblingDetectionConstants';
import { forensicQuery } from '../../server/src/services/adminDbService';

type AuditEvent = Record<string, unknown>;

function isPasMdtEvent(ev: AuditEvent): boolean {
  const s1 = String(ev.ssid1 ?? '').toLowerCase();
  const s2 = String(ev.ssid2 ?? '').toLowerCase();
  return (
    s1.includes('pas') ||
    s2.includes('pas') ||
    s1.includes('mdt') ||
    s2.includes('mdt') ||
    s1 === 'pasrig' ||
    s2 === 'pasrig'
  );
}

function classify(ev: AuditEvent): string[] {
  const tags: string[] = [];
  if (ev.would_downgrade_confidence) {
    tags.push('A_overwrite_downgrade');
  }
  if (ev.would_replace_deterministic_with_probabilistic) {
    tags.push('A_deterministic_to_probabilistic');
  }
  if (ev.top_two_hits_confidence_tie) {
    tags.push('B_dedup_tie');
  }
  if (ev.would_hide_from_effective_view_cutoff) {
    tags.push('C_effective_view_hiding');
  }
  return tags;
}

async function verifyPair(b1: string, b2: string): Promise<void> {
  const ordered = b1 < b2 ? [b1, b2] : [b2, b1];
  const [x, y] = ordered;

  const fsr = await forensicQuery(
    `SELECT * FROM app.find_sibling_radios($1::text, $3, $4)
     WHERE upper(sibling_bssid) = upper($2::text)
     UNION ALL
     SELECT * FROM app.find_sibling_radios($2::text, $3, $4)
     WHERE upper(sibling_bssid) = upper($1::text)`,
    [x, y, SIBLING_DETECTION_DEFAULTS.MAX_OCTET_DELTA, SIBLING_DETECTION_DEFAULTS.MAX_DISTANCE_M]
  );

  const pair = await forensicQuery(
    `SELECT bssid1, bssid2, rule, confidence, source, pair_strength,
            corroborating_rules, computed_at, run_id, ssid1, ssid2
     FROM app.network_sibling_pairs WHERE bssid1 = $1 AND bssid2 = $2`,
    [x, y]
  );

  const eff = await forensicQuery(
    `SELECT bssid1, bssid2, rule, confidence, source, pair_strength
     FROM app.network_siblings_effective WHERE bssid1 = $1 AND bssid2 = $2`,
    [x, y]
  );

  console.log('\n--- DIRECT VERIFICATION', x, y, '---');
  console.log('find_sibling_radios:', JSON.stringify(fsr.rows, null, 2));
  console.log('network_sibling_pairs:', JSON.stringify(pair.rows, null, 2));
  console.log('network_siblings_effective:', JSON.stringify(eff.rows, null, 2));
}

async function main(): Promise<void> {
  process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
  await secretsManager.load();

  console.log('[FORENSIC_START] Audit mode enabled, enforcing READ ONLY transaction safety');

  const refreshChunkSql = buildRefreshChunkSql({
    pairAudit: true,
    readOnly: true,
  });

  const result = await forensicQuery(refreshChunkSql, [
    SIBLING_DETECTION_DEFAULTS.BATCH_SIZE, // $1: batchSize
    null, // $2: cursor
    SIBLING_DETECTION_DEFAULTS.MAX_OCTET_DELTA, // $3: maxOctetDelta
    SIBLING_DETECTION_DEFAULTS.MAX_DISTANCE_M, // $4: maxDistanceM
    SIBLING_DETECTION_DEFAULTS.CONFIDENCE_THRESHOLD, // $5: confidenceThreshold
    false, // $6: incremental
    null, // $7: incrementalCutoff
    null, // $8: runId (Read-only)
  ]);

  const row = result.rows[0] as {
    seed_count: number;
    upserted_count: number;
    next_cursor: string | null;
    debug_audit_events: unknown;
  };
  console.log(
    `[BATCH_RESULT] Seeds: ${row.seed_count}, Upserted (Simulated): ${row.upserted_count}, NextCursor: ${row.next_cursor}`
  );

  const debugEvents = row.debug_audit_events;
  const eventList = Array.isArray(debugEvents) ? debugEvents : debugEvents ? [debugEvents] : [];

  console.log(`\n[AUDIT_EVENTS] Total: ${eventList.length}`);

  const regressionEvents = eventList.filter((ev) => {
    const tags = classify(ev);
    return tags.length > 0;
  });

  if (regressionEvents.length > 0) {
    console.log(`\n[REGRESSION_DETECTED] ${regressionEvents.length} problematic events:`);
    regressionEvents.forEach((ev, idx) => {
      const tags = classify(ev);
      console.log(`  ${idx + 1}. [${tags.join(',')}] ${ev.bssid1} <-> ${ev.bssid2}`);
      if (ev.would_downgrade_confidence) {
        console.log(`     DOWNGRADE: ${ev.prev_persisted_confidence} → ${ev.incoming_confidence}`);
      }
      if (ev.would_replace_deterministic_with_probabilistic) {
        console.log(`     RULE_CHANGE: ${ev.prev_persisted_rule} → ${ev.final_rule}`);
      }
    });
  } else {
    console.log(
      '[REGRESSION_CHECK_PASSED] No downgrades, rule replacements, or tie instability detected'
    );
  }

  const pasMdtEvents = eventList.filter(isPasMdtEvent);
  if (pasMdtEvents.length > 0) {
    console.log(`\n[PAS_MDT_TRACKING] Found ${pasMdtEvents.length} PAS/MDT related events:`);
    pasMdtEvents.forEach((ev) => {
      const tags = classify(ev);
      console.log(`  ${ev.bssid1} <-> ${ev.bssid2} [${tags.join(',')}]`);
      console.log(`    SSIDs: ${ev.ssid1} / ${ev.ssid2}`);
      console.log(`    Incoming: ${ev.final_rule} @ ${ev.incoming_confidence}`);
      if (ev.prev_persisted_rule) {
        console.log(`    Previous: ${ev.prev_persisted_rule} @ ${ev.prev_persisted_confidence}`);
      }
    });

    const pasMdt = pasMdtEvents as AuditEvent[];
    const pickPas = pasMdt.find((ev) =>
      String(ev.ssid1 ?? ev.ssid2 ?? '')
        .toLowerCase()
        .includes('pas')
    );
    const pickMdt = pasMdt.find((ev) =>
      String(ev.ssid1 ?? ev.ssid2 ?? '')
        .toLowerCase()
        .includes('mdt')
    );

    if (pickPas) {
      await verifyPair(String(pickPas.bssid1), String(pickPas.bssid2));
    }
    if (pickMdt) {
      await verifyPair(String(pickMdt.bssid1), String(pickMdt.bssid2));
    }
  }

  console.log('\n[BATCH_END] Forensic audit complete (ZERO mutations executed)');
}

main().catch((e) => {
  console.error('[ERROR]', e);
  process.exit(1);
});
