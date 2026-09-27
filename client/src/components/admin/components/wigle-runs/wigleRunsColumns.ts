import { useCallback, useEffect, useMemo, useState } from 'react';

export interface ColDef {
  id: string;
  label: string;
  sortKey: string | null;
  defaultVisible: boolean;
}

export const COLUMNS: ColDef[] = [
  { id: 'id', label: 'ID', sortKey: null, defaultVisible: true },
  { id: 'target', label: 'Target', sortKey: 'search_term', defaultVisible: true },
  { id: 'jurisdiction', label: 'State/Territory', sortKey: 'state', defaultVisible: true },
  { id: 'status', label: 'Status', sortKey: 'status', defaultVisible: true },
  { id: 'progress', label: 'Progress', sortKey: null, defaultVisible: true },
  {
    id: 'rows_inserted',
    label: 'Last Run Rows Inserted',
    sortKey: 'rows_inserted',
    defaultVisible: true,
  },
  { id: 'rows_returned', label: 'Returned', sortKey: 'rows_returned', defaultVisible: false },
  { id: 'pages_fetched', label: 'Pages', sortKey: 'pages_fetched', defaultVisible: false },
  { id: 'total_pages', label: 'Total Pages', sortKey: 'total_pages', defaultVisible: false },
  { id: 'source', label: 'Source', sortKey: 'source', defaultVisible: false },
  { id: 'started_at', label: 'Started', sortKey: 'started_at', defaultVisible: true },
  { id: 'completed_at', label: 'Completed', sortKey: 'completed_at', defaultVisible: false },
  { id: 'last_active', label: 'Last Active', sortKey: 'updated_at', defaultVisible: true },
  { id: 'actions', label: 'Actions', sortKey: null, defaultVisible: true },
];

export const COLUMN_STORAGE_KEY = 'import_runs_columns_v2';

export function useWigleRunsColumns() {
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_STORAGE_KEY);
      if (saved) {
        return new Set(JSON.parse(saved) as string[]);
      }
    } catch {
      // Ignore localStorage read/parse errors and fall back to default columns
    }
    return new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id));
  });

  useEffect(() => {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify([...visibleCols]));
  }, [visibleCols]);

  const handleToggleColumn = useCallback((colId: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) {
        next.delete(colId);
      } else {
        next.add(colId);
      }
      return next;
    });
  }, []);

  const visibleColDefs = useMemo(() => COLUMNS.filter((c) => visibleCols.has(c.id)), [visibleCols]);

  return { visibleCols, visibleColDefs, handleToggleColumn };
}
