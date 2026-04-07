import { useState } from 'react';
import { useDebouncedFilters, useFilterStore } from '../../stores/filterStore';

export const useDebouncedFilterState = () => {
  const [debouncedFilterState, setDebouncedFilterState] = useState(() =>
    useFilterStore.getState().getAPIFilters()
  );
  useDebouncedFilters((payload) => setDebouncedFilterState(payload), 500);

  return debouncedFilterState;
};
