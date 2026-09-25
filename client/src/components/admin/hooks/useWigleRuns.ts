import { useCallback, useEffect, useRef, useState } from 'react';
import { wigleApi } from '../../../api/wigleApi';
import type { WigleImportRun } from '../../../types/admin';

export interface WigleCompletenessState {
  state: string;
  localRows: number;
  localUniqueBssids: number;
  storedCount: number;
  knownRemoteAvailable: number | null;
  gap: number | null;
  lastLedgerProbeAt: string | null;
  lastLedgerHttpStatus: number | null;
  lastLedgerResultCount: number | null;
  lastLedgerRetryAfterHint: number | null;
  lastLedgerError: string | null;
  ledgerStatus: 'known' | 'unknown' | 'rate_limited' | 'error';
  runId: number | null;
  searchTerm: string | null;
  status: string | null;
  apiTotalResults: number | null;
  pagesFetched: number | null;
  totalPages: number | null;
  rowsReturned: number | null;
  rowsInserted: number | null;
  nextPage: number | null;
  lastError: string | null;
  updatedAt: string | null;
  resumable: boolean;
}

export interface WigleCompletenessReport {
  generatedAt: string;
  states: WigleCompletenessState[];
}

export type SortEntry = { key: string; dir: 'asc' | 'desc' };

const PAGE_SIZE = 100;

export const useWigleRuns = (options: { limit?: number } = {}) => {
  const limit = options.limit || PAGE_SIZE;

  const [runs, setRuns] = useState<WigleImportRun[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [report, setReport] = useState<WigleCompletenessReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [sortCols, setSortCols] = useState<SortEntry[]>([]);

  const runsRef = useRef<WigleImportRun[]>([]);
  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);

  const fetchRuns = useCallback(
    async ({ reset }: { reset: boolean } = { reset: true }) => {
      const offset = reset ? 0 : runsRef.current.length;
      if (reset) {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
        if (sortCols.length > 0) {
          params.set('sortBy', sortCols.map((s) => s.key).join(','));
          params.set('sortDir', sortCols.map((s) => s.dir).join(','));
        }
        const [runsData, reportData] = await Promise.all([
          wigleApi.listImportRuns(params),
          reset ? wigleApi.getImportCompletenessReport() : Promise.resolve(null),
        ]);

        const newRuns: WigleImportRun[] = runsData?.runs || [];
        const newTotal: number = runsData?.total ?? 0;

        setRuns((prev) => (reset ? newRuns : [...prev, ...newRuns]));
        setTotal(newTotal);
        setHasMore(runsData?.hasMore ?? false);
        if (reportData) {
          setReport(reportData?.report || null);
        }
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch WiGLE runs');
      } finally {
        if (reset) {
          setLoading(false);
        }
      }
    },
    [limit, sortCols]
  );

  // Reset on sort change
  useEffect(() => {
    setRuns([]);
    setHasMore(false);
    fetchRuns({ reset: true });
  }, [sortCols, fetchRuns]);

  // Auto-poll every 5s while any run is actively running
  useEffect(() => {
    const hasRunning = runs.some((r) => r.status === 'running');
    if (!hasRunning) {
      return;
    }
    const interval = setInterval(() => fetchRuns({ reset: true }), 5000);
    return () => clearInterval(interval);
  }, [runs, fetchRuns]);

  const resumeRun = async (runId: number) => {
    setActionLoading(true);
    try {
      await wigleApi.resumeImportRun(runId);
      await fetchRuns({ reset: true });
    } catch (err: any) {
      setError(err.message || 'Failed to resume run');
    } finally {
      setActionLoading(false);
    }
  };

  const pauseRun = async (runId: number) => {
    setActionLoading(true);
    try {
      await wigleApi.pauseImportRun(runId);
      await fetchRuns({ reset: true });
    } catch (err: any) {
      setError(err.message || 'Failed to pause run');
    } finally {
      setActionLoading(false);
    }
  };

  const cancelRun = async (runId: number) => {
    setActionLoading(true);
    try {
      await wigleApi.cancelImportRun(runId);
      await fetchRuns({ reset: true });
    } catch (err: any) {
      setError(err.message || 'Failed to cancel run');
    } finally {
      setActionLoading(false);
    }
  };

  const deleteRun = async (runId: number) => {
    setActionLoading(true);
    try {
      await wigleApi.deleteImportRun(runId);
      await fetchRuns({ reset: true });
    } catch (err: any) {
      setError(err.message || 'Failed to delete run');
    } finally {
      setActionLoading(false);
    }
  };

  return {
    runs,
    total,
    hasMore,
    report,
    loading,
    error,
    actionLoading,
    sortCols,
    setSortCols,
    refresh: () => fetchRuns({ reset: true }),
    loadMore: () => fetchRuns({ reset: false }),
    resumeRun,
    pauseRun,
    cancelRun,
    deleteRun,
  };
};
