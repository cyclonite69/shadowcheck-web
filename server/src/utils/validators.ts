export {};
/**
 * Inline parameter validators
 *
 * Lightweight helpers for sanitizing common query/body parameters directly
 * inside route handlers. Each function returns a usable value (never throws).
 *
 * For cases that need proper error responses (required params, explicit 400s)
 * use server/src/validation/parameterParsers.ts instead.
 */

const validators = {
  /**
   * Parse and clamp an integer parameter.
   * Returns `defaultVal` when the input is missing or unparseable.
   */
  limit(val: string | undefined, min: number, max: number, defaultVal: number): number {
    const n = parseInt(val as string, 10);
    return Math.min(Math.max(isNaN(n) ? defaultVal : n, min), max);
  },

  /**
   * Parse and floor an offset/skip parameter (min 0).
   */
  offset(val: string | undefined, max = 10_000_000): number {
    const n = parseInt(val as string, 10);
    return Math.min(Math.max(isNaN(n) ? 0 : n, 0), max);
  },

  /**
   * Trim and truncate a free-text search string.
   * Returns '' when missing.
   */
  search(val: string | undefined, maxLen = 200): string {
    return val ? String(val).trim().slice(0, maxLen) : '';
  },

  /**
   * Validate a sort column against an allowlist.
   * Returns `allowed[0]` when the value is not in the list.
   */
  sort(val: string | undefined, allowed: string[]): string {
    const v = (val || '').toLowerCase().trim();
    return allowed.includes(v) ? v : allowed[0];
  },

  /**
   * Normalise an order direction to 'ASC' | 'DESC'.
   * Defaults to 'DESC'.
   */
  order(val: string | undefined): 'ASC' | 'DESC' {
    return String(val || '')
      .toUpperCase()
      .trim() === 'ASC'
      ? 'ASC'
      : 'DESC';
  },

  /**
   * Upper-case and validate a BSSID (XX:XX:XX:XX:XX:XX).
   * Returns null when invalid.
   */
  bssid(val: string | undefined): string | null {
    const clean = String(val || '')
      .toUpperCase()
      .trim();
    return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(clean) ? clean : null;
  },
};

module.exports = { validators };
