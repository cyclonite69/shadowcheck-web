import type { NetworkFilters } from '../types/filters';

/**
 * Returns true if a surveillance flag filter is both enabled and set to true.
 * Used to drive checked state on surveillance sub-flag checkboxes so that
 * dismissing a filter via the header chip (which sets enabled[key]=false while
 * leaving filters[key]=true) accurately unchecks the checkbox.
 */
export function isSurveillanceFlagActive(
  filters: Partial<NetworkFilters> | undefined | null,
  enabled: Record<string, boolean> | undefined | null,
  key: keyof NetworkFilters
): boolean {
  return enabled?.[key] === true && filters?.[key] === true;
}
