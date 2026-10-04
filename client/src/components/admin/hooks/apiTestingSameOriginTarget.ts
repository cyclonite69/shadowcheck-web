export type SameOriginTargetResult = { ok: true; path: string } | { ok: false; reason: string };

const INVALID_TARGET_REASON =
  'Blocked: request target must be a same-origin path starting with a single slash.';
const INVALID_CHARACTERS_REASON =
  'Blocked: request target cannot contain whitespace, control characters, or backslashes.';

/** Validate and normalize a free-form API Testing target before it can be fetched. */
export function resolveSameOriginTarget(raw: string, origin: string): SameOriginTargetResult {
  const target = raw.trim();
  if (!target) {
    return { ok: false, reason: INVALID_TARGET_REASON };
  }

  const hasWhitespaceOrControlCharacter = Array.from(raw).some((character) => {
    return /\p{White_Space}/u.test(character) || /\p{Cc}/u.test(character);
  });
  if (hasWhitespaceOrControlCharacter || raw.includes('\\')) {
    return { ok: false, reason: INVALID_CHARACTERS_REASON };
  }

  if (!target.startsWith('/') || target.startsWith('//')) {
    return { ok: false, reason: INVALID_TARGET_REASON };
  }

  try {
    const parsed = new URL(target, origin);
    if (parsed.origin !== origin) {
      return { ok: false, reason: INVALID_TARGET_REASON };
    }

    return { ok: true, path: parsed.pathname + parsed.search };
  } catch {
    return { ok: false, reason: INVALID_TARGET_REASON };
  }
}
