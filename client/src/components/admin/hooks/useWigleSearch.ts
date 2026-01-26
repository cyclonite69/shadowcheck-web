import { useState, useEffect } from 'react';
import { WigleSearchParams, WigleApiStatus, WigleSearchResults } from '../types/admin.types';

export const useWigleSearch = () => {
  const [apiStatus, setApiStatus] = useState<WigleApiStatus | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<WigleSearchResults | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searchParams, setSearchParams] = useState<WigleSearchParams>({
    ssid: '',
    bssid: '',
    latrange1: '',
    latrange2: '',
    longrange1: '',
    longrange2: '',
  });

  const loadApiStatus = async () => {
    try {
      const res = await fetch('/api/wigle/api-status');
      const data = await res.json();
      setApiStatus(data);
    } catch {
      setApiStatus({ configured: false, error: 'Failed to check status' });
    }
  };

  const runSearch = async (importResults = false) => {
    setSearchError('');
    setSearchResults(null);
    setSearchLoading(true);
    try {
      const res = await fetch('/api/wigle/search-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...searchParams,
          import: importResults,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      setSearchResults(data);
    } catch (err: any) {
      setSearchError(err?.message || 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  return {
    apiStatus,
    searchLoading,
    searchResults,
    searchError,
    searchParams,
    setSearchParams,
    loadApiStatus,
    runSearch,
  };
};
