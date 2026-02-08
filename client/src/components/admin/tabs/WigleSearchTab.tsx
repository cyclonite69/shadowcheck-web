import React, { useEffect } from 'react';
import { AdminCard } from '../components/AdminCard';
import { useWigleSearch } from '../hooks/useWigleSearch';

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

const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

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
    loadMoreResults,
    hasMorePages,
    currentPage,
    totalPages,
    totalResults,
    loadedCount,
  } = useWigleSearch();

  useEffect(() => {
    loadApiStatus();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Status Row */}
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

      {/* Coordinate Ranges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <div className={searchResults ? 'md:col-span-2' : ''}>
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
                              <td className="px-3 py-2 font-mono text-slate-400">{net.bssid}</td>
                              <td className="px-3 py-2">{net.type}</td>
                              <td className="px-3 py-2">{net.encryption}</td>
                              <td className="px-3 py-2">
                                {[net.city, net.region, net.country].filter(Boolean).join(', ')}
                              </td>
                              <td className="px-3 py-2">
                                {net.lasttime ? new Date(net.lasttime).toLocaleDateString() : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pagination controls */}
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
    </div>
  );
};
