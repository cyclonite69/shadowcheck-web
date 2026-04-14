import React, { useEffect, useRef } from 'react';
import { AdminCard } from '../components/AdminCard';
import { useWigleSearch } from '../hooks/useWigleSearch';
import { useWigleRuns } from '../hooks/useWigleRuns';
import { US_STATES } from '../../../constants/network';
import { formatShortDate } from '../../../utils/formatDate';
import { WigleRunsCard } from '../components/WigleRunsCard';
import { renderNetworkTooltip } from '../../../utils/geospatial/renderNetworkTooltip';
import { normalizeTooltipData } from '../../../utils/geospatial/tooltipDataNormalizer';

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

  const [activeTooltip, setActiveTooltip] = React.useState<{ bssid: string; html: string } | null>(
    null
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleRowClick = (net: any, event: React.MouseEvent<HTMLTableRowElement>) => {
    const bssid = net.netid || net.bssid;
    if (activeTooltip?.bssid === bssid) {
      setActiveTooltip(null);
      return;
    }
    // Derive frequency from channel when frequency is absent (WiGLE v2 omits it)
    const ch = net.channel ? Number(net.channel) : null;
    const derivedFreq = ch
      ? ch >= 1 && ch <= 13
        ? 2407 + ch * 5
        : ch === 14
          ? 2484
          : ch >= 36 && ch <= 177
            ? 5000 + ch * 5
            : null
      : null;
    const normalized = normalizeTooltipData({
      ...net,
      bssid,
      lat: net.trilat ?? net.lat ?? net.latitude,
      lon: net.trilong ?? net.lon ?? net.longitude,
      frequency: net.frequency || derivedFreq,
    });
    const html = renderNetworkTooltip({ ...normalized, triggerElement: event.currentTarget });
    if (html) setActiveTooltip({ bssid, html });
  };

  useEffect(() => {
    loadApiStatus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveTooltip(null);
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
      {report && (
        <AdminCard
          icon={BadgeIcon}
          title="WiGLE Coverage by State"
          color="from-amber-500 to-amber-600"
        >
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase mb-3 flex items-center justify-between">
              <span>Coverage Snapshot</span>
              <span className="text-[10px] text-slate-500 font-normal">
                Updated: {new Date(report.generatedAt).toLocaleTimeString()}
              </span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {report.states
                ?.filter((s) => s.storedCount > 0 || s.runId)
                .slice(0, 15)
                .map((s) => (
                  <div
                    key={s.state}
                    className="p-2 bg-slate-900/40 rounded border border-slate-800/60 flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-black text-white">{s.state}</span>
                      <span
                        className={`text-[9px] px-1 rounded ${
                          s.status === 'completed'
                            ? 'text-emerald-400 bg-emerald-500/5'
                            : s.status === 'failed'
                              ? 'text-red-400 bg-red-500/5'
                              : s.status === 'running'
                                ? 'text-blue-400 bg-blue-500/5'
                                : 'text-slate-600'
                        }`}
                      >
                        {s.status === 'completed' ? '✓' : s.status ? '...' : ''}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-slate-100">
                      {s.storedCount.toLocaleString()}
                    </div>
                    <div className="text-[9px] text-slate-500 uppercase font-semibold">
                      Networks
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </AdminCard>
      )}

      {/* Search Parameters */}
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

      {/* Coordinate Ranges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Latitude Range */}
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

        {/* Longitude Range */}
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

      {/* Search Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search Card */}
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

        {/* Results Card - now full width if results exist */}
        <div className={searchResults ? 'md:col-span-3' : ''}>
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
                              <th className="px-3 py-2 whitespace-nowrap">First Seen</th>
                              <th className="px-3 py-2 whitespace-nowrap">Last Seen</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700/50">
                            {searchResults.results.map((net: any, idx: number) => {
                              const bssid = net.netid || net.bssid;
                              const isActive = activeTooltip?.bssid === bssid;
                              const city = net.geocoded_city || net.city || '—';
                              const state = net.geocoded_state || net.region || '—';
                              const firstSeen = net.local_first_seen || net.firsttime || null;
                              const lastSeen = net.local_last_seen || net.lasttime || null;
                              return (
                                <React.Fragment key={idx}>
                                  <tr
                                    className={`cursor-pointer transition-colors ${
                                      isActive ? 'bg-blue-500/10' : 'hover:bg-slate-700/30'
                                    }`}
                                    onClick={(e) => handleRowClick(net, e)}
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
                                  {isActive && (
                                    <tr>
                                      <td
                                        colSpan={8}
                                        style={{
                                          padding: '0 12px 12px',
                                          background: 'transparent',
                                          border: 'none',
                                        }}
                                      >
                                        <div
                                          dangerouslySetInnerHTML={{ __html: activeTooltip.html }}
                                        />
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
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
      />
    </div>
  );
};
