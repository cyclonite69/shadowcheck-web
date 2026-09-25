/**
 * Display formatting helpers for network signal strength and timespan badges.
 * Extracted from NetworkTableBodyGrid.tsx and NetworkTableRow.tsx to eliminate duplication.
 */

export interface TimespanBadgeStyle {
  bg: string;
  color: string;
  border: string;
}

// Returns a CSS color string for a signal strength value (dBm).
// null or 0 → grey (no data), ≥-50 → green, ≥-70 → amber, else → red.
export function getSignalColor(signalDbm: number | null): string {
  if (signalDbm === null || signalDbm === 0) {
    return '#6b7280';
  }
  if (signalDbm >= -50) {
    return '#10b981';
  }
  if (signalDbm >= -70) {
    return '#f59e0b';
  }
  return '#ef4444';
}

// Returns formatted signal strength string or 'N/A' when unavailable.
export function getSignalDisplay(signalDbm: number | null): string {
  if (signalDbm === null || signalDbm === 0) {
    return 'N/A';
  }
  return `${signalDbm} dBm`;
}

// Returns 3-tier traffic-light badge style for a timespan in days.
// >30 → red, >7 → amber, ≤7 → green.
export function getTimespanBadgeStyle(days: number): TimespanBadgeStyle {
  if (days > 30) {
    return {
      bg: 'rgba(239, 68, 68, 0.2)',
      color: '#f87171',
      border: 'rgba(239, 68, 68, 0.3)',
    };
  }
  if (days > 7) {
    return {
      bg: 'rgba(251, 191, 36, 0.2)',
      color: '#fbbf24',
      border: 'rgba(251, 191, 36, 0.3)',
    };
  }
  return {
    bg: 'rgba(34, 197, 94, 0.2)',
    color: '#4ade80',
    border: 'rgba(34, 197, 94, 0.3)',
  };
}

// Returns 'Same day' for 0-day spans, otherwise "${days} days".
export function getTimespanDisplay(days: number): string {
  if (days === 0) {
    return 'Same day';
  }
  return `${days} days`;
}
