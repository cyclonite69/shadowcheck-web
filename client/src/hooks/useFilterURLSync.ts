import { useEffect } from 'react';
import { useCurrentEnabled, useCurrentFilters, useFilterStore } from '../stores/filterStore';

export const useFilterURLSync = () => {
  const setFromURLParams = useFilterStore((state) => state.setFromURLParams);
  const getURLParams = useFilterStore((state) => state.getURLParams);
  const filters = useCurrentFilters();
  const enabled = useCurrentEnabled();

  // Load from URL on mount only
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.toString()) {
      setFromURLParams(params);
    }
  }, [setFromURLParams]);

  // Update URL when filter state changes
  useEffect(() => {
    const params = getURLParams();
    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newURL);
  }, [filters, enabled, getURLParams]);
};
