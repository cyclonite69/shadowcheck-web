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
  } = useWigleSearch();

  useEffect(() => {
    loadApiStatus();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* WiGLE API Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminCard icon={SearchIcon} title="API Status" color="from-orange-500 to-orange-600">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-300 text-sm">Status:</span>
              <span
                className={`text-sm font-semibold ${apiStatus?.configured ? 'text-green-400' : 'text-red-400'}`}
              >
                {apiStatus?.configured ? 'Configured' : 'Not Configured'}
              </span>
            </div>
            {apiStatus?.username && (
              <div className="flex justify-between">
                <span className="text-slate-300 text-sm">Username:</span>
                <span className="text-sm font-semibold text-blue-400">{apiStatus.username}</span>
              </div>
            )}
            {apiStatus?.error && <div className="text-xs text-red-400 mt-2">{apiStatus.error}</div>}
          </div>
        </AdminCard>
        <div className="md:col-span-2">
          <AdminCard
            icon={DatabaseIcon}
            title="Search Parameters"
            color="from-blue-500 to-blue-600"
          >
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-slate-300 mb-1">SSID</label>
                <input
                  type="text"
                  value={searchParams.ssid}
                  onChange={(e) => setSearchParams({ ...searchParams, ssid: e.target.value })}
                  placeholder="Network name"
                  className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">BSSID</label>
                <input
                  type="text"
                  value={searchParams.bssid}
                  onChange={(e) => setSearchParams({ ...searchParams, bssid: e.target.value })}
                  placeholder="AA:BB:CC:DD:EE:FF"
                  className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Lat Range</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={searchParams.latrange1}
                    onChange={(e) =>
                      setSearchParams({ ...searchParams, latrange1: e.target.value })
                    }
                    placeholder="Min"
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs"
                  />
                  <input
                    type="number"
                    value={searchParams.latrange2}
                    onChange={(e) =>
                      setSearchParams({ ...searchParams, latrange2: e.target.value })
                    }
                    placeholder="Max"
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Long Range</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={searchParams.longrange1}
                    onChange={(e) =>
                      setSearchParams({ ...searchParams, longrange1: e.target.value })
                    }
                    placeholder="Min"
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs"
                  />
                  <input
                    type="number"
                    value={searchParams.longrange2}
                    onChange={(e) =>
                      setSearchParams({ ...searchParams, longrange2: e.target.value })
                    }
                    placeholder="Max"
                    className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs"
                  />
                </div>
              </div>
            </div>
          </AdminCard>
        </div>
      </div>

      {/* Search Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AdminCard icon={SearchIcon} title="Search WiGLE" color="from-purple-500 to-purple-600">
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              Search the WiGLE database for networks matching your criteria
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => runSearch(false)}
                disabled={searchLoading || !apiStatus?.configured}
                className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-medium hover:from-purple-500 hover:to-purple-600 disabled:opacity-50 text-sm"
              >
                {searchLoading ? 'Searching...' : 'Search Only'}
              </button>
              <button
                onClick={() => runSearch(true)}
                disabled={searchLoading || !apiStatus?.configured}
                className="flex-1 px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-500 hover:to-green-600 disabled:opacity-50 text-sm"
              >
                {searchLoading ? 'Searching...' : 'Search & Import'}
              </button>
            </div>
            {searchError && <div className="text-red-400 text-sm">{searchError}</div>}
            {!apiStatus?.configured && (
              <div className="text-yellow-400 text-xs">
                Configure WiGLE API credentials in environment variables
              </div>
            )}
          </div>
        </AdminCard>

        <AdminCard
          icon={DownloadIcon}
          title="Search Results"
          color="from-emerald-500 to-emerald-600"
        >
          <div className="space-y-3">
            {searchResults ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">Results:</span>
                  <span className="text-emerald-400 font-semibold">
                    {searchResults.resultCount || 0}
                  </span>
                </div>
                {searchResults.imported && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Imported:</span>
                    <span className="text-green-400 font-semibold">{searchResults.imported}</span>
                  </div>
                )}
                <div className="text-xs text-slate-400">Search completed successfully</div>
              </>
            ) : (
              <div className="text-center text-slate-500 py-6">
                <p className="text-sm">No search results yet</p>
                <p className="text-xs mt-1">Run a search to see results</p>
              </div>
            )}
          </div>
        </AdminCard>
      </div>
    </div>
  );
};
