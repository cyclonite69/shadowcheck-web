import { useEffect, useState } from 'react';
import type { NetworkRow } from '../../types/network';
import { NetworkColumnConfig } from '../../constants/network';

type ColumnVisibilityProps = {
  columns: Partial<Record<keyof NetworkRow | 'select', NetworkColumnConfig>>;
};

export const useColumnVisibility = ({ columns }: ColumnVisibilityProps) => {
  const [visibleColumns, setVisibleColumns] = useState<(keyof NetworkRow | 'select')[]>(() => {
    const saved = localStorage.getItem('shadowcheck_visible_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (key): key is keyof NetworkRow | 'select' => typeof key === 'string' && key in columns
          );
          if (valid.length) return valid;
        }
      } catch {
        // Fall through to default
      }
    }
    return (Object.keys(columns) as (keyof NetworkRow | 'select')[]).filter(
      (k) => columns[k]?.default
    );
  });

  useEffect(() => {
    localStorage.setItem('shadowcheck_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (col: keyof NetworkRow | 'select') => {
    setVisibleColumns((v) => (v.includes(col) ? v.filter((c) => c !== col) : [...v, col]));
  };

  const reorderColumns = (
    fromCol: keyof NetworkRow | 'select',
    toCol: keyof NetworkRow | 'select'
  ) => {
    setVisibleColumns((prev) => {
      const fromIndex = prev.indexOf(fromCol);
      const toIndex = prev.indexOf(toCol);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev;
      const next = [...prev];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, fromCol);
      return next;
    });
  };

  return {
    visibleColumns,
    setVisibleColumns,
    toggleColumn,
    reorderColumns,
  };
};
