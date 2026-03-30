/**
 * formatDate.ts — single source of truth for all date/time display in ShadowCheck.
 *
 * Formatting standard:
 *   Table cells   → formatShortDate  → "Mar 08 '26 11:14"
 *   Tooltips      → formatISODate    → "2026-03-08T11:14:49.000Z"
 *   Relative      → formatRelativeTime → "46d ago"  (secondary only, never standalone)
 *   Chart axes    → formatChartDate  → adaptive precision based on visible range
 *   CSV/JSON      → formatExportDate → full ISO 8601, empty string for invalid
 */

/**
 * Primary table formatter.
 * Output: "Mar 08 '26 11:14" — fixed-width, 24h, browser local time.
 * Null/undefined/invalid → '—'
 */
export function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '—';
  const month = d.toLocaleString('en-US', { month: 'short' }); // "Mar"
  const day = String(d.getDate()).padStart(2, '0'); // "08"
  const year = String(d.getFullYear()).slice(-2); // "26"
  const hh = String(d.getHours()).padStart(2, '0'); // "11"
  const mm = String(d.getMinutes()).padStart(2, '0'); // "14"
  return `${month} ${day} '${year} ${hh}:${mm}`; // "Mar 08 '26 11:14"
}

/**
 * Full ISO string for tooltips and hover states.
 * Returns the raw ISO 8601 string, or '—' for invalid input.
 */
export function formatISODate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '—';
  return d.toISOString();
}

/**
 * Relative time — secondary display only, never standalone.
 * Examples: "just now", "2h ago", "46d ago", "2y ago"
 */
export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 365) return `${diffDay}d ago`;
  const diffYr = Math.floor(diffDay / 365);
  return `${diffYr}y ago`;
}

/**
 * Adaptive chart axis formatter — precision scales with visible range.
 * rangeMs: the total time range currently displayed on the chart in milliseconds.
 */
export function formatChartDate(value: string | Date, rangeMs: number): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '—';
  const ONE_DAY = 86_400_000;
  const ONE_WEEK = 7 * ONE_DAY;
  const NINETY_DAYS = 90 * ONE_DAY;
  if (rangeMs < ONE_DAY) {
    // HH:mm
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  if (rangeMs < ONE_WEEK) {
    // MMM DD HH:mm
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${month} ${day} ${hh}:${mm}`;
  }
  if (rangeMs < NINETY_DAYS) {
    // MMM DD
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = String(d.getDate()).padStart(2, '0');
    return `${month} ${day}`;
  }
  // MMM 'YY
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = String(d.getFullYear()).slice(-2);
  return `${month} '${year}`;
}

/**
 * Export-safe formatter — always full ISO 8601.
 * Use this wherever data goes to CSV, JSON, or clipboard export.
 * Never use formatShortDate for exports.
 */
export function formatExportDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}
