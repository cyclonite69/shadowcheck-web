// ===== FILE: src/components/analytics/hooks/useAnalyticsFilters.ts =====
// PURPOSE: Custom hook for managing analytics filter state and logic
// EXTRACTS: Filter state from lines 182-199 and timeframe effects from lines 286-313

import { useState, useEffect, useRef } from 'react';
import { useDebouncedFilters, useFilterStore } from '../../../stores/filterStore';
import { TimeframeFilter } from '../../../types/filters';

export type AnalyticsTimeFrame = NonNullable<TimeframeFilter['relativeWindow']>;

export interface UseAnalyticsFiltersReturn {
  timeFrame: AnalyticsTimeFrame;
  setTimeFrame: (timeFrame: AnalyticsTimeFrame) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  activeFilterCount: number;
  debouncedFilterState: any;
}

export const useAnalyticsFilters = (): UseAnalyticsFiltersReturn => {
  const [timeFrame, setTimeFrameState] = useState<AnalyticsTimeFrame>(() => {
    return (localStorage.getItem('analytics_timeframe') as AnalyticsTimeFrame) || '30d';
  });
  const [showFilters, setShowFilters] = useState(false);

  const { setFilter, enableFilter } = useFilterStore();
  const activeFilterCount = useFilterStore(
    (state) => Object.values(state.getCurrentEnabled()).filter(Boolean).length
  );
  const [debouncedFilterState, setDebouncedFilterState] = useState(() =>
    useFilterStore.getState().getAPIFilters()
  );
  useDebouncedFilters((payload) => setDebouncedFilterState(payload), 500);

  const hasTimeframeSelectionRef = useRef(false);

  const setTimeFrame = (newTimeFrame: AnalyticsTimeFrame) => {
    setTimeFrameState(newTimeFrame);
  };

  useEffect(() => {
    localStorage.setItem('analytics_timeframe', timeFrame);
    // setFilter auto-enables the filter, so we need to explicitly disable on first render
    setFilter('timeframe', { type: 'relative', relativeWindow: timeFrame });
    if (!hasTimeframeSelectionRef.current) {
      hasTimeframeSelectionRef.current = true;
      // Disable timeframe filter on initial load to show all data
      enableFilter('timeframe', false);
      enableFilter('temporalScope', false);
      return;
    }
    enableFilter('timeframe', true);
    enableFilter('temporalScope', true);
  }, [timeFrame, setFilter, enableFilter]);

  return {
    timeFrame,
    setTimeFrame,
    showFilters,
    setShowFilters,
    activeFilterCount,
    debouncedFilterState,
  };
};

// ===== END FILE =====
