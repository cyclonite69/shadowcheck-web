import { ApiHealth } from '../../../types/admin';

const HEALTH_CANDIDATES = ['/api/health', '/health'];

export type HealthCandidateResponse = {
  ok: boolean;
  text: () => Promise<string>;
};

export type HealthCandidateFetcher = (path: string) => Promise<HealthCandidateResponse>;

/** Parse one successful JSON health response that identifies its database. */
export function parseHealthPayload(text: string, ok: boolean): ApiHealth | null {
  if (!ok || !text) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return null;
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const healthPayload = payload as Record<string, unknown>;
  if (typeof healthPayload.database !== 'string') {
    return null;
  }

  return {
    status:
      typeof healthPayload.status === 'string' ? healthPayload.status.toUpperCase() : 'ONLINE',
    version: typeof healthPayload.version === 'string' ? healthPayload.version : 'N/A',
    database: healthPayload.database,
  };
}

/** Resolve live health from ordered candidate paths using an injected fetcher. */
export async function resolveApiHealth(fetchCandidate: HealthCandidateFetcher): Promise<ApiHealth> {
  for (const path of HEALTH_CANDIDATES) {
    try {
      const response = await fetchCandidate(path);
      const health = parseHealthPayload(await response.text(), response.ok);
      if (health) {
        return health;
      }
    } catch {
      // Continue to the next health candidate.
    }
  }

  return { status: 'OFFLINE', version: 'N/A', database: null };
}

/** Format the Admin API Testing database label from the latest health state. */
export function formatDbLabel(health: ApiHealth | null | undefined): string {
  if (health === null || health === undefined) {
    return 'Loading...';
  }

  const database = health.database;
  if (database === null || database === undefined || !database.trim() || database === 'N/A') {
    return 'unverified';
  }

  return database;
}
