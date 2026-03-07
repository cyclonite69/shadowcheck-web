import { useEffect } from 'react';
import { useFilterStore } from '../stores/filterStore';

export const useFilterURLSync = () => {
  const { setFromURLParams, getURLParams } = useFilterStore();
  const filters = useFilterStore((state) => state.getCurrentFilters());
  const enabled = useFilterStore((state) => state.getCurrentEnabled());

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
