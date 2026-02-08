import { useState } from 'react';
import {
  WigleSearchParams,
  WigleApiStatus,
  WigleSearchResults,
  WigleNetworkResult,
} from '../types/admin.types';

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
    country: 'US',
    region: '',
    city: '',
  });
  // Pagination state
  const [allResults, setAllResults] = useState<WigleNetworkResult[]>([]);
  const [searchAfter, setSearchAfter] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);

  const loadApiStatus = async () => {
    try {
      const res = await fetch('/api/wigle/api-status');
      const data = await res.json();
      setApiStatus(data);
    } catch {
      setApiStatus({ configured: false, error: 'Failed to check status' });
    }
  };

  const runSearch = async (importResults = false, loadMore = false) => {
    setSearchError('');
    setSearchLoading(true);

    // If not loading more, reset pagination state
    if (!loadMore) {
      setAllResults([]);
      setSearchAfter(null);
      setTotalResults(0);
      setCurrentPage(1);
      setSearchResults(null);
    }

    try {
      const params = new URLSearchParams();
      if (searchParams.ssid) params.append('ssid', searchParams.ssid);
      if (searchParams.bssid) params.append('bssid', searchParams.bssid);
      if (searchParams.latrange1) params.append('latrange1', searchParams.latrange1);
      if (searchParams.latrange2) params.append('latrange2', searchParams.latrange2);
      if (searchParams.longrange1) params.append('longrange1', searchParams.longrange1);
      if (searchParams.longrange2) params.append('longrange2', searchParams.longrange2);
      if (searchParams.country) params.append('country', searchParams.country);
      if (searchParams.region) params.append('region', searchParams.region);
      if (searchParams.city) params.append('city', searchParams.city);

      // Add searchAfter for pagination
      if (loadMore && searchAfter) {
        params.append('searchAfter', searchAfter);
      }

      const res = await fetch(`/api/wigle/search-api?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ import: importResults }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      // Update pagination state
      const newResults = data.results || [];
      const combinedResults = loadMore ? [...allResults, ...newResults] : newResults;

      setAllResults(combinedResults);
      setSearchAfter(data.searchAfter || null);
      setTotalResults(data.totalResults || combinedResults.length);
      if (loadMore) {
        setCurrentPage((prev) => prev + 1);
      }

      // Update search results with combined data
      setSearchResults({
        ...data,
        results: combinedResults,
        resultCount: combinedResults.length,
      });
    } catch (err: any) {
      setSearchError(err?.message || 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const loadMoreResults = (importResults = false) => {
    if (searchAfter && !searchLoading) {
      runSearch(importResults, true);
    }
  };

  const hasMorePages = searchAfter !== null;
  const totalPages = Math.ceil(totalResults / 100);

  return {
    apiStatus,
    searchLoading,
    searchResults,
    searchError,
    searchParams,
    setSearchParams,
    loadApiStatus,
    runSearch,
    // Pagination
    loadMoreResults,
    hasMorePages,
    currentPage,
    totalPages,
    totalResults,
    loadedCount: allResults.length,
  };
};
