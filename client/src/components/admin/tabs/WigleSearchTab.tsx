import React, { useEffect } from 'react';
import { AdminCard } from '../components/AdminCard';
import { useWigleSearch } from '../hooks/useWigleSearch';
import { US_STATES } from '../../../constants/network';
import { formatShortDate } from '../../../utils/formatDate';
import type { WigleImportCompletenessState, WigleImportRun } from '../types/admin.types';

const SearchIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const DatabaseIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
);

const DownloadIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const fmtNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString();
};

const statusTone = (status: WigleImportRun['status'] | null | undefined) => {
  switch (status) {
    case 'completed':
      return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
    case 'running':
      return 'text-sky-300 border-sky-500/30 bg-sky-500/10';
    case 'paused':
      return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
    case 'failed':
      return 'text-red-300 border-red-500/30 bg-red-500/10';
    case 'cancelled':
      return 'text-slate-300 border-slate-500/30 bg-slate-500/10';
    default:
      return 'text-slate-300 border-slate-500/30 bg-slate-500/10';
  }
};

const StatusBadge = ({ status }: { status: WigleImportRun['status'] | null | undefined }) => (
  <span
    className={
      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ' +
      statusTone(status)
    }
  >
    {status || 'unknown'}
  </span>
);

const runSummary = (run: WigleImportRun | null) => {
  if (!run) return 'No active import run selected.';
  const parts = [];
  if (run.state) parts.push(run.state);
  if (run.searchTerm) parts.push(run.searchTerm);
  parts.push('page ' + run.nextPage + ' next');
  return parts.join(' · ');
};

const operatorCoverageRows = (rows: WigleImportCompletenessState[]) =>
  [...rows].sort((a, b) => {
    const aGap = a.missingApiRows ?? Number.MAX_SAFE_INTEGER;
    const bGap = b.missingApiRows ?? Number.MAX_SAFE_INTEGER;
    if (aGap !== bGap) return bGap - aGap;
    return a.state.localeCompare(b.state);
  });

export const WigleSearchTab: React.FC = () => {
  const {
    apiStatus,
    searchLoading,
    searchResults,
    searchError,
    searchParams,
    setSearchParams,
    loadApiStatus,
    loadImportOperations,
    runSearch,
    importAllResults,
    loadMoreResults,
    hasMorePages,
    currentPage,
    totalPages,
    totalResults,
    loadedCount,
    lastImportRun,
    importRuns,
    importRunsLoading,
    importRunsError,
    completenessReport,
    completenessLoading,
    completenessError,
    currentRunActionId,
    resumeImportRun,
    pauseImportRun,
    cancelImportRun,
    operatorSearchTerm,
  } = useWigleSearch();

  useEffect(() => {
    loadApiStatus();
  }, []);

  useEffect(() => {
    loadImportOperations();
  }, [
    searchParams.ssid,
    searchParams.bssid,
    searchParams.city,
    searchParams.region,
    searchParams.country,
  ]);

  const coverageRows = operatorCoverageRows(completenessReport);
  const coverageStates = coverageRows.length;
  const missingCoverageStates = coverageRows.filter((row) => (row.missingApiRows || 0) > 0).length;
  const resumableStates = coverageRows.filter((row) => row.resumable).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminCard
          icon={SearchIcon}
          title="API Status"
          color="from-orange-500 to-orange-600"
          compact
        >
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Status:</span>
              <span
                className={`font-semibold ${apiStatus?.configured ? 'text-green-400' : 'text-red-400'}`}
              >
                {apiStatus?.configured ? 'Configured' : 'Unconfigured'}
              </span>
            </div>
            {apiStatus?.username && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">User:</span>
                <span className="text-blue-400 font-semibold text-xs">{apiStatus.username}</span>
              </div>
            )}
            {apiStatus?.error && (
              <div className="text-xs text-red-400 mt-2 p-2 bg-red-900/20 rounded">
                {apiStatus.error}
              </div>
            )}
          </div>
        </AdminCard>

        <div className="md:col-span-2">
          <AdminCard
            icon={DatabaseIcon}
            title="Search Parameters"
            color="from-blue-500 to-blue-600"
            compact
          >
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <label className="block text-xs text-slate-400 mb-1">SSID</label>
                <input
                  type="text"
                  value={searchParams.ssid}
                  onChange={(e) => setSearchParams({ ...searchParams, ssid: e.target.value })}
                  placeholder="Network name"
                  className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">BSSID</label>
                <input
                  type="text"
                  value={searchParams.bssid}
                  onChange={(e) => setSearchParams({ ...searchParams, bssid: e.target.value })}
                  placeholder="AA:BB:CC:DD:EE:FF"
                  className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm mt-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">API Version</label>
                <div className="flex rounded border border-slate-600/60 overflow-hidden">
                  {(['v2', 'v3'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSearchParams({ ...searchParams, version: v })}
                      className={`flex-1 py-1.5 text-[10px] font-bold uppercase transition-colors ${
                        (searchParams.version || 'v2') === v
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Country</label>
                <input
                  type="text"
                  value={searchParams.country}
                  onChange={(e) => setSearchParams({ ...searchParams, country: e.target.value })}
                  placeholder="US"
                  className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">State</label>
                <select
                  value={searchParams.region}
                  onChange={(e) => setSearchParams({ ...searchParams, region: e.target.value })}
                  className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="">Any</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">City</label>
                <input
                  type="text"
                  value={searchParams.city}
                  onChange={(e) => setSearchParams({ ...searchParams, city: e.target.value })}
                  placeholder="City name"
                  className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>
          </AdminCard>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminCard
          icon={DatabaseIcon}
          title="Latitude Range"
          color="from-indigo-500 to-indigo-600"
          compact
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Min</label>
                <input
                  type="number"
                  value={searchParams.latrange1}
                  onChange={(e) => setSearchParams({ ...searchParams, latrange1: e.target.value })}
                  placeholder="Min latitude"
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/60 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Max</label>
                <input
                  type="number"
                  value={searchParams.latrange2}
                  onChange={(e) => setSearchParams({ ...searchParams, latrange2: e.target.value })}
                  placeholder="Max latitude"
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/60 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>
          </div>
        </AdminCard>

        <AdminCard
          icon={DatabaseIcon}
          title="Longitude Range"
          color="from-teal-500 to-teal-600"
          compact
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Min</label>
                <input
                  type="number"
                  value={searchParams.longrange1}
                  onChange={(e) => setSearchParams({ ...searchParams, longrange1: e.target.value })}
                  placeholder="Min longitude"
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/60 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Max</label>
                <input
                  type="number"
                  value={searchParams.longrange2}
                  onChange={(e) => setSearchParams({ ...searchParams, longrange2: e.target.value })}
                  placeholder="Max longitude"
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/60 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                />
              </div>
            </div>
          </div>
        </AdminCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <AdminCard icon={SearchIcon} title="Execute Search" color="from-purple-500 to-purple-600">
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Search the WiGLE database using your configured parameters.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => runSearch(false)}
                disabled={searchLoading || !apiStatus?.configured}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-medium hover:from-purple-500 hover:to-purple-600 disabled:opacity-50 text-sm transition-all"
              >
                {searchLoading ? 'Searching...' : 'Search Only'}
              </button>
              <button
                onClick={() => runSearch(true)}
                disabled={searchLoading || !apiStatus?.configured}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-500 hover:to-green-600 disabled:opacity-50 text-sm transition-all"
              >
                {searchLoading ? 'Searching...' : 'Search & Import'}
              </button>
            </div>
            <button
              onClick={importAllResults}
              disabled={searchLoading || !apiStatus?.configured}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg font-medium hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-sm transition-all"
            >
              {searchLoading ? 'Running Import...' : 'Import All Pages'}
            </button>
            <p className="text-xs text-slate-400">
              Server walks all pages with paced requests and retry backoff on WiGLE rate limits.
            </p>
            {searchError && (
              <div className="text-red-400 text-sm p-2 bg-red-900/20 rounded border border-red-700/50">
                {searchError}
              </div>
            )}
            {!apiStatus?.configured && (
              <div className="text-yellow-400 text-xs p-2 bg-yellow-900/20 rounded border border-yellow-700/50">
                Configure WiGLE API in environment variables
              </div>
            )}
          </div>
        </AdminCard>

        <AdminCard icon={DatabaseIcon} title="Import Recovery" color="from-cyan-500 to-cyan-600">
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Active Context
                  </div>
                  <div className="mt-1 text-sm text-white">{runSummary(lastImportRun)}</div>
                </div>
                <StatusBadge status={lastImportRun?.status} />
              </div>
              {lastImportRun && (
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
                  <div>
                    <div className="text-slate-500">Returned</div>
                    <div className="font-mono text-slate-200">
                      {fmtNumber(lastImportRun.rowsReturned)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Inserted</div>
                    <div className="font-mono text-slate-200">
                      {fmtNumber(lastImportRun.rowsInserted)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Pages</div>
                    <div className="font-mono text-slate-200">
                      {fmtNumber(lastImportRun.pagesFetched)} /{' '}
                      {fmtNumber(lastImportRun.totalPages)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Resumable Runs
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {operatorSearchTerm
                    ? 'Filtered to ' + operatorSearchTerm
                    : 'Showing latest actionable runs'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadImportOperations()}
                disabled={importRunsLoading || completenessLoading}
                className="px-3 py-1.5 rounded border border-slate-600/60 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            {importRunsError && (
              <div className="rounded border border-red-700/50 bg-red-950/20 px-3 py-2 text-xs text-red-300">
                {importRunsError}
              </div>
            )}

            <div className="space-y-2 max-h-[20rem] overflow-y-auto pr-1">
              {importRunsLoading ? (
                <div className="text-sm text-slate-500">Loading import runs...</div>
              ) : importRuns.length === 0 ? (
                <div className="rounded border border-slate-700/50 bg-slate-950/30 px-3 py-3 text-sm text-slate-400">
                  No paused, failed, or running imports match the current filter.
                </div>
              ) : (
                importRuns.map((run) => (
                  <div
                    key={run.id}
                    className="rounded-lg border border-slate-700/50 bg-slate-950/30 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          #{run.id} {run.state || 'all states'}{' '}
                          {run.searchTerm ? '· ' + run.searchTerm : ''}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          next page {run.nextPage} · {fmtNumber(run.rowsReturned)} returned ·{' '}
                          {fmtNumber(run.rowsInserted)} inserted
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          updated {run.startedAt ? formatShortDate(run.startedAt) : '—'}
                        </div>
                      </div>
                      <StatusBadge status={run.status} />
                    </div>
                    {run.lastError && (
                      <div className="mt-2 rounded border border-red-700/40 bg-red-950/20 px-2 py-1.5 text-xs text-red-300">
                        {run.lastError}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {run.status !== 'completed' && run.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => resumeImportRun(run.id)}
                          disabled={currentRunActionId === run.id}
                          className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {currentRunActionId === run.id ? 'Working...' : 'Resume'}
                        </button>
                      )}
                      {run.status === 'running' && (
                        <button
                          type="button"
                          onClick={() => pauseImportRun(run.id)}
                          disabled={currentRunActionId === run.id}
                          className="px-3 py-1.5 rounded bg-amber-600 text-white text-xs font-medium hover:bg-amber-500 disabled:opacity-50"
                        >
                          Pause
                        </button>
                      )}
                      {run.status !== 'completed' && run.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => cancelImportRun(run.id)}
                          disabled={currentRunActionId === run.id}
                          className="px-3 py-1.5 rounded bg-slate-700 text-white text-xs font-medium hover:bg-slate-600 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </AdminCard>

        <AdminCard
          icon={DownloadIcon}
          title="State Coverage"
          color="from-emerald-500 to-emerald-600"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-700/50 bg-slate-950/40 p-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">States</div>
                <div className="mt-1 text-xl font-bold text-white">{coverageStates}</div>
              </div>
              <div className="rounded-lg border border-slate-700/50 bg-slate-950/40 p-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">Gaps</div>
                <div className="mt-1 text-xl font-bold text-amber-300">{missingCoverageStates}</div>
              </div>
              <div className="rounded-lg border border-slate-700/50 bg-slate-950/40 p-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">
                  Resumable
                </div>
                <div className="mt-1 text-xl font-bold text-sky-300">{resumableStates}</div>
              </div>
            </div>

            <div className="text-xs text-slate-400">
              {operatorSearchTerm ? (
                <span>
                  Coverage view for search term{' '}
                  <span className="font-mono text-slate-200">{operatorSearchTerm}</span>.
                </span>
              ) : (
                <span>
                  Coverage view for the current state filter. Add an SSID like{' '}
                  <span className="font-mono text-slate-200">fbi</span> to see where it still needs
                  coverage.
                </span>
              )}
            </div>

            {completenessError && (
              <div className="rounded border border-red-700/50 bg-red-950/20 px-3 py-2 text-xs text-red-300">
                {completenessError}
              </div>
            )}

            {completenessLoading ? (
              <div className="text-sm text-slate-500">Loading state coverage...</div>
            ) : coverageRows.length === 0 ? (
              <div className="rounded border border-slate-700/50 bg-slate-950/30 px-3 py-3 text-sm text-slate-400">
                No state coverage rows match the current filter.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-700/60">
                <table className="w-full text-xs text-left text-slate-300">
                  <thead className="bg-slate-800 text-slate-400 uppercase">
                    <tr>
                      <th className="px-3 py-2">State</th>
                      <th className="px-3 py-2 text-right">Stored</th>
                      <th className="px-3 py-2 text-right">API</th>
                      <th className="px-3 py-2 text-right">Gap</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {coverageRows.slice(0, 15).map((row) => (
                      <tr key={row.state} className="hover:bg-slate-800/30">
                        <td className="px-3 py-2 font-semibold text-white">{row.state}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {fmtNumber(row.storedCount)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {fmtNumber(row.apiTotalResults)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-amber-300">
                          {fmtNumber(row.missingApiRows)}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            {row.resumable && row.runId ? (
                              <button
                                type="button"
                                onClick={() => resumeImportRun(row.runId as number)}
                                disabled={currentRunActionId === row.runId}
                                className="px-2.5 py-1 rounded bg-sky-600 text-white text-[11px] font-medium hover:bg-sky-500 disabled:opacity-50"
                              >
                                Resume
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() =>
                                setSearchParams({ ...searchParams, region: row.state })
                              }
                              className="px-2.5 py-1 rounded border border-slate-600/60 text-[11px] text-slate-200 hover:bg-slate-800"
                            >
                              Use State
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </AdminCard>
      </div>

      <div>
        <AdminCard
          icon={DownloadIcon}
          title="Search Results"
          color="from-emerald-500 to-emerald-600"
        >
          <div className="space-y-3">
            {searchResults ? (
              <>
                <div className="space-y-2 p-3 bg-emerald-900/20 rounded border border-emerald-700/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total in WiGLE:</span>
                    <span className="font-semibold text-emerald-400">
                      {totalResults.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Loaded:</span>
                    <span className="font-semibold text-blue-400">
                      {loadedCount.toLocaleString()} / {totalResults.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Page:</span>
                    <span className="font-semibold text-slate-300">
                      {currentPage} of {totalPages}
                    </span>
                  </div>
                  {searchResults.pagesProcessed && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Pages Processed:</span>
                      <span className="font-semibold text-slate-300">
                        {searchResults.pagesProcessed}
                      </span>
                    </div>
                  )}
                  {searchResults.imported && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Imported:</span>
                      <span className="font-semibold text-green-400">
                        {searchResults.imported.count}
                      </span>
                    </div>
                  )}
                </div>

                {searchResults.results && searchResults.results.length > 0 && (
                  <div className="overflow-x-auto mt-4 rounded-lg border border-slate-700">
                    <table className="w-full text-xs text-left text-slate-300">
                      <thead className="bg-slate-800 text-slate-400 uppercase">
                        <tr>
                          <th className="px-3 py-2">SSID</th>
                          <th className="px-3 py-2">BSSID</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Encryption</th>
                          <th className="px-3 py-2">Location</th>
                          <th className="px-3 py-2">Last Seen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {searchResults.results.map((net, idx) => (
                          <tr key={idx} className="hover:bg-slate-700/30">
                            <td className="px-3 py-2 font-medium text-white">
                              {net.ssid || '<hidden>'}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-400">
                              {net.netid || net.bssid}
                            </td>
                            <td className="px-3 py-2">{net.type}</td>
                            <td className="px-3 py-2">{net.encryption}</td>
                            <td className="px-3 py-2">
                              {[net.city, net.region, net.country].filter(Boolean).join(', ')}
                            </td>
                            <td className="px-3 py-2">
                              {net.lasttime ? formatShortDate(net.lasttime) : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {hasMorePages && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700/50">
                    <button
                      onClick={() => loadMoreResults(false)}
                      disabled={searchLoading}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 text-sm transition-all"
                    >
                      {searchLoading ? 'Loading...' : `Load Next 100 (Page ${currentPage + 1})`}
                    </button>
                    <button
                      onClick={() => loadMoreResults(true)}
                      disabled={searchLoading}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-500 hover:to-green-600 disabled:opacity-50 text-sm transition-all"
                    >
                      {searchLoading ? 'Loading...' : 'Load & Import Next 100'}
                    </button>
                  </div>
                )}

                <p className="text-xs text-slate-400 mt-2">
                  {hasMorePages
                    ? `Showing ${loadedCount.toLocaleString()} of ${totalResults.toLocaleString()} results`
                    : 'All results loaded'}
                </p>
              </>
            ) : (
              <div className="text-center text-slate-500 py-6">
                <p className="text-sm">No results yet</p>
                <p className="text-xs mt-1">Run a search to see results</p>
              </div>
            )}
          </div>
        </AdminCard>
      </div>
    </div>
  );
};
