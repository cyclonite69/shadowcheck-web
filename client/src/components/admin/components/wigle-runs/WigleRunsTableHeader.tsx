import React from 'react';
import type { ColDef } from './wigleRunsColumns';
import type { SortEntry } from '../../hooks/useWigleRuns';

export interface WigleRunsTableHeaderProps {
  columns: ColDef[];
  sortCols?: SortEntry[];
  onSort?: (col: ColDef, e: React.MouseEvent) => void;
}

export const WigleRunsTableHeader: React.FC<WigleRunsTableHeaderProps> = ({
  columns,
  sortCols = [],
  onSort,
}) => {
  return (
    <thead className="sticky top-0 z-10 bg-slate-900 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-700/50">
      <tr>
        {columns.map((col) => {
          const sortIdx = sortCols.findIndex((s) => s.key === col.sortKey);
          const sortEntry = sortIdx !== -1 ? sortCols[sortIdx] : null;
          return (
            <th
              key={col.id}
              className={`px-3 py-2 whitespace-nowrap select-none ${
                col.sortKey && onSort ? 'cursor-pointer hover:text-slate-300 transition-colors' : ''
              }`}
              onClick={col.sortKey && onSort ? (e) => onSort(col, e) : undefined}
              title={col.sortKey ? 'Click to sort · Shift+click for multi-sort' : undefined}
            >
              <span className="inline-flex items-center gap-1">
                {col.label}
                {sortEntry && (
                  <span className="text-cyan-400 font-black">
                    {sortEntry.dir === 'asc' ? '↑' : '↓'}
                    {sortCols.length > 1 && <sup className="text-[8px] ml-px">{sortIdx + 1}</sup>}
                  </span>
                )}
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
};
