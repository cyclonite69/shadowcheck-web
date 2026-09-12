import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { formatShortDate } from '../../../../utils/formatDate';
import { DownloadIcon } from './WigleSearchIcons';
import type { WigleNetworkResult, WigleSearchResults } from '../../../../types/admin';

export interface WigleSearchResultsCardProps {
  searchResults: WigleSearchResults | null;
  totalResults: number;
  loadedCount: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  selectedNetwork: WigleNetworkResult | null;
  handleRowClick: (net: WigleNetworkResult) => void;
  searchLoading: boolean;
  hasMorePages: boolean;
  loadMoreResults: (autoImport?: boolean) => Promise<void>;
}

export const WigleSearchResultsCard: React.FC<WigleSearchResultsCardProps> = ({
  searchResults,
  totalResults,
  loadedCount,
  scrollRef,
  selectedNetwork,
  handleRowClick,
  searchLoading,
  hasMorePages,
  loadMoreResults,
}) => {
  return (
    <div className="md:col-span-3">
      <AdminCard icon={DownloadIcon} title="Search Results" color="from-emerald-500 to-emerald-600">
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
                            ((selectedNetwork as any)?.netid || selectedNetwork?.bssid) === bssid;
                          const city = net.geocoded_city || net.city || '—';
                          const state = net.geocoded_state || net.region || '—';
                          const firstSeen = net.firsttime || null;
                          const lastSeen = net.lasttime || null;
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
                      <p className="px-3 py-3 text-xs text-slate-500">Loading more results...</p>
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
  );
};
