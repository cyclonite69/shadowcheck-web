import React, { useEffect, useRef, useState } from 'react';
import { COLUMNS, type ColDef } from './wigleRunsColumns';

export interface WigleRunsColumnChooserProps {
  columns?: ColDef[];
  visibleCols: Set<string>;
  onToggleColumn: (colId: string) => void;
}

export const WigleRunsColumnChooser: React.FC<WigleRunsColumnChooserProps> = ({
  columns = COLUMNS,
  visibleCols,
  onToggleColumn,
}) => {
  const [chooserOpen, setChooserOpen] = useState(false);
  const chooserRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chooserOpen) {
      return;
    }
    const handler = (e: MouseEvent) => {
      if (chooserRef.current && !chooserRef.current.contains(e.target as Node)) {
        setChooserOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [chooserOpen]);

  return (
    <div className="relative" ref={chooserRef}>
      <button
        onClick={() => setChooserOpen((o) => !o)}
        className={`text-[10px] font-black uppercase tracking-tighter transition-colors ${
          chooserOpen ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        ⊞ Columns
      </button>
      {chooserOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-slate-700/60 bg-slate-900 shadow-xl py-1">
          {columns.map((col) => (
            <label
              key={col.id}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800/60 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={visibleCols.has(col.id)}
                onChange={() => onToggleColumn(col.id)}
                className="w-3 h-3 rounded bg-slate-950 border-slate-700 text-blue-600"
              />
              <span className="text-[11px] text-slate-300">{col.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
