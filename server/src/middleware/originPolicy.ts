const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Trim configured origins and discard blank entries. */
export function normalizeOrigins(origins: readonly string[]): string[] {
  return origins.map((origin) => origin.trim()).filter(Boolean);
}

/** Exact-match an Origin against the configured list, except for legacy `*` mode. */
export function isOriginAllowed(origin: string | undefined, allowlist: readonly string[]): boolean {
  if (!origin || origin === 'null') {
    return false;
  }

  return allowlist.includes('*') || allowlist.includes(origin);
}

/** Identify HTTP methods that can change server state. */
export function isUnsafeMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method.toUpperCase());
}
