import type { WigleImportRun } from '../../../types/admin';
import type { JurisdictionProbeStatus } from '../../../constants/network';

export type CoverageLedgerStatus = 'known' | 'unknown' | 'rate_limited' | 'error';

export interface CoverageStateRow {
  state: string;
  name: string;
  localRows: number;
  localUniqueBssids: number;
  knownRemoteAvailable: number | null;
  gap: number | null;
  lastLedgerProbeAt: string | null;
  lastLedgerHttpStatus: number | null;
  lastLedgerResultCount: number | null;
  lastLedgerRetryAfterHint: number | null;
  lastLedgerError: string | null;
  ledgerStatus: CoverageLedgerStatus;
  rowsInserted: number | null;
  runId: number | null;
  status: string | null;
  lastError: string | null;
  isQueried: boolean;
  hasLocalData: boolean;
  probeStatus: JurisdictionProbeStatus;
}

export interface ReportStateEntry {
  state?: string | null;
  localRows?: number | null;
  localUniqueBssids?: number | null;
  storedCount?: number | null;
  knownRemoteAvailable?: number | null;
  gap?: number | null;
  lastLedgerProbeAt?: string | null;
  lastLedgerHttpStatus?: number | null;
  lastLedgerResultCount?: number | null;
  lastLedgerRetryAfterHint?: number | null;
  lastLedgerError?: string | null;
  ledgerStatus?: CoverageLedgerStatus | null;
  rowsInserted?: number | null;
  runId?: number | null;
  status?: string | null;
  lastError?: string | null;
}

/**
 * Derives a deduplicated, case-insensitively-keyed, sorted list of coverage
 * search terms from import runs.
 *
 * When the same term exists under multiple casings, the casing from the
 * most-recently-started run wins.
 */
export function buildCoverageTerms(runs: WigleImportRun[]): string[] {
  const termsMap = new Map<string, { term: string; startedAtTime: number }>();
  for (const r of runs) {
    const term = r.searchTerm;
    if (!term) {
      continue;
    }
    const lower = term.toLowerCase();
    const startedAtTime = r.startedAt ? new Date(r.startedAt).getTime() : 0;
    const existing = termsMap.get(lower);
    if (!existing || startedAtTime > existing.startedAtTime) {
      termsMap.set(lower, { term, startedAtTime });
    }
  }
  return Array.from(termsMap.values())
    .map((item) => item.term)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Merges backend per-state report data with the canonical US_STATES list.
 * Local database counts are independent from import-run progress. A report
 * entry can therefore contain local data without a matching import run.
 */
export function mergeCoverageStates(
  reportStates: ReportStateEntry[] | null | undefined,
  usStates: Array<{
    code: string;
    name: string;
    probeStatus?: JurisdictionProbeStatus;
  }>
): CoverageStateRow[] {
  const reportStatesMap = new Map<string, ReportStateEntry>();
  if (reportStates) {
    for (const s of reportStates) {
      if (s.state) {
        reportStatesMap.set(s.state.toUpperCase(), s);
      }
    }
  }
  return usStates.map((stateObj) => {
    const code = stateObj.code.toUpperCase();
    const matched = reportStatesMap.get(code);
    const probeStatus = stateObj.probeStatus ?? 'supported';
    const localRows = matched?.localRows ?? 0;
    const localUniqueBssids = matched?.localUniqueBssids ?? matched?.storedCount ?? 0;
    const isQueried = Boolean(
      matched &&
      ((matched.runId !== null && matched.runId !== undefined) ||
        (matched.status !== null && matched.status !== undefined) ||
        (matched.rowsInserted !== null && matched.rowsInserted !== undefined))
    );
    return {
      state: stateObj.code,
      name: stateObj.name,
      localRows,
      localUniqueBssids,
      knownRemoteAvailable: matched?.knownRemoteAvailable ?? null,
      gap: matched?.gap ?? null,
      lastLedgerProbeAt: matched?.lastLedgerProbeAt ?? null,
      lastLedgerHttpStatus: matched?.lastLedgerHttpStatus ?? null,
      lastLedgerResultCount: matched?.lastLedgerResultCount ?? null,
      lastLedgerRetryAfterHint: matched?.lastLedgerRetryAfterHint ?? null,
      lastLedgerError: matched?.lastLedgerError ?? null,
      ledgerStatus: matched?.ledgerStatus ?? 'unknown',
      rowsInserted: matched?.rowsInserted ?? null,
      runId: matched ? (matched.runId ?? null) : null,
      status: matched ? (matched.status ?? null) : null,
      lastError: matched ? (matched.lastError ?? null) : null,
      isQueried,
      hasLocalData: localRows > 0 || localUniqueBssids > 0,
      probeStatus,
    };
  });
}

export function getCoverageCountDisplay(row: CoverageStateRow): {
  value: number | null;
  label: 'Local BSSIDs' | 'Not auto-probed';
} {
  if (row.probeStatus === 'unverified') {
    return { value: null, label: 'Not auto-probed' };
  }
  return { value: row.localUniqueBssids, label: 'Local BSSIDs' };
}

export function getCoverageRemoteDisplay(row: CoverageStateRow): {
  availabilityLabel: string;
  gapLabel: string | null;
  statusLabel: string | null;
} {
  if (row.probeStatus === 'unverified') {
    return {
      availabilityLabel: 'Remote not auto-probed',
      gapLabel: null,
      statusLabel: null,
    };
  }

  const availabilityLabel =
    row.knownRemoteAvailable === null
      ? 'Remote unknown'
      : `Known available: ${row.knownRemoteAvailable.toLocaleString()}`;
  const gapLabel = row.gap === null ? null : `Gap: ${row.gap.toLocaleString()}`;
  const statusLabel =
    row.ledgerStatus === 'rate_limited'
      ? 'Rate limited'
      : row.ledgerStatus === 'error'
        ? 'Last probe failed'
        : null;

  return { availabilityLabel, gapLabel, statusLabel };
}
