// ===== FILE: src/components/analytics/AnalyticsPage.tsx =====
// PURPOSE: Main orchestrator component for analytics page
// REFACTORED: Original 1,106 line component reduced to ~150 lines

import { usePageFilters } from '../../hooks/usePageFilters';
import { useFilterURLSync } from '../../hooks/useFilteredData';
import { useAdaptedFilters } from '../../hooks/useAdaptedFilters';
import { getPageCapabilities } from '../../utils/filterCapabilities';
import { useAnalyticsData } from './hooks/useAnalyticsData';
import { useAnalyticsFilters } from './hooks/useAnalyticsFilters';
import { useCardLayout } from './hooks/useCardLayout';
import { AnalyticsLayout } from './components/AnalyticsLayout';

export default function Analytics() {
  // Set current page for filter scoping
  usePageFilters('analytics');

  // Sync filters with URL
  useFilterURLSync();

  // Get adapted filters for FilterPanelWrapper
  const capabilities = getPageCapabilities('analytics');
  const adaptedFilters = useAdaptedFilters(capabilities);

  // Get filter state and controls
  const { showFilters, setShowFilters, debouncedFilterState } = useAnalyticsFilters();

  // Get analytics data
  const { data, loading, error } = useAnalyticsData(debouncedFilterState);

  // Get card layout and drag/drop functionality
  const { cards, dragging, resizing, handleMouseDown } = useCardLayout();

  // Handle mouse events for drag/drop
  const handleMouseMove = () => {
    // Mouse move is handled internally by useCardLayout hook
  };

  const handleMouseUp = () => {
    // Mouse up is handled internally by useCardLayout hook
  };

  const handleMouseLeave = () => {
    // Mouse leave is handled internally by useCardLayout hook
  };

  return (
    <AnalyticsLayout
      cards={cards}
      data={data}
      loading={loading}
      error={error}
      showFilters={showFilters}
      setShowFilters={setShowFilters}
      dragging={dragging}
      resizing={resizing}
      debouncedFilterState={debouncedFilterState}
      adaptedFilters={adaptedFilters}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
}

// ===== END FILE =====
