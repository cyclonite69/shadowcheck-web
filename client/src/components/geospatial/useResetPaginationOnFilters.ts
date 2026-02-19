import { useEffect } from 'react';
import type { SortState } from '../../types/network';

type ResetPaginationProps = {
  debouncedFilterState: Record<string, unknown>;
  sort: SortState[];
  locationMode: string;
  resetPagination: () => void;
};

export const useResetPaginationOnFilters = ({
  debouncedFilterState,
  sort,
  locationMode,
  resetPagination,
}: ResetPaginationProps) => {
  useEffect(() => {
    resetPagination();
  }, [JSON.stringify(debouncedFilterState), JSON.stringify(sort), locationMode, resetPagination]);
};
