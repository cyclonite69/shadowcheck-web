import React, { useState, useMemo } from 'react';
import type {
  UnusedIndex,
  UnusedIndexSummary,
  UsedIndex,
  UniqueEnforcementIndex,
  DuplicateIndexGroup,
} from '../../hooks/useDbStats';
import { formatShortDate } from '../../../../utils/formatDate';

export interface UniqueEnforcementIndexesCardProps {
  indexes: UniqueEnforcementIndex[];
}

export const UniqueEnforcementIndexesCard: React.FC<UniqueEnforcementIndexesCardProps> = ({
  indexes,
}) => {
  const [uniqueExpanded, setUniqueExpanded] = useState(false);
  const totalBytes = indexes.reduce((s, i) => s + parseInt(i.size_bytes), 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);

  return (
    <div>
      <button
        onClick={() => setUniqueExpanded((v) => !v)}
        className="w-full flex items-center justify-between text-left mb-3"
      >
        <span className="text-sm font-semibold text-slate-200">
          Unique &amp; Primary Key Indexes ({indexes.length} · {totalMb} MB)
        </span>
        <span className="text-slate-500 text-xs">{uniqueExpanded ? '▲ collapse' : '▼ expand'}</span>
      </button>
      {uniqueExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="py-2 pr-4 font-semibold uppercase tracking-wider">Table</th>
                <th className="py-2 px-4 font-semibold uppercase tracking-wider">Index</th>
                <th className="py-2 px-4 font-semibold uppercase tracking-wider text-center">
                  Type
                </th>
                <th className="py-2 px-4 font-semibold uppercase tracking-wider text-center">
                  Kind
                </th>
                <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">
                  Size
                </th>
                <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">
                  Scans
                </th>
                <th className="py-2 pl-4 font-semibold uppercase tracking-wider">Definition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {indexes.map((idx) => (
                <tr key={idx.index_name} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 pr-4 font-mono text-slate-400">{idx.table_name}</td>
                  <td className="py-2 px-4 font-mono text-blue-400 font-medium">
                    {idx.index_name}
                  </td>
                  <td className="py-2 px-4 text-center">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-400 font-mono">
                      {idx.index_type}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-center">
                    {idx.is_primary ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-900/40 text-blue-400 border border-blue-800/40 font-bold">
                        PK
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-violet-900/40 text-violet-400 border border-violet-800/40 font-bold">
                        UNIQUE
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-right tabular-nums text-slate-400">
                    {idx.index_size}
                  </td>
                  <td className="py-2 px-4 text-right tabular-nums">
                    {parseInt(idx.times_used) === 0 ? (
                      <span
                        className="text-slate-600"
                        title="0 scans — constraint enforcement only"
                      >
                        0
                      </span>
                    ) : (
                      <span className="text-emerald-400">
                        {parseInt(idx.times_used).toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pl-4 font-mono text-slate-600 max-w-xs">
                    <span title={idx.index_def}>
                      {idx.index_def.length > 80 ? `${idx.index_def.slice(0, 80)}…` : idx.index_def}
                    </span>
                    {parseInt(idx.times_used) === 0 && (
                      <span className="ml-2 text-[10px] text-slate-700 italic">
                        (0 scans — constraint enforcement only)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export interface DuplicateIndexGroupsCardProps {
  groups: DuplicateIndexGroup[];
}

export const DuplicateIndexGroupsCard: React.FC<DuplicateIndexGroupsCardProps> = ({ groups }) => {
  if (groups.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-400 p-3 bg-emerald-950/30 border border-emerald-900/50 rounded-lg">
        <span>✓</span>
        <span>No duplicate index definitions detected</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((g, i) => (
        <div key={i} className="p-3 bg-amber-950/30 border border-amber-900/50 rounded-lg">
          <div className="text-xs font-semibold text-amber-300 mb-1">
            Table: <span className="font-mono">{g.table_name}</span>
          </div>
          <div className="text-xs text-slate-400">
            Duplicates ({g.count}):{' '}
            {g.indexes.map((name, j) => (
              <span key={j} className="font-mono text-amber-400 mr-2">
                {name}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export interface UnusedIndexReportCardProps {
  unusedIndexes: UnusedIndex[];
  summary?: UnusedIndexSummary;
  statsReset?: string;
}

export const UnusedIndexReportCard: React.FC<UnusedIndexReportCardProps> = ({
  unusedIndexes,
  summary,
  statsReset,
}) => {
  const [indexSearch, setIndexSearch] = useState('');
  const [indexPage, setIndexPage] = useState(0);

  const filteredIndexes = useMemo(() => {
    const query = indexSearch.toLowerCase().trim();
    if (!query) {
      return unusedIndexes;
    }
    return unusedIndexes.filter(
      (idx) =>
        idx.index_name.toLowerCase().includes(query) || idx.table_name.toLowerCase().includes(query)
    );
  }, [unusedIndexes, indexSearch]);

  const paginatedIndexes = useMemo(() => {
    const start = indexPage * 25;
    return filteredIndexes.slice(start, start + 25);
  }, [filteredIndexes, indexPage]);

  return (
    <div>
      {summary && summary.count > 0 && (
        <div className="mb-4 p-3 bg-red-950/30 border border-red-900/50 rounded-lg">
          <p className="text-sm font-medium text-red-300">
            {summary.count} index{summary.count !== 1 ? 'es' : ''} · {summary.total_mb} MB unused (0
            scans since stats reset
            {statsReset ? ` at ${formatShortDate(statsReset)}` : ''})
          </p>
        </div>
      )}

      {/* Search Input */}
      <div className="mb-4 max-w-md relative">
        <input
          type="text"
          placeholder="Search by index or table name..."
          value={indexSearch}
          onChange={(e) => {
            setIndexSearch(e.target.value);
            setIndexPage(0);
          }}
          className="w-full pl-3 pr-10 py-1.5 bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-lg text-xs text-slate-300 placeholder-slate-600 transition-colors focus:outline-none"
        />
        {indexSearch && (
          <button
            onClick={() => {
              setIndexSearch('');
              setIndexPage(0);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm font-bold"
          >
            ×
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="text-slate-500 border-b border-slate-800">
              <th className="py-2 pr-4 font-semibold uppercase tracking-wider">Index Name</th>
              <th className="py-2 px-4 font-semibold uppercase tracking-wider">Table</th>
              <th className="py-2 px-4 font-semibold uppercase tracking-wider text-center">Type</th>
              <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">Size</th>
              <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">Scans</th>
              <th className="py-2 pl-4 font-semibold uppercase tracking-wider">Definition</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {paginatedIndexes.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-600 italic">
                  No matching unused indexes found.
                </td>
              </tr>
            ) : (
              paginatedIndexes.map((idx) => (
                <tr key={idx.index_name} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 pr-4 font-mono text-orange-400 font-medium">
                    {idx.index_name}
                  </td>
                  <td className="py-2 px-4 font-mono text-slate-500">{idx.table_name}</td>
                  <td className="py-2 px-4 text-center">
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-400 font-mono">
                      {idx.index_type}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-right tabular-nums text-slate-400 font-medium">
                    {idx.size_pretty}
                  </td>
                  <td className="py-2 px-4 text-right tabular-nums text-red-400 font-bold">
                    <div>{idx.scan_count} scans</div>
                    <div className="text-slate-600 font-normal">
                      {parseInt(idx.idx_tup_read).toLocaleString()} rows read
                    </div>
                  </td>
                  <td className="py-2 pl-4 font-mono text-slate-600 max-w-xs">
                    <span title={idx.index_def}>
                      {idx.index_def && idx.index_def.length > 80
                        ? `${idx.index_def.slice(0, 80)}…`
                        : idx.index_def}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {filteredIndexes.length > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-800/50 pt-3 text-xs text-slate-400">
          <div>
            Showing <span className="text-slate-300 font-semibold">{indexPage * 25 + 1}</span> to{' '}
            <span className="text-slate-300 font-semibold">
              {Math.min((indexPage + 1) * 25, filteredIndexes.length)}
            </span>{' '}
            of <span className="text-slate-300 font-semibold">{filteredIndexes.length}</span> index
            {filteredIndexes.length !== 1 ? 'es' : ''}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIndexPage((p) => Math.max(0, p - 1))}
              disabled={indexPage === 0}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 font-medium rounded transition-colors border border-slate-700/50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              onClick={() =>
                setIndexPage((p) => Math.min(Math.ceil(filteredIndexes.length / 25) - 1, p + 1))
              }
              disabled={(indexPage + 1) * 25 >= filteredIndexes.length}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 font-medium rounded transition-colors border border-slate-700/50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export interface UsedIndexReportCardProps {
  usedIndexes: UsedIndex[];
  statsReset?: string;
}

export const UsedIndexReportCard: React.FC<UsedIndexReportCardProps> = ({
  usedIndexes,
  statsReset,
}) => {
  const [usedIndexSearch, setUsedIndexSearch] = useState('');
  const [usedIndexPage, setUsedIndexPage] = useState(0);

  const filteredUsedIndexes = useMemo(() => {
    const query = usedIndexSearch.toLowerCase().trim();
    if (!query) {
      return usedIndexes;
    }
    return usedIndexes.filter(
      (idx) =>
        idx.index_name.toLowerCase().includes(query) || idx.table_name.toLowerCase().includes(query)
    );
  }, [usedIndexes, usedIndexSearch]);

  const paginatedUsedIndexes = useMemo(() => {
    const start = usedIndexPage * 25;
    return filteredUsedIndexes.slice(start, start + 25);
  }, [filteredUsedIndexes, usedIndexPage]);

  return (
    <div>
      <div className="mb-4 p-3 bg-emerald-950/30 border border-emerald-900/50 rounded-lg">
        <p className="text-sm font-medium text-emerald-300">
          Top {usedIndexes.length} most-scanned indexes · since{' '}
          {statsReset ? formatShortDate(statsReset) : 'last stats reset'}
        </p>
      </div>

      {/* Search Input */}
      <div className="mb-4 max-w-md relative">
        <input
          type="text"
          placeholder="Search by index or table name..."
          value={usedIndexSearch}
          onChange={(e) => {
            setUsedIndexSearch(e.target.value);
            setUsedIndexPage(0);
          }}
          className="w-full pl-3 pr-10 py-1.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg text-xs text-slate-300 placeholder-slate-600 transition-colors focus:outline-none"
        />
        {usedIndexSearch && (
          <button
            onClick={() => {
              setUsedIndexSearch('');
              setUsedIndexPage(0);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm font-bold"
          >
            ×
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="text-slate-500 border-b border-slate-800">
              <th className="py-2 pr-4 font-semibold uppercase tracking-wider">Index Name</th>
              <th className="py-2 px-4 font-semibold uppercase tracking-wider">Table</th>
              <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">Size</th>
              <th className="py-2 px-4 font-semibold uppercase tracking-wider text-right">Scans</th>
              <th className="py-2 pl-4 font-semibold uppercase tracking-wider text-right">
                Tuples Read
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {paginatedUsedIndexes.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-600 italic">
                  No matching used indexes found.
                </td>
              </tr>
            ) : (
              paginatedUsedIndexes.map((idx) => (
                <tr key={idx.index_name} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 pr-4 font-mono text-emerald-400 font-medium">
                    {idx.index_name}
                  </td>
                  <td className="py-2 px-4 font-mono text-slate-500">{idx.table_name}</td>
                  <td className="py-2 px-4 text-right tabular-nums text-slate-400 font-medium">
                    {idx.size_pretty}
                  </td>
                  <td className="py-2 px-4 text-right tabular-nums text-emerald-400 font-bold">
                    {parseInt(idx.scan_count).toLocaleString()}
                  </td>
                  <td className="py-2 pl-4 text-right tabular-nums text-slate-500">
                    {parseInt(idx.tuples_read).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {filteredUsedIndexes.length > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-800/50 pt-3 text-xs text-slate-400">
          <div>
            Showing <span className="text-slate-300 font-semibold">{usedIndexPage * 25 + 1}</span>{' '}
            to{' '}
            <span className="text-slate-300 font-semibold">
              {Math.min((usedIndexPage + 1) * 25, filteredUsedIndexes.length)}
            </span>{' '}
            of <span className="text-slate-300 font-semibold">{filteredUsedIndexes.length}</span>{' '}
            index{filteredUsedIndexes.length !== 1 ? 'es' : ''}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setUsedIndexPage((p) => Math.max(0, p - 1))}
              disabled={usedIndexPage === 0}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 font-medium rounded transition-colors border border-slate-700/50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              onClick={() =>
                setUsedIndexPage((p) =>
                  Math.min(Math.ceil(filteredUsedIndexes.length / 25) - 1, p + 1)
                )
              }
              disabled={(usedIndexPage + 1) * 25 >= filteredUsedIndexes.length}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 font-medium rounded transition-colors border border-slate-700/50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
