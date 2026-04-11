import { useState } from 'react';
import { wigleApi } from '../../../api/wigleApi';
import {
  WigleImportRun,
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
    version: 'v2',
  });
  // Pagination state
  const [allResults, setAllResults] = useState<WigleNetworkResult[]>([]);
  const [searchAfter, setSearchAfter] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastImportRun, setLastImportRun] = useState<WigleImportRun | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);

  const loadApiStatus = async () => {
    try {
      const data = await wigleApi.getApiStatus();
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
      if (searchParams.version) params.append('version', searchParams.version);

      // Add searchAfter for pagination
      if (loadMore && searchAfter) {
        params.append('searchAfter', searchAfter);
      }

      // Add import flag if requested
      if (importResults) {
        params.append('import', 'true');
      }

      const data = await wigleApi.searchWigle(params);

      // Update pagination state
      const newResults = data.results || [];
      const combinedResults = loadMore ? [...allResults, ...newResults] : newResults;
      const nextSearchAfter = data.searchAfter ?? data.search_after ?? null;
      const importedCount = typeof data.importedCount === 'number' ? data.importedCount : 0;
      const importErrors = Array.isArray(data.importErrors) ? data.importErrors : [];

      setAllResults(combinedResults);
      setSearchAfter(nextSearchAfter);
      setTotalResults(data.totalResults || combinedResults.length);
      if (loadMore) {
        setCurrentPage((prev) => prev + 1);
      }

      // Update search results with combined data
      setSearchResults({
        ...data,
        searchAfter: nextSearchAfter,
        hasMore: nextSearchAfter !== null,
        results: combinedResults,
        resultCount: combinedResults.length,
        imported:
          data.imported || importResults
            ? {
                count: importedCount,
                errors: importErrors,
              }
            : null,
        importedCount,
        importErrors,
        run: data.run || null,
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

  const importAllResults = async () => {
    setSearchError('');
    setSearchLoading(true);
    setAllResults([]);
    setSearchAfter(null);
    setTotalResults(0);
    setCurrentPage(1);
    setSearchResults(null);

    try {
      const payload: Record<string, string> = {};
      if (searchParams.ssid) payload.ssid = searchParams.ssid;
      if (searchParams.bssid) payload.bssid = searchParams.bssid;
      if (searchParams.latrange1) payload.latrange1 = searchParams.latrange1;
      if (searchParams.latrange2) payload.latrange2 = searchParams.latrange2;
      if (searchParams.longrange1) payload.longrange1 = searchParams.longrange1;
      if (searchParams.longrange2) payload.longrange2 = searchParams.longrange2;
      if (searchParams.country) payload.country = searchParams.country;
      if (searchParams.region) payload.region = searchParams.region;
      if (searchParams.city) payload.city = searchParams.city;
      if (searchParams.version) payload.version = searchParams.version;

      const data = await wigleApi.importAllWigle(payload);
      const results = data.results || [];
      const importedCount = typeof data.importedCount === 'number' ? data.importedCount : 0;
      const importErrors = Array.isArray(data.importErrors) ? data.importErrors : [];
      const run = data.run || null;

      setAllResults(results);
      setSearchAfter(null);
      setTotalResults(data.totalResults || run?.apiTotalResults || results.length);
      setCurrentPage(
        Math.max(
          1,
          data.pagesProcessed ||
            run?.pagesFetched ||
            Math.ceil((data.loadedCount || results.length) / 100) ||
            1
        )
      );
      setLastImportRun(run);
      setSearchResults({
        ...data,
        searchAfter: null,
        hasMore: false,
        results,
        resultCount: results.length,
        loadedCount: data.loadedCount || run?.rowsReturned || results.length,
        pagesProcessed: data.pagesProcessed || run?.pagesFetched || 1,
        totalPages: data.totalPages || run?.totalPages || null,
        imported: {
          count: importedCount,
          errors: importErrors,
        },
        importedCount,
        importErrors,
        run,
      });
    } catch (err: any) {
      setSearchError(err?.message || 'Import all failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const resumeImport = async () => {
    setSearchError('');
    setResumeLoading(true);
    try {
      const payload: Record<string, string> = {};
      if (searchParams.ssid) payload.ssid = searchParams.ssid;
      if (searchParams.bssid) payload.bssid = searchParams.bssid;
      if (searchParams.latrange1) payload.latrange1 = searchParams.latrange1;
      if (searchParams.latrange2) payload.latrange2 = searchParams.latrange2;
      if (searchParams.longrange1) payload.longrange1 = searchParams.longrange1;
      if (searchParams.longrange2) payload.longrange2 = searchParams.longrange2;
      if (searchParams.country) payload.country = searchParams.country;
      if (searchParams.region) payload.region = searchParams.region;
      if (searchParams.city) payload.city = searchParams.city;
      if (searchParams.version) payload.version = searchParams.version;
      const data = await wigleApi.resumeLatestImportRun(payload);
      const run = data.run || null;
      setLastImportRun(run);
      if (run) {
        setTotalResults(run.apiTotalResults || 0);
        setCurrentPage(run.pagesFetched || 1);
      }
    } catch (err: any) {
      setSearchError(err?.message || 'Resume failed');
    } finally {
      setResumeLoading(false);
    }
  };

  const effectiveLoadedCount =
    searchResults?.run?.rowsReturned ?? searchResults?.loadedCount ?? allResults.length;
  const effectiveTotalResults = searchResults?.run?.apiTotalResults ?? totalResults;
  const effectiveCurrentPage = searchResults?.run?.pagesFetched ?? currentPage;
  const effectiveTotalPages =
    searchResults?.run?.totalPages ?? Math.max(1, Math.ceil((effectiveTotalResults || 0) / 100));

  return {
    apiStatus,
    searchLoading,
    searchResults,
    searchError,
    searchParams,
    setSearchParams,
    loadApiStatus,
    runSearch,
    importAllResults,
    // Pagination
    loadMoreResults,
    hasMorePages,
    currentPage: effectiveCurrentPage,
    totalPages: effectiveTotalPages,
    totalResults: effectiveTotalResults,
    loadedCount: effectiveLoadedCount,
    lastImportRun,
    resumeImport,
    resumeLoading,
  };
};
