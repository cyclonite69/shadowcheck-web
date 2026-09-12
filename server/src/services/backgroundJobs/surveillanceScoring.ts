import type {
  CandidateRow,
  ScoredDetection,
} from '../../repositories/surveillanceDetectionRepository';

// --- Impact factors by device type (SURVEILLANCE_DEVICE_SIGNATURES.md §5.3) ---

const IMPACT_FACTORS: Record<string, number> = {
  FLOCK_SAFETY_CAMERA: 1.2,
  RAVEN_GUNSHOT_DETECTOR: 1.2,
  SHOTSPOTTER_SENSOR: 1.2,
  FS_EXT_BATTERY: 1.0,
  AXON_BODY_CAMERA: 1.0,
  MOTOROLA_BWC: 1.0,
  AXON_SIGNAL_PERIPHERAL: 1.1,
  BT_IMAGING_DEVICE: 0.9,
  DEI_BWC: 1.0,
  DASHCAM: 1.0,
  RESIDENTIAL_CAMERA: 0.8,
};

// --- Match quality bonuses (§5.2) ---

const MATCH_QUALITY_BONUS: Record<string, number> = {
  EXACT: 0.15,
  STRONG: 0.1,
  PARTIAL: 0.0,
  WEAK: -0.1,
  HEURISTIC: -0.2,
};

// --- False positive patterns ---
// Auto-flagged: clearly wrong identifications
const AUTO_FP_PATTERNS: Array<{ pattern: RegExp; reason: string; ouiRestrict?: string }> = [
  {
    pattern: /^PAS-RIG/i,
    reason: 'Cradlepoint AirLink ambulance router (PAS-RIG)',
    ouiRestrict: '08:3A:88',
  },
  {
    pattern: /^PAS-\d{3}$/i,
    reason: 'Cradlepoint AirLink ambulance router (PAS-NNN)',
    ouiRestrict: '08:3A:88',
  },
  { pattern: /^ClickShare/i, reason: 'Barco ClickShare wireless presentation device' },
  { pattern: /^CFGF.*Board/i, reason: 'Conference room access point' },
  { pattern: /^Insignia-/i, reason: 'Insignia consumer electronics (Best Buy brand)' },
  { pattern: /^DIRECT-/i, reason: 'WiFi Direct consumer device' },
  { pattern: /^HP-Print/i, reason: 'HP printer' },
  { pattern: /^Fanvil(?:\s|$)/i, reason: 'Fanvil VoIP phone' },
  { pattern: /^Yealink(?:\s|$)/i, reason: 'Yealink VoIP phone' },
  { pattern: /^Canon(?:\s|[-_])/i, reason: 'Canon printer' },
  { pattern: /^Chromecast/i, reason: 'Google Chromecast' },
];

// Confidence penalty patterns: ambiguous devices that get penalized but NOT auto-flagged
const PENALTY_PATTERNS: Array<{ pattern: RegExp; penalty: number; reason: string }> = [
  {
    pattern: /^WS-RV55/i,
    penalty: -0.15,
    reason: 'Cradlepoint RV55 — could be Flock or fleet, needs manual review',
  },
  { pattern: /^AirLink/i, penalty: -0.15, reason: 'Sierra Wireless AirLink — ambiguous use case' },
];

function checkAutoFalsePositive(
  ssid: string | null,
  oui: string
): { isFP: boolean; reason: string | null } {
  if (!ssid) return { isFP: false, reason: null };

  for (const fp of AUTO_FP_PATTERNS) {
    if (fp.ouiRestrict && oui.toUpperCase() !== fp.ouiRestrict.toUpperCase()) continue;
    if (fp.pattern.test(ssid)) {
      return { isFP: true, reason: fp.reason };
    }
  }
  return { isFP: false, reason: null };
}

function checkPenaltyPattern(ssid: string | null): { penalty: number; reason: string | null } {
  if (!ssid) return { penalty: 0, reason: null };

  for (const pp of PENALTY_PATTERNS) {
    if (pp.pattern.test(ssid)) {
      return { penalty: pp.penalty, reason: pp.reason };
    }
  }
  return { penalty: 0, reason: null };
}

interface ConfidenceAdjustment {
  factor: string;
  value: number;
}

/**
 * Scores surveillance candidates using the multi-factor confidence model
 * defined in SURVEILLANCE_DEVICE_SIGNATURES.md sections 5.1–5.5 and 6.5.
 *
 * Input: all candidate rows (multiple per bssid, one per tier hit).
 * Output: one scored detection per bssid.
 */
function scoreSurveillanceCandidates(rows: CandidateRow[]): ScoredDetection[] {
  const grouped = new Map<string, CandidateRow[]>();
  for (const row of rows) {
    const existing = grouped.get(row.bssid);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(row.bssid, [row]);
    }
  }

  const results: ScoredDetection[] = [];

  for (const [bssid, hits] of grouped) {
    const best = hits[0]; // ordered by priority ASC, base_likelihood DESC
    const oui = bssid.substring(0, 8);
    const adjustments: ConfidenceAdjustment[] = [];

    let baseConfidence = best.base_likelihood / 100;

    // --- RSSI adjustments (§5.2) ---
    const rssi = best.bestlevel;
    if (rssi !== null && rssi !== undefined) {
      if (rssi > -50) {
        adjustments.push({ factor: 'rssi_excellent', value: 0.1 });
      } else if (rssi > -60) {
        adjustments.push({ factor: 'rssi_good', value: 0.05 });
      } else if (rssi < -90) {
        adjustments.push({ factor: 'rssi_very_weak', value: -0.2 });
      } else if (rssi < -80) {
        adjustments.push({ factor: 'rssi_weak', value: -0.1 });
      }
    }

    // --- Temporal persistence ---
    const obsCount = Number(best.obs_count) || 0;
    const durationSec = Number(best.duration_seconds) || 0;
    const uniqueDays = Number(best.unique_days) || 0;

    if (obsCount > 3 || durationSec > 300) {
      adjustments.push({ factor: 'persistence_strong', value: 0.2 });
    } else if (obsCount === 1 && durationSec < 30) {
      adjustments.push({ factor: 'single_detection', value: -0.2 });
    }

    // --- Multi-surface corroboration ---
    const tierHitCount = Number(best.tier_hit_count) || 1;
    const uniqueMethods = new Set(hits.map((h) => h.detection_method));

    if (tierHitCount >= 2) {
      adjustments.push({ factor: 'multi_indicator', value: 0.2 });
    } else if (best.match_quality === 'WEAK') {
      adjustments.push({ factor: 'single_weak_indicator', value: -0.3 });
    }

    // --- Cross-protocol correlation (§6.5) ---
    const hitTypes = new Set(hits.map((h) => h.type));
    const hasWifi = hitTypes.has('W');
    const hasBle = hitTypes.has('E') || hitTypes.has('B');
    if (hasWifi && hasBle) {
      adjustments.push({ factor: 'cross_protocol_wifi_ble', value: 0.3 });
    }

    // --- Match quality bonus ---
    const bestMatchQuality = best.match_quality || 'PARTIAL';
    const mqBonus = MATCH_QUALITY_BONUS[bestMatchQuality] ?? 0;
    if (mqBonus !== 0) {
      adjustments.push({
        factor: `match_quality_${bestMatchQuality.toLowerCase()}`,
        value: mqBonus,
      });
    }

    // --- False positive check ---
    const { isFP, reason: fpReason } = checkAutoFalsePositive(best.ssid, oui);
    let falsePositive = false;
    let fpReasonFinal: string | null = null;
    const deviceType = best.device_type;

    if (isFP) {
      adjustments.push({ factor: 'false_positive_pattern', value: -0.5 });
      falsePositive = true;
      fpReasonFinal = fpReason;
    }

    // --- Penalty patterns (ambiguous, not auto-FP) ---
    const { penalty, reason: penaltyReason } = checkPenaltyPattern(best.ssid);
    if (penalty !== 0 && penaltyReason) {
      adjustments.push({ factor: 'ambiguous_pattern', value: penalty });
    }

    const isStationary =
      Number(best.unique_positions) === 1 && (obsCount > 3 || durationSec > 300);
    if (isStationary && deviceType !== 'RESIDENTIAL_CAMERA') {
      adjustments.push({ factor: 'stationary_signature_penalty', value: -0.6 });
    }

    // --- Compute final confidence ---
    const totalAdj = adjustments.reduce((sum, a) => sum + a.value, 0);
    const confidence = Math.max(0.1, Math.min(1.0, baseConfidence + totalAdj));
    const roundedConfidence = Math.round(confidence * 100) / 100;

    // --- Impact factor (§5.3) ---
    const impactFactor = IMPACT_FACTORS[deviceType] ?? 1.0;

    // --- Cross-domain multiplier (§6.5) ---
    let crossMultiplier = 1.0;
    const hasOuiHit = hits.some(
      (h) => h.detection_method === 'oui_match' || h.detection_method === 'multi_signal'
    );
    const hasSsidHit = hits.some(
      (h) => h.detection_method === 'ssid_pattern' || h.detection_method === 'ssid_exact'
    );
    const hasBleHit = hits.some(
      (h) => h.detection_method === 'mfgrid_match' || h.detection_method === 'ble_name_pattern'
    );

    if (hasOuiHit && hasBleHit) crossMultiplier = Math.max(crossMultiplier, 1.3);
    else if (hasOuiHit && hasSsidHit) crossMultiplier = Math.max(crossMultiplier, 1.1);

    // --- Final threat score ---
    const rawScore = best.base_likelihood * impactFactor * roundedConfidence * crossMultiplier;
    const threatScore = Math.min(100.0, Math.round(rawScore * 10) / 10);

    // --- Determine primary detection method ---
    let detectionMethod = best.detection_method;
    if (uniqueMethods.size > 1) {
      detectionMethod = Array.from(uniqueMethods).join('+');
    }

    // --- Build enriched matched_signals ---
    const matchedSignals: Record<string, any> = {
      tiers_hit: hits.map((h) => ({
        tier: h.priority,
        method: h.detection_method,
        match_quality: h.match_quality,
        base_likelihood: h.base_likelihood,
        signals: h.matched_signals,
      })),
      observation_stats: {
        obs_count: obsCount,
        unique_days: uniqueDays,
        min_rssi: best.min_rssi,
        max_rssi: best.max_rssi,
        avg_rssi: best.avg_rssi !== null ? Number(best.avg_rssi) : null,
        duration_seconds: durationSec,
        unique_positions: Number(best.unique_positions) || 0,
        first_seen: best.first_seen,
        last_seen: best.last_seen,
      },
      confidence_adjustments: adjustments,
      impact_factor: impactFactor,
      cross_multiplier: crossMultiplier,
      match_quality: bestMatchQuality,
      scoring_version: '2.0',
    };

    if (penaltyReason) {
      matchedSignals.ambiguous_note = penaltyReason;
    }

    if (best.type === 'W' && deviceType === 'FLOCK_SAFETY_CAMERA') {
      continue;
    }

    results.push({
      bssid,
      device_type: deviceType,
      confidence: roundedConfidence,
      threat_score: threatScore,
      detection_method: detectionMethod,
      matched_signals: matchedSignals,
      false_positive: falsePositive,
      fp_reason: fpReasonFinal,
    });
  }

  return results;
}

export {
  scoreSurveillanceCandidates,
  IMPACT_FACTORS,
  MATCH_QUALITY_BONUS,
  AUTO_FP_PATTERNS,
  PENALTY_PATTERNS,
};
