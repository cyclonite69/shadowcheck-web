type SiblingRefreshOptions = {
  batchSize?: number;
  maxOctetDelta?: number;
  maxDistanceM?: number;
  minCandidateConf?: number;
  minStrongConf?: number;
  maxBatches?: number | null;
  incremental?: boolean;
  targetBssids?: string[];
  notes?: string;
};

type SiblingRefreshResult = {
  success: boolean;
  batchesRun: number;
  seedsProcessed: number;
  rowsUpserted: number;
  lastCursor: string | null;
  executionTimeMs: number;
  completed: boolean;
  sibling_run_id: number | null;
};

type SiblingRefreshStatus = {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  options: Required<SiblingRefreshOptions> | null;
  progress: {
    batchesRun: number;
    seedsProcessed: number;
    rowsUpserted: number;
    lastCursor: string | null;
  };
  lastResult: SiblingRefreshResult | null;
  lastError: string | null;
};

const DEFAULTS: Required<SiblingRefreshOptions> = {
  batchSize: 250,
  maxOctetDelta: 6,
  maxDistanceM: 1500,
  minCandidateConf: 0.9,
  minStrongConf: 0.97,
  maxBatches: null,
  incremental: false,
  targetBssids: [],
  notes: '',
};

const state: SiblingRefreshStatus & { cancelRequested: boolean } = {
  running: false,
  cancelRequested: false,
  startedAt: null,
  finishedAt: null,
  options: null,
  progress: {
    batchesRun: 0,
    seedsProcessed: 0,
    rowsUpserted: 0,
    lastCursor: null,
  },
  lastResult: null,
  lastError: null,
};

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function normalizeOptions(options: SiblingRefreshOptions = {}): Required<SiblingRefreshOptions> {
  return {
    batchSize: Math.floor(clampNumber(options.batchSize, DEFAULTS.batchSize, 10, 10000)),
    maxOctetDelta: Math.floor(clampNumber(options.maxOctetDelta, DEFAULTS.maxOctetDelta, 1, 64)),
    maxDistanceM: clampNumber(options.maxDistanceM, DEFAULTS.maxDistanceM, 0, 100000),
    minCandidateConf: clampNumber(options.minCandidateConf, DEFAULTS.minCandidateConf, 0, 2),
    minStrongConf: clampNumber(options.minStrongConf, DEFAULTS.minStrongConf, 0, 2),
    maxBatches:
      options.maxBatches === null || options.maxBatches === undefined
        ? null
        : Math.floor(clampNumber(options.maxBatches, 1, 1, 100000)),
    incremental: options.incremental ?? DEFAULTS.incremental,
    targetBssids: options.targetBssids ?? DEFAULTS.targetBssids,
    notes: options.notes ?? DEFAULTS.notes,
  };
}

function getSiblingRefreshStatus(): SiblingRefreshStatus {
  return {
    ...state,
    progress: { ...state.progress },
    options: state.options ? { ...state.options } : null,
    lastResult: state.lastResult ? { ...state.lastResult } : null,
  };
}

export { DEFAULTS, getSiblingRefreshStatus, normalizeOptions, state };
export type { SiblingRefreshOptions, SiblingRefreshResult, SiblingRefreshStatus };
