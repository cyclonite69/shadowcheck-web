/**
 * Hook to automatically set the current page in filter store
 * Call this at the top of each page component
 */

import { useEffect } from 'react';
import { useFilterStore } from '../stores/filterStore';

export function usePageFilters(pageName: string) {
  const setCurrentPage = useFilterStore((state) => state.setCurrentPage);

  useEffect(() => {
    setCurrentPage(pageName);
  }, [pageName, setCurrentPage]);
}
