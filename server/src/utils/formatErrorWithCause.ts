/**
 * Flatten an unknown thrown value into a diagnostic string that preserves
 * Node's Error.cause chain. Native fetch() often throws TypeError("fetch failed")
 * with the actionable detail (ENOTFOUND, ECONNREFUSED, etc.) only on `.cause`.
 *
 * Prefer this over `error.message` alone at catch sites that surface errors to
 * operators (UI job state, structured logs).
 */
export function formatErrorWithCause(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause == null) {
    return error.message;
  }

  if (cause instanceof Error) {
    const code = (cause as NodeJS.ErrnoException).code;
    const causeText = code ? `${cause.message} [${code}]` : cause.message;
    return `${error.message} (cause: ${causeText})`;
  }

  if (typeof cause === 'object') {
    const obj = cause as { message?: unknown; code?: unknown };
    const msg = obj.message != null ? String(obj.message) : JSON.stringify(cause);
    const code = obj.code != null ? String(obj.code) : undefined;
    return code ? `${error.message} (cause: ${msg} [${code}])` : `${error.message} (cause: ${msg})`;
  }

  return `${error.message} (cause: ${String(cause)})`;
}
