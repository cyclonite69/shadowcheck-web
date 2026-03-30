import React, { useEffect, useRef, useState } from 'react';
import { adminApi } from '../../../api/adminApi';
import { formatShortDate } from '../../../utils/formatDate';

interface DeviceSource {
  source_tag: string;
  last_import: string | null;
  total_imported: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const SourceTagInput: React.FC<Props> = ({ value, onChange, disabled }) => {
  const [sources, setSources] = useState<DeviceSource[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    adminApi
      .getDeviceSources()
      .then((data: any) => setSources(data?.sources ?? []))
      .catch(() => setSources([]));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = sources.filter(
    (s) => value.trim() === '' || s.source_tag.includes(value.trim().toLowerCase())
  );

  const select = (tag: string) => {
    onChange(tag);
    setOpen(false);
  };

  // Sanitise to match what the backend does: lowercase, non-alphanum → _
  const handleChange = (raw: string) => {
    onChange(
      raw
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .slice(0, 50)
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="e.g. s22_backup"
          disabled={disabled}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 disabled:opacity-50 pr-8"
        />
        {/* Chevron toggle */}
        {!disabled && sources.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            tabIndex={-1}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
          {filtered.map((s) => (
            <li
              key={s.source_tag}
              onMouseDown={() => select(s.source_tag)}
              className="flex items-center justify-between px-3 py-2 hover:bg-slate-700 cursor-pointer"
            >
              <span className="font-mono text-sm text-slate-200">{s.source_tag}</span>
              <span className="text-xs text-slate-500 ml-3 whitespace-nowrap">
                {formatShortDate(s.last_import)}
                {s.total_imported > 0 && <> · {s.total_imported.toLocaleString()} obs</>}
              </span>
            </li>
          ))}
          {value.trim() && !sources.some((s) => s.source_tag === value.trim()) && (
            <li className="px-3 py-2 text-xs text-slate-500 border-t border-slate-700/50 italic">
              New source: "{value}" — will be created on first import
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
