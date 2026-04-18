import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdminCard } from '../components/AdminCard';
import { ObservationsCard } from '../components/ObservationsCard';
import { useWigleSearch } from '../hooks/useWigleSearch';
import { useWigleRuns } from '../hooks/useWigleRuns';
import { US_STATES } from '../../../constants/network';
import { formatShortDate } from '../../../utils/formatDate';
import { WigleRunsCard } from '../components/WigleRunsCard';
import { wigleApi } from '../../../api/wigleApi';
import type { WigleCompletenessReport } from '../hooks/useWigleRuns';
import { getCoverageStatusMeta } from './wigleCoverageStatusMeta';

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

const BadgeIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
  </svg>
);

export const WigleSearchTab: React.FC = () => {
  const {
    apiStatus,
    searchLoading,
    searchResults,
    searchError,
    searchParams,
    setSearchParams,
    loadApiStatus,
    runSearch,
    importAllResults,
    loadMoreResults,
    hasMorePages,
    currentPage,
    totalPages,
    totalResults,
    loadedCount,
  } = useWigleSearch();

  const {
    runs,
    report,
    loading: runsLoading,
    error: runsError,
    actionLoading,
    refresh: refreshRuns,
    resumeRun,
    pauseRun,
    cancelRun,
  } = useWigleRuns({ limit: 100 });

  const [selectedNetwork, setSelectedNetwork] = useState<any | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [savedTerms, setSavedTerms] = useState<Array<{ id: number; term: string }>>([]);
  const [ssidDropdownOpen, setSsidDropdownOpen] = useState(false);
  const ssidInputRef = React.useRef<HTMLInputElement>(null);

  // Coverage dropdown: unique search terms derived from runs
  const coverageTerms = useMemo(
    () => [...new Set(runs.map((r) => r.searchTerm).filter(Boolean))] as string[],
    [runs]
  );
  const [coverageTerm, setCoverageTerm] = useState<string>('');
  const [termReport, setTermReport] = useState<WigleCompletenessReport | null>(null);
  const [termReportLoading, setTermReportLoading] = useState(false);

  // Auto-select first available term
  useEffect(() => {
    if (!coverageTerm && coverageTerms.length > 0) setCoverageTerm(coverageTerms[0]);
  }, [coverageTerms, coverageTerm]);

  // Re-fetch coverage when selected term changes
  useEffect(() => {
    if (!coverageTerm) return;
    setTermReportLoading(true);
    wigleApi
      .getImportCompletenessReport(new URLSearchParams({ searchTerm: coverageTerm }))
      .then((data) => setTermReport(data?.report || null))
      .catch(() => setTermReport(null))
      .finally(() => setTermReportLoading(false));
  }, [coverageTerm]);

  const handleRowClick = (net: any) => {
    const bssid = net.netid || net.bssid;
    setSelectedNetwork((prev: any) => (prev && (prev.netid || prev.bssid) === bssid ? null : net));
  };

  useEffect(() => {
    loadApiStatus();
  }, []);

  useEffect(() => {
    wigleApi
      .getSavedSsidTerms()
      .then((data: any) => setSavedTerms(data?.terms || []))
      .catch(() => {});
  }, []);

  const saveCurrentSsid = async () => {
    const term = searchParams.ssid?.trim() ?? '';
    if (term.length < 3) return;
    try {
      const data = await wigleApi.saveSsidTerm(term);
      if (data?.term) {
        setSavedTerms((prev) => {
          const without = prev.filter((t) => t.id !== data.term.id);
          return [data.term, ...without];
        });
      }
    } catch {}
  };

  const deleteSavedTerm = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Remove this saved search term?')) return;
    try {
      await wigleApi.deleteSavedSsidTerm(id);
      setSavedTerms((prev) => prev.filter((t) => t.id !== id));
    } catch {}
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedNetwork(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      if (searchLoading || !hasMorePages) return;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        if (scrollHeight - scrollTop <= clientHeight + 200) {
          loadMoreResults(false);
        }
      }, 100);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [hasMorePages, searchLoading, loadMoreResults]);

  return (
    <div className="space-y-4">
      {coverageTerms.length > 0 && (
        <AdminCard
          icon={BadgeIcon}
          title="WiGLE Coverage by State"
          color="from-amber-500 to-amber-600"
        >
          <div className="space-y-3">
            {/* Search term selector */}
            <div className="flex items-center gap-2">
              <select
                value={coverageTerm}
                onChange={(e) => setCoverageTerm(e.target.value)}
                className="flex-1 px-2 py-1.5 bg-slate-800/60 border border-slate-700/60 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500/40"
              >
                {coverageTerms.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {termReport && (
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  Updated: {new Date(termReport.generatedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            {/* State grid */}
            {termReportLoading ? (
              <p className="text-xs text-slate-500 py-2">Loading coverage…</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {(termReport?.states ?? [])
                  .filter((s) => (s.rowsInserted ?? 0 > 0) || s.runId)
                  .slice(0, 20)
                  .map((s) => {
                    const statusMeta = getCoverageStatusMeta(s.status, s.rowsInserted);

                    return (
                      <div
                        key={s.state}
                        className="p-2 bg-slate-900/40 rounded border border-slate-800/60 flex flex-col justify-between"
                        title={s.lastError ? `Note: ${s.lastError}` : statusMeta.title || undefined}
                      >
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <span className="text-xs font-black text-white">{s.state}</span>
                          <span
                            className={`text-[9px] px-1 rounded whitespace-nowrap ${statusMeta.className}`}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                        <div className="text-lg font-bold text-slate-100">
                          {(s.rowsInserted ?? 0).toLocaleString()}
                        </div>
                        <div className="text-[9px] text-slate-500 uppercase font-semibold">
                          Imported
                        </div>
                      </div>
                    );
                  })}
                {(termReport?.states ?? []).filter((s) => (s.rowsInserted ?? 0 > 0) || s.runId)
                  .length === 0 && (
                  <p className="col-span-5 text-xs text-slate-500 py-2">
                    No runs found for this search term.
                  </p>
                )}
              </div>
            )}
          </div>
        </AdminCard>
      )}

      {/* Row 1: API Version — compact control bar, not a full card */}
      <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl border border-slate-700/40 bg-slate-900/50 shadow-lg">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide shrink-0">
          API Version
        </span>
        <div className="flex rounded border border-slate-600/60 overflow-hidden">
          {(['v2', 'v3'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSearchParams({ ...searchParams, version: v })}
              className={`px-5 py-1.5 text-[11px] font-bold uppercase transition-colors ${
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

      {/* Row 2: Network Filters | Geographic Filters — 2-column */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AdminCard
          icon={DatabaseIcon}
          title="Network Filters"
          color="from-blue-500 to-blue-600"
          compact
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <label className="block text-xs text-slate-400 mb-1">SSID</label>
              <input
                ref={ssidInputRef}
                type="text"
                value={searchParams.ssid}
                onChange={(e) => setSearchParams({ ...searchParams, ssid: e.target.value })}
                onFocus={() => setSsidDropdownOpen(true)}
                onBlur={() => setTimeout(() => setSsidDropdownOpen(false), 150)}
                placeholder="Network name"
                className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              {ssidDropdownOpen && savedTerms.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-slate-800 border border-slate-600/60 rounded shadow-xl max-h-48 overflow-y-auto">
                  {savedTerms.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-700/60 cursor-pointer group"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchParams({ ...searchParams, ssid: t.term });
                        setSsidDropdownOpen(false);
                      }}
                    >
                      <span className="text-xs text-slate-200 truncate">{t.term}</span>
                      <button
                        type="button"
                        onMouseDown={(e) => deleteSavedTerm(t.id, e)}
                        className="ml-2 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-[10px] leading-none shrink-0"
                        title="Remove saved term"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
        </AdminCard>

        <AdminCard
          icon={DatabaseIcon}
          title="Geographic Filters"
          color="from-indigo-500 to-indigo-600"
          compact
        >
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Country</label>
                <input
                  type="text"
                  value={searchParams.country}
                  onChange={(e) => setSearchParams({ ...searchParams, country: e.target.value })}
                  placeholder="US"
                  className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">State</label>
                <select
                  value={searchParams.region}
                  onChange={(e) => setSearchParams({ ...searchParams, region: e.target.value })}
                  className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="">Any</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">City</label>
              <input
                type="text"
                value={searchParams.city}
                onChange={(e) => setSearchParams({ ...searchParams, city: e.target.value })}
                placeholder="City name"
                className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>
        </AdminCard>
      </div>

      {/* Row 3: Coordinate Ranges — equal 2-column, Min/Max always side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Latitude Range */}
        <AdminCard
          icon={DatabaseIcon}
          title="Latitude Range"
          color="from-indigo-500 to-indigo-600"
          compact
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Min</label>
              <input
                type="number"
                value={searchParams.latrange1}
                onChange={(e) => setSearchParams({ ...searchParams, latrange1: e.target.value })}
                placeholder="Min latitude"
                className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Max</label>
              <input
                type="number"
                value={searchParams.latrange2}
                onChange={(e) => setSearchParams({ ...searchParams, latrange2: e.target.value })}
                placeholder="Max latitude"
                className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>
        </AdminCard>

        {/* Longitude Range */}
        <AdminCard
          icon={DatabaseIcon}
          title="Longitude Range"
          color="from-teal-500 to-teal-600"
          compact
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Min</label>
              <input
                type="number"
                value={searchParams.longrange1}
                onChange={(e) => setSearchParams({ ...searchParams, longrange1: e.target.value })}
                placeholder="Min longitude"
                className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Max</label>
              <input
                type="number"
                value={searchParams.longrange2}
                onChange={(e) => setSearchParams({ ...searchParams, longrange2: e.target.value })}
                placeholder="Max longitude"
                className="w-full px-2 py-1.5 bg-slate-800/50 border border-slate-600/60 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
            </div>
          </div>
        </AdminCard>
      </div>

      {/* Row 4: Execute Search | Search Results — 40/60 split, always side by side */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Execute Search — 2/5 width */}
        <div className="md:col-span-2">
          <AdminCard icon={SearchIcon} title="Execute Search" color="from-purple-500 to-purple-600">
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                Search the WiGLE database using your configured parameters.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    runSearch(false);
                    saveCurrentSsid();
                  }}
                  disabled={searchLoading || !apiStatus?.configured}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-medium hover:from-purple-500 hover:to-purple-600 disabled:opacity-50 text-sm transition-all"
                >
                  {searchLoading ? 'Searching...' : 'Search Only'}
                </button>
                <button
                  onClick={() => {
                    runSearch(true);
                    saveCurrentSsid();
                  }}
                  disabled={searchLoading || !apiStatus?.configured}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-500 hover:to-green-600 disabled:opacity-50 text-sm transition-all"
                >
                  {searchLoading ? 'Searching...' : 'Search & Import'}
                </button>
              </div>
              <button
                onClick={() => {
                  importAllResults();
                  saveCurrentSsid();
                }}
                disabled={searchLoading || !apiStatus?.configured}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg font-medium hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-sm transition-all"
              >
                {searchLoading ? 'Running Import...' : 'Import All Pages'}
              </button>
              <p className="text-xs text-slate-500">
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
        </div>

        {/* Search Results — 3/5 width */}
        <div className="md:col-span-3">
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
                    <>
                      <div
                        ref={scrollRef}
                        className="mt-4 max-h-[36rem] overflow-auto rounded-lg border border-slate-700"
                      >
                        <table className="w-full text-xs text-left text-slate-300">
                          <thead className="bg-slate-800 text-slate-400 uppercase sticky top-0">
                            <tr>
                              <th className="px-3 py-2 whitespace-nowrap">BSSID</th>
                              <th className="px-3 py-2">SSID</th>
                              <th className="px-3 py-2">Type</th>
                              <th className="px-3 py-2">Ch</th>
                              <th className="px-3 py-2">City</th>
                              <th className="px-3 py-2">State</th>
                              <th className="px-3 py-2 whitespace-nowrap text-slate-500">
                                First Seen{' '}
                                <span className="normal-case text-[9px] text-slate-600">(v2)</span>
                              </th>
                              <th className="px-3 py-2 whitespace-nowrap text-slate-500">
                                Last Seen{' '}
                                <span className="normal-case text-[9px] text-slate-600">(v2)</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700/50">
                            {searchResults.results.map((net: any, idx: number) => {
                              const bssid = net.netid || net.bssid;
                              const isActive =
                                (selectedNetwork?.netid || selectedNetwork?.bssid) === bssid;
                              const city = net.geocoded_city || net.city || '—';
                              const state = net.geocoded_state || net.region || '—';
                              const firstSeen = net.local_first_seen || net.firsttime || null;
                              const lastSeen = net.local_last_seen || net.lasttime || null;
                              return (
                                <tr
                                  key={idx}
                                  className={`cursor-pointer transition-colors ${
                                    isActive
                                      ? 'bg-violet-500/10 border-l-2 border-violet-400'
                                      : 'hover:bg-slate-700/30'
                                  }`}
                                  onClick={() => handleRowClick(net)}
                                >
                                  <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">
                                    {bssid}
                                  </td>
                                  <td
                                    className="px-3 py-2 font-medium text-white max-w-[14rem] truncate"
                                    title={net.ssid || undefined}
                                  >
                                    {net.ssid || '(hidden)'}
                                  </td>
                                  <td className="px-3 py-2">{net.type || '—'}</td>
                                  <td className="px-3 py-2 tabular-nums">{net.channel ?? '—'}</td>
                                  <td className="px-3 py-2">{city}</td>
                                  <td className="px-3 py-2">{state}</td>
                                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                                    {firstSeen ? formatShortDate(firstSeen) : '—'}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                                    {lastSeen ? formatShortDate(lastSeen) : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {searchLoading && (
                          <p className="px-3 py-3 text-xs text-slate-500">
                            Loading more results...
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-slate-400">
                          {hasMorePages
                            ? `Showing ${loadedCount.toLocaleString()} of ${totalResults.toLocaleString()} — scroll to load more`
                            : `All ${loadedCount.toLocaleString()} results loaded`}
                        </p>
                        {hasMorePages && (
                          <button
                            onClick={() => loadMoreResults(true)}
                            disabled={searchLoading}
                            className="px-3 py-1.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded font-medium hover:from-green-500 hover:to-green-600 disabled:opacity-50 text-xs transition-all"
                          >
                            {searchLoading ? 'Loading...' : 'Load & Import Next 100'}
                          </button>
                        )}
                      </div>
                    </>
                  )}
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

      {/* Observations Card — populated when a network row is clicked */}
      <ObservationsCard selectedNetwork={selectedNetwork} />

      {/* WiGLE Import Runs Section */}
      <WigleRunsCard
        runs={runs}
        loading={runsLoading}
        actionLoading={actionLoading}
        error={runsError}
        onRefresh={refreshRuns}
        onResume={resumeRun}
        onPause={pauseRun}
        onCancel={cancelRun}
        onCleanupCluster={async () => {
          await wigleApi.cleanupCancelledCluster();
          await refreshRuns();
        }}
      />
    </div>
  );
};
