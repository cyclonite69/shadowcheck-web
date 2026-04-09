import { useState } from 'react';
import { wigleApi } from '../../../api/wigleApi';
import {
  WigleImportCompletenessState,
  WigleImportRun,
  WigleSearchParams,
  WigleApiStatus,
  WigleSearchResults,
  WigleNetworkResult,
} from '../types/admin.types';

const buildPayload = (searchParams: WigleSearchParams): Record<string, string> => {
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
  return payload;
};

const getOperatorSearchTerm = (searchParams: WigleSearchParams): string =>
  searchParams.ssid.trim() || searchParams.bssid.trim() || searchParams.city.trim() || '';

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
  const [allResults, setAllResults] = useState<WigleNetworkResult[]>([]);
  const [searchAfter, setSearchAfter] = useState<string | null>(null);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastImportRun, setLastImportRun] = useState<WigleImportRun | null>(null);
  const [importRuns, setImportRuns] = useState<WigleImportRun[]>([]);
  const [importRunsLoading, setImportRunsLoading] = useState(false);
  const [importRunsError, setImportRunsError] = useState('');
  const [completenessReport, setCompletenessReport] = useState<WigleImportCompletenessState[]>([]);
  const [completenessLoading, setCompletenessLoading] = useState(false);
  const [completenessError, setCompletenessError] = useState('');
  const [currentRunActionId, setCurrentRunActionId] = useState<number | null>(null);

  const loadApiStatus = async () => {
    try {
      const data = await wigleApi.getApiStatus();
      setApiStatus(data);
    } catch {
      setApiStatus({ configured: false, error: 'Failed to check status' });
    }
  };

  const loadImportOperations = async () => {
    const operatorSearchTerm = getOperatorSearchTerm(searchParams);
    const stateFilter = searchParams.region.trim().toUpperCase();

    setImportRunsLoading(true);
    setCompletenessLoading(true);
    setImportRunsError('');
    setCompletenessError('');

    try {
      const runsParams = new URLSearchParams();
      runsParams.set('limit', '12');
      runsParams.set('incompleteOnly', 'true');
      if (operatorSearchTerm) runsParams.set('searchTerm', operatorSearchTerm);
      if (stateFilter) runsParams.set('state', stateFilter);

      const reportParams = new URLSearchParams();
      if (operatorSearchTerm) reportParams.set('searchTerm', operatorSearchTerm);
      if (stateFilter) reportParams.set('state', stateFilter);

      const [runsResponse, reportResponse] = await Promise.all([
        wigleApi.listImportRuns(runsParams),
        wigleApi.getImportCompletenessReport(reportParams),
      ]);

      setImportRuns(Array.isArray(runsResponse?.runs) ? runsResponse.runs : []);
      setCompletenessReport(
        Array.isArray(reportResponse?.report?.states) ? reportResponse.report.states : []
      );
    } catch (err: any) {
      const message = err?.message || 'Failed to load import status';
      setImportRuns([]);
      setCompletenessReport([]);
      setImportRunsError(message);
      setCompletenessError(message);
    } finally {
      setImportRunsLoading(false);
      setCompletenessLoading(false);
    }
  };

  const runSearch = async (importResults = false, loadMore = false) => {
    setSearchError('');
    setSearchLoading(true);

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
      if (loadMore && searchAfter) params.append('searchAfter', searchAfter);
      if (importResults) params.append('import', 'true');

      const data = await wigleApi.searchWigle(params);
      const newResults = data.results || [];
      const combinedResults = loadMore ? [...allResults, ...newResults] : newResults;
      const nextSearchAfter = data.searchAfter ?? data.search_after ?? null;
      const importedCount = typeof data.importedCount === 'number' ? data.importedCount : 0;
      const importErrors = Array.isArray(data.importErrors) ? data.importErrors : [];
      const run = data.run || null;

      setAllResults(combinedResults);
      setSearchAfter(nextSearchAfter);
      setTotalResults(data.totalResults || combinedResults.length);
      if (loadMore) setCurrentPage((prev) => prev + 1);
      if (run) setLastImportRun(run);

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
        run,
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
      const data = await wigleApi.importAllWigle(buildPayload(searchParams));
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
      await loadImportOperations();
    } catch (err: any) {
      setSearchError(err?.message || 'Import all failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const updateRunFromAction = (run: WigleImportRun | null) => {
    if (!run) return;
    setLastImportRun(run);
    setSearchResults((prev) =>
      prev
        ? {
            ...prev,
            run,
          }
        : {
            ok: true,
            totalResults: run.apiTotalResults || 0,
            resultCount: 0,
            searchAfter: run.apiCursor || null,
            hasMore: ['running', 'paused', 'failed'].includes(run.status),
            loadedCount: run.rowsReturned,
            pagesProcessed: run.pagesFetched,
            totalPages: run.totalPages || null,
            results: [],
            importedCount: run.rowsInserted,
            importErrors: [],
            imported: {
              count: run.rowsInserted,
              errors: [],
            },
            run,
          }
    );
  };

  const runImportAction = async (
    runId: number,
    action: (id: number) => Promise<any>,
    fallbackError: string
  ) => {
    setSearchError('');
    setCurrentRunActionId(runId);
    try {
      const data = await action(runId);
      updateRunFromAction(data?.run || null);
      await loadImportOperations();
    } catch (err: any) {
      setSearchError(err?.message || fallbackError);
    } finally {
      setCurrentRunActionId(null);
    }
  };

  const resumeImportRun = async (runId: number) =>
    runImportAction(runId, wigleApi.resumeImportRun, 'Failed to resume import run');

  const pauseImportRun = async (runId: number) =>
    runImportAction(runId, wigleApi.pauseImportRun, 'Failed to pause import run');

  const cancelImportRun = async (runId: number) =>
    runImportAction(runId, wigleApi.cancelImportRun, 'Failed to cancel import run');

  const hasMorePages = searchAfter !== null;
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
    loadImportOperations,
    runSearch,
    importAllResults,
    loadMoreResults,
    hasMorePages,
    currentPage: effectiveCurrentPage,
    totalPages: effectiveTotalPages,
    totalResults: effectiveTotalResults,
    loadedCount: effectiveLoadedCount,
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
    operatorSearchTerm: getOperatorSearchTerm(searchParams),
  };
};
