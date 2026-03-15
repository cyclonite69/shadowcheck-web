/**
 * Hook for using adapted filters on a page
 * Automatically adapts canonical filters to page capabilities
 */

import { useEffect, useMemo, useState } from 'react';
import {
  useCurrentEnabled,
  useCurrentFilters,
  useDebouncedFilters,
  useFilterStore,
} from '../stores/filterStore';
import { adaptFiltersToPage, PageFilterCapabilities } from '../utils/filterCapabilities';
import type { NetworkFilters } from '../types/filters';

/**
 * Use adapted filters for a specific page
 * Returns only the filters the page supports, plus metadata about ignored filters
 */
export function useAdaptedFilters(capabilities: PageFilterCapabilities) {
  const filters = useCurrentFilters();
  const enabled = useCurrentEnabled();

  const adapted = useMemo(() => {
    return adaptFiltersToPage(filters, enabled, capabilities);
  }, [filters, enabled, capabilities]);

  return adapted;
}

/**
 * Debounced variant for expensive pages (Kepler, heavy geospatial views).
 * Prevents a new API fetch on every rapid filter toggle.
 */
export function useDebouncedAdaptedFilters(capabilities: PageFilterCapabilities, delay = 700) {
  const getCurrentFilters = useFilterStore((state) => state.getCurrentFilters);
  const getCurrentEnabled = useFilterStore((state) => state.getCurrentEnabled);

  const [debouncedState, setDebouncedState] = useState<{
    filters: NetworkFilters;
    enabled: Record<keyof NetworkFilters, boolean>;
  }>(() => ({
    filters: getCurrentFilters(),
    enabled: getCurrentEnabled(),
  }));

  useDebouncedFilters((payload) => setDebouncedState(payload), delay);

  useEffect(() => {
    // Keep initial render aligned with current page state before debounce fires.
    setDebouncedState({
      filters: getCurrentFilters(),
      enabled: getCurrentEnabled(),
    });
  }, [getCurrentEnabled, getCurrentFilters]);

  return useMemo(
    () => adaptFiltersToPage(debouncedState.filters, debouncedState.enabled, capabilities),
    [debouncedState.enabled, debouncedState.filters, capabilities]
  );
}

/**
 * Get filter payload for API requests
 * Returns the standard { filters, enabled } shape with only supported filters
 */
export function useFilterPayload(capabilities: PageFilterCapabilities) {
  const adapted = useAdaptedFilters(capabilities);

  return useMemo(
    () => ({
      filters: adapted.filtersForPage,
      enabled: adapted.enabledForPage,
    }),
    [adapted]
  );
}
