/**
 * HTTP Byte-Range Request Utilities (RFC 9110 § 14.1.2)
 *
 * Provides dedicated parsing and validation for single byte-range requests against
 * known in-memory buffer or resource sizes.
 */

export interface ByteRangeResult {
  status: 'range' | 'unsatisfiable' | 'ignore';
  start?: number;
  end?: number;
}

/**
 * Parses a single HTTP byte-range request header against a known total buffer size.
 *
 * Supported forms:
 * - `bytes=start-end` (closed range)
 * - `bytes=start-`    (open-ended range to resource end)
 * - `bytes=-suffix`   (suffix byte range: last N bytes of resource)
 *
 * Behavior:
 * - Clamps end offset if larger than `totalSize - 1` (satisfiable per RFC 9110).
 * - Returns `status: 'unsatisfiable'` (HTTP 416) when start >= totalSize, start > end, or totalSize is 0.
 * - Returns `status: 'ignore'` (HTTP 200 fallback) when header is absent, malformed, or specifies
 *   unsupported features such as multiple comma-separated ranges (multipart/byteranges).
 *
 * @param {string | undefined} rangeHeader The raw Range request header
 * @param {number} totalSize Total resource length in bytes
 * @returns {ByteRangeResult} Parsed range result
 */
export function parseByteRange(
  rangeHeader: string | undefined,
  totalSize: number
): ByteRangeResult {
  if (!rangeHeader || typeof rangeHeader !== 'string') {
    return { status: 'ignore' };
  }

  const trimmed = rangeHeader.trim();
  if (!trimmed.startsWith('bytes=')) {
    return { status: 'ignore' };
  }

  const rangeValue = trimmed.slice(6).trim();

  // Multiple comma-separated ranges (multipart/byteranges) are unsupported.
  // Per RFC 9110 § 14.1.2, origin server ignores the Range header and serves full representation.
  if (rangeValue.includes(',')) {
    return { status: 'ignore' };
  }

  if (totalSize <= 0) {
    return { status: 'unsatisfiable' };
  }

  // Suffix byte range: bytes=-<suffix>
  const suffixMatch = rangeValue.match(/^-(?<suffix>\d+)$/);
  if (suffixMatch && suffixMatch.groups) {
    const suffix = parseInt(suffixMatch.groups.suffix, 10);
    if (suffix <= 0) {
      return { status: 'unsatisfiable' };
    }
    const start = suffix >= totalSize ? 0 : totalSize - suffix;
    const end = totalSize - 1;
    return { status: 'range', start, end };
  }

  // Standard byte range: bytes=<start>-<end>?
  const rangeMatch = rangeValue.match(/^(?<start>\d+)-(?<end>\d*)$/);
  if (!rangeMatch || !rangeMatch.groups) {
    // Malformed syntax: ignore and fall back to full representation
    return { status: 'ignore' };
  }

  const start = parseInt(rangeMatch.groups.start, 10);
  if (start >= totalSize) {
    return { status: 'unsatisfiable' };
  }

  let end: number;
  if (rangeMatch.groups.end !== '') {
    end = parseInt(rangeMatch.groups.end, 10);
    if (start > end) {
      return { status: 'unsatisfiable' };
    }
    // Clamp end offset if larger than totalSize - 1 (satisfiable)
    if (end >= totalSize) {
      end = totalSize - 1;
    }
  } else {
    // Open-ended range to EOF (bytes=start-)
    end = totalSize - 1;
  }

  return { status: 'range', start, end };
}
