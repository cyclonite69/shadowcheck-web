/**
 * Pure utility functions for Network Detail Lookup (WigleDetailTab).
 * Extracted for independent testability.
 */

// ─── Temporal summary ─────────────────────────────────────────────────────────

export interface ObservationTemporalSummary {
  firstSeen: string | null;
  lastSeen: string | null;
  selectedSeen: string | null;
  observationCount: number;
}

/**
 * Compute aggregate first/last seen from a list of observations plus an
 * optional selected observation.  Timestamps that are null or produce an
 * invalid Date are silently ignored.
 *
 * selectedSeen is ONLY the currently-selected observation's timestamp and must
 * never overwrite firstSeen / lastSeen.
 */
export function computeTemporalSummary(
  observations: Array<{ observed_at?: string | null }>,
  selectedObsTimestamp: string | null | undefined,
  dataFirstSeen?: string | null,
  dataLastSeen?: string | null
): ObservationTemporalSummary {
  const valid: number[] = [];

  for (const obs of observations) {
    const ts = obs.observed_at;
    if (!ts) {
      continue;
    }
    const ms = new Date(ts).getTime();
    if (!isNaN(ms)) {
      valid.push(ms);
    }
  }

  // Also fold in data.firstSeen / data.lastSeen so the summary is correct even
  // when no individual observations have been loaded yet.
  if (dataFirstSeen) {
    const ms = new Date(dataFirstSeen).getTime();
    if (!isNaN(ms)) {
      valid.push(ms);
    }
  }
  if (dataLastSeen) {
    const ms = new Date(dataLastSeen).getTime();
    if (!isNaN(ms)) {
      valid.push(ms);
    }
  }

  const firstSeen = valid.length > 0 ? new Date(Math.min(...valid)).toISOString() : null;
  const lastSeen = valid.length > 0 ? new Date(Math.max(...valid)).toISOString() : null;

  const selectedMs = selectedObsTimestamp ? new Date(selectedObsTimestamp).getTime() : NaN;
  const selectedSeen = selectedObsTimestamp && !isNaN(selectedMs) ? selectedObsTimestamp : null;

  return { firstSeen, lastSeen, selectedSeen, observationCount: observations.length };
}

// ─── SSID display ─────────────────────────────────────────────────────────────

/** Markers that indicate a hidden/empty SSID. Case-insensitive. */
const HIDDEN_MARKERS = new Set(['(hidden)', 'hidden', '', '(blank)', '\\x00']);

export interface SsidDisplaySummary {
  canonicalSsid: string | null;
  observedSsid: string | null;
  displayTitle: string;
  isHiddenCanonical: boolean;
}

export function isHiddenSsid(ssid: string | null | undefined): boolean {
  if (ssid === null || ssid === undefined) {
    return true;
  }
  return HIDDEN_MARKERS.has(ssid.trim().toLowerCase());
}

/**
 * Build an SSID display summary that surfaces an observed SSID when the
 * canonical network SSID is hidden.
 *
 * canonicalSsid: from data.ssid / data.name (the stored WiGLE network record)
 * observedSsid: from selectedObs.ssid or best ssid across observation rows
 */
export function computeSsidDisplaySummary(
  canonicalSsid: string | null | undefined,
  observedSsid: string | null | undefined
): SsidDisplaySummary {
  const canonical = isHiddenSsid(canonicalSsid) ? null : (canonicalSsid ?? null);
  const observed = isHiddenSsid(observedSsid) ? null : (observedSsid ?? null);

  const isHiddenCanonical = canonical === null;

  // displayTitle: prefer canonical; fall back to observed; then literal "(hidden)"
  const displayTitle = canonical ?? observed ?? '(hidden)';

  return {
    canonicalSsid: canonical,
    observedSsid: observed,
    displayTitle,
    isHiddenCanonical,
  };
}

/**
 * Find the best observed SSID from a list of observation rows.
 * Returns the first non-hidden SSID found, or null.
 */
export function bestObservedSsid(
  observations: Array<{ ssid?: string | null }>,
  selectedObsSsid?: string | null
): string | null {
  // Selected observation takes priority
  if (!isHiddenSsid(selectedObsSsid)) {
    return selectedObsSsid ?? null;
  }
  for (const obs of observations) {
    if (!isHiddenSsid(obs.ssid)) {
      return obs.ssid ?? null;
    }
  }
  return null;
}
