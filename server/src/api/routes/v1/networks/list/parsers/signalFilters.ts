import { parseOptionalInteger } from '../../../../../../validation/parameterParsers';
import { ROUTE_CONFIG } from '../../../../../../config/routeConfig';

export type SignalFilterParams = {
  lastSeen: string | null;
  minSignal: number | null;
  maxSignal: number | null;
  minObsCount: number;
  maxObsCount: number | null;
};

export const parseSignalFilters = (
  lastSeenRaw: unknown,
  minSignalRaw: unknown,
  maxSignalRaw: unknown,
  minObsRaw: unknown,
  maxObsRaw: unknown
): { ok: true; params: SignalFilterParams } | { ok: false; status: 400; error: string } => {
  let lastSeen: string | null = null;
  if (lastSeenRaw !== undefined) {
    const lastSeenValue = Array.isArray(lastSeenRaw) ? lastSeenRaw[0] : lastSeenRaw;
    const parsed = new Date(String(lastSeenValue));
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, status: 400, error: 'Invalid last_seen parameter.' };
    }
    lastSeen = parsed.toISOString();
  }

  const minSignalResult = parseOptionalInteger(
    minSignalRaw,
    Number.MIN_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
    'min_signal'
  );
  if (!minSignalResult.ok)
    return { ok: false, status: 400, error: 'Invalid min_signal parameter.' };

  const maxSignalResult = parseOptionalInteger(
    maxSignalRaw,
    Number.MIN_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
    'max_signal'
  );
  if (!maxSignalResult.ok)
    return { ok: false, status: 400, error: 'Invalid max_signal parameter.' };

  const minObsResult = parseOptionalInteger(
    minObsRaw,
    0,
    ROUTE_CONFIG.networks.maxObservationCount,
    'min_obs_count'
  );
  if (!minObsResult.ok)
    return { ok: false, status: 400, error: 'Invalid min_obs_count parameter.' };

  const maxObsResult = parseOptionalInteger(
    maxObsRaw,
    0,
    ROUTE_CONFIG.networks.maxObservationCount,
    'max_obs_count'
  );
  if (!maxObsResult.ok)
    return { ok: false, status: 400, error: 'Invalid max_obs_count parameter.' };

  return {
    ok: true,
    params: {
      lastSeen,
      minSignal: minSignalResult.value,
      maxSignal: maxSignalResult.value,
      minObsCount: minObsResult.value !== null ? minObsResult.value : 1,
      maxObsCount: maxObsResult.value,
    },
  };
};
