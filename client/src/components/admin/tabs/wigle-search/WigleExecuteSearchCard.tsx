import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { SearchIcon } from './WigleSearchIcons';
import type { WigleApiStatus } from '../../../../types/admin';

export interface WigleExecuteSearchCardProps {
  searchType: 'wifi' | 'bluetooth';
  searchLoading: boolean;
  apiStatus: WigleApiStatus | null;
  runSearch: (autoImport?: boolean) => Promise<void>;
  saveCurrentSsid: () => Promise<void>;
  importAllResults: () => Promise<void>;
  importAllBluetooth: () => Promise<void>;
  btImportLoading: boolean;
  btImportError: string | null;
  searchError: string | null;
}

export const WigleExecuteSearchCard: React.FC<WigleExecuteSearchCardProps> = ({
  searchType,
  searchLoading,
  apiStatus,
  runSearch,
  saveCurrentSsid,
  importAllResults,
  importAllBluetooth,
  btImportLoading,
  btImportError,
  searchError,
}) => {
  return (
    <div className="md:col-span-2">
      <AdminCard icon={SearchIcon} title="Execute Search" color="from-purple-500 to-purple-600">
        <div className="space-y-3">
          {searchType === 'wifi' ? (
            <>
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
            </>
          ) : (
            <>
              <p className="text-sm text-slate-400">
                Import BT/BLE devices from WiGLE using the geographic and manufacturer filters.
              </p>
              <button
                onClick={importAllBluetooth}
                disabled={btImportLoading || !apiStatus?.configured}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-medium hover:from-purple-500 hover:to-purple-600 disabled:opacity-50 text-sm transition-all"
              >
                {btImportLoading ? 'Starting BT Import...' : 'Import All BT/BLE Pages'}
              </button>
              {btImportError && (
                <div className="text-red-400 text-sm p-2 bg-red-900/20 rounded border border-red-700/50">
                  {btImportError}
                </div>
              )}
            </>
          )}
          <p className="text-xs text-slate-500">
            Server walks all pages with paced requests and retry backoff on WiGLE rate limits.
          </p>
          {searchType === 'wifi' && searchError && (
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
  );
};
