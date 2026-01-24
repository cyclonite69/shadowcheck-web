import type { NetworkRow, SortState } from '../../types/network';

type NetworkSortProps = {
  setSort: React.Dispatch<React.SetStateAction<SortState[]>>;
  setError: (error: string | null) => void;
  sortMap: Record<keyof NetworkRow, string | undefined>;
  columnConfig: Record<keyof NetworkRow, { sortable?: boolean }>;
};

export const useNetworkSort = ({ setSort, setError, sortMap, columnConfig }: NetworkSortProps) => {
  const handleColumnSort = (column: keyof NetworkRow, _shiftKey: boolean) => {
    const colConfig = columnConfig[column as keyof typeof columnConfig];
    if (!colConfig || !colConfig.sortable) return;
    if (!sortMap[column]) {
      setError(`Sort not supported for ${String(column)}`);
      return;
    }

    setSort((prevSort) => {
      const existingIndex = prevSort.findIndex((s) => s.column === column);
      const nextDirection =
        existingIndex >= 0 && prevSort[existingIndex].direction === 'asc' ? 'desc' : 'asc';

      if (_shiftKey) {
        const next = [...prevSort];
        if (existingIndex >= 0) {
          next[existingIndex] = { column, direction: nextDirection };
        } else {
          next.push({ column, direction: 'asc' });
        }
        return next;
      }

      return [{ column, direction: existingIndex >= 0 ? nextDirection : 'asc' }];
    });
  };

  return { handleColumnSort };
};
