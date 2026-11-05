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

/**
 * Safely extracts a readable error message from a WiGLE API response or error object.
 * Prevents [object Object] by properly inspecting string errors, structured error objects,
 * nested error bodies, and fallback messages.
 */
export function extractDetailErrorMessage(
  response: unknown,
  fallback = 'Failed to fetch WiGLE detail'
): string {
  if (!response) {
    return fallback;
  }

  if (typeof response === 'string') {
    const trimmed = response.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (typeof response !== 'object') {
    return String(response);
  }

  const res = response as Record<string, any>;

  // Check top-level message if response is an Error instance
  if (
    response instanceof Error &&
    response.message &&
    !response.message.startsWith('[object Object]')
  ) {
    return response.message;
  }

  // Check details field (often a plain string explanation)
  if (typeof res.details === 'string' && res.details.trim().length > 0) {
    return res.details.trim();
  }

  // Check error property
  if (res.error) {
    if (typeof res.error === 'string' && res.error.trim().length > 0) {
      return res.error.trim();
    }
    if (typeof res.error === 'object' && res.error !== null) {
      const errObj = res.error;
      if (typeof errObj.message === 'string' && errObj.message.trim().length > 0) {
        return errObj.message.trim();
      }
      if (typeof errObj.error === 'string' && errObj.error.trim().length > 0) {
        return errObj.error.trim();
      }
      if (typeof errObj.code === 'string' && errObj.code.trim().length > 0) {
        return errObj.code.trim();
      }
      try {
        const str = JSON.stringify(errObj);
        if (str && str !== '{}') {
          return str;
        }
      } catch {
        // ignore circular json
      }
    }
  }

  // Check top-level message
  if (typeof res.message === 'string' && res.message.trim().length > 0) {
    return res.message.trim();
  }

  // Check top-level code or status
  if (typeof res.code === 'string' && res.code.trim().length > 0) {
    return res.code.trim();
  }

  return fallback;
}

/**
 * Validates whether an identifier string is a valid Wi-Fi/Bluetooth MAC or cellular ID.
 * Accepts:
 * - Colon-separated MAC: 00:11:22:33:44:55
 * - Hyphen-separated MAC: 00-11-22-33-44-55
 * - Raw 12-char hex: 001122334455
 * - Cellular network/cell identifier: 3 to 64 alphanumeric, colon, hyphen, or underscore characters.
 */
const MAC_COLON_PATTERN = /^(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const MAC_HYPHEN_PATTERN = /^(?:[0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/;
const MAC_HEX12_PATTERN = /^[0-9A-Fa-f]{12}$/;
const CELLULAR_PATTERN = /^[0-9A-Za-z_:-]{3,64}$/;

export function isValidNetid(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  // Reject any value containing path separators, spaces, or query/tag characters
  if (/[\s/?#\\<>]/.test(trimmed)) {
    return false;
  }
  if (
    MAC_COLON_PATTERN.test(trimmed) ||
    MAC_HYPHEN_PATTERN.test(trimmed) ||
    MAC_HEX12_PATTERN.test(trimmed)
  ) {
    return true;
  }
  // If the string contains colons and only hex chars, it is an incomplete or malformed MAC address
  if (trimmed.includes(':') && /^[0-9A-Fa-f:]+$/.test(trimmed)) {
    return false;
  }
  // If the string looks like hyphen-delimited hex octets but is not 6 octets
  if (/^[0-9A-Fa-f]{2}(?:-[0-9A-Fa-f]{2})+$/.test(trimmed)) {
    return false;
  }
  return CELLULAR_PATTERN.test(trimmed);
}

/**
 * Safely extracts and validates a netid / BSSID from a ledger row.
 * Handles Wi-Fi, Bluetooth/BLE, and cellular detail URL patterns and query parameters.
 * Catches malformed percent-encoding exceptions without crashing React render.
 * Returns null if no valid identifier can be extracted.
 */
export function extractNetidFromLedgerRow(
  row:
    | {
        queryUrl?: string | null;
        queryParams?: Record<string, any> | null;
      }
    | null
    | undefined
): string | null {
  if (!row || typeof row !== 'object') {
    return null;
  }

  // 1. Check queryParams netid or bssid
  if (row.queryParams && typeof row.queryParams === 'object') {
    const qNetid = typeof row.queryParams.netid === 'string' ? row.queryParams.netid.trim() : '';
    if (isValidNetid(qNetid)) {
      return qNetid;
    }
    const qBssid = typeof row.queryParams.bssid === 'string' ? row.queryParams.bssid.trim() : '';
    if (isValidNetid(qBssid)) {
      return qBssid;
    }
  }

  // 2. Check queryUrl for /detail/{type}/{netid}
  if (typeof row.queryUrl === 'string') {
    const match = row.queryUrl.match(/\/detail\/(?:wifi|bt|cell)\/([^/?#]+)/i);
    if (match && match[1]) {
      let decoded: string;
      try {
        decoded = decodeURIComponent(match[1]).trim();
      } catch {
        // Malformed percent-encoding sequence (e.g. %E0%A4%A or truncated %)
        return null;
      }
      if (isValidNetid(decoded)) {
        return decoded;
      }
    }
  }

  return null;
}
