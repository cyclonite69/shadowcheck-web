const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Trim configured origins and discard blank entries. */
export function normalizeOrigins(origins: readonly string[]): string[] {
  return origins.map((origin) => origin.trim()).filter(Boolean);
}

/** Resolve wildcard behavior for the environment where common middleware is mounted. */
export function resolveOriginPolicy(
  allowedOrigins: readonly string[],
  nodeEnv: string | undefined
): { allowlist: string[]; wildcard: boolean; wildcardIgnored: boolean } {
  const normalizedOrigins = normalizeOrigins(allowedOrigins);
  const hasWildcard = normalizedOrigins.includes('*');

  if (nodeEnv === 'production' && hasWildcard) {
    return {
      allowlist: normalizedOrigins.filter((origin) => origin !== '*'),
      wildcard: false,
      wildcardIgnored: true,
    };
  }

  return {
    allowlist: normalizedOrigins,
    wildcard: hasWildcard,
    wildcardIgnored: false,
  };
}

/** Exact-match an Origin against the configured list, except for legacy `*` mode. */
export function isOriginAllowed(origin: string | undefined, allowlist: readonly string[]): boolean {
  if (!origin || origin === 'null') {
    return false;
  }

  return allowlist.includes('*') || allowlist.includes(origin);
}

/** Permit non-browser clients, legacy wildcard policy, or exact configured Origins. */
export function isOriginPermitted(
  origin: string | undefined,
  policy: ReturnType<typeof resolveOriginPolicy>
): boolean {
  return origin === undefined || policy.wildcard || isOriginAllowed(origin, policy.allowlist);
}

/** Identify HTTP methods that can change server state. */
export function isUnsafeMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method.toUpperCase());
}
