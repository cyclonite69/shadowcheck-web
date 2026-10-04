/**
 * Fail-closed DB gate for the Admin API Testing tab.
 * Displayed database names must come from live health payloads, never hardcodes.
 */

export const EXPECTED_TEST_DB = 'shadowcheck_test';

export type ApiTestingHealth =
  | {
      status?: string;
      version?: string | null;
      database?: string | null;
    }
  | null
  | undefined;

export type TestDbGuardBlocked = {
  blocked: true;
  reason: string;
  database: string | null;
};

export type TestDbGuardAllowed<T> = {
  blocked: false;
  result: T;
};

export type TestDbGuardOutcome<T> = TestDbGuardBlocked | TestDbGuardAllowed<T>;

/**
 * True only when live health reports the isolated test database name.
 */
export function canRunTests(health: ApiTestingHealth): boolean {
  return health?.database === EXPECTED_TEST_DB;
}

/**
 * Normalize a live database label for block messaging.
 * Treats missing / placeholder values as unverified (not as a real DB name).
 */
export function normalizeLiveDatabase(database: string | null | undefined): string | null {
  if (database === null || database === undefined) {
    return null;
  }
  const trimmed = String(database).trim();
  if (!trimmed || trimmed === 'N/A' || trimmed === 'Loading' || trimmed === 'Loading...') {
    return null;
  }
  return trimmed;
}

/**
 * Operator-facing block copy. Never substitutes a hardcoded display name for the live DB.
 */
export function formatTestDbBlockMessage(database: string | null | undefined): string {
  const live = normalizeLiveDatabase(database);
  if (live === null) {
    return 'Blocked: database unverified';
  }
  return `Blocked: connected to ${live}; tests run only against ${EXPECTED_TEST_DB}`;
}

/**
 * Re-fetches health on every invocation. Never calls `run` unless the live DB is the test DB.
 */
export async function withTestDbGuard<T>(options: {
  fetchHealth: () => Promise<ApiTestingHealth>;
  run: () => Promise<T>;
}): Promise<TestDbGuardOutcome<T>> {
  const { fetchHealth, run } = options;

  let health: ApiTestingHealth;
  try {
    health = await fetchHealth();
  } catch {
    return {
      blocked: true,
      reason: formatTestDbBlockMessage(null),
      database: null,
    };
  }

  if (!canRunTests(health)) {
    const database = normalizeLiveDatabase(health?.database);
    return {
      blocked: true,
      reason: formatTestDbBlockMessage(health?.database),
      database,
    };
  }

  const result = await run();
  return { blocked: false, result };
}
