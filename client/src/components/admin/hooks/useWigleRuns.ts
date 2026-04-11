import { useCallback, useEffect, useState } from 'react';
import { wigleApi } from '../../../api/wigleApi';
import type { WigleImportRun } from '../types/admin.types';

export interface WigleCompletenessState {
  state: string;
  storedCount: number;
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

export const useWigleRuns = () => {
  const [runs, setRuns] = useState<WigleImportRun[]>([]);
  const [report, setReport] = useState<WigleCompletenessReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const [runsData, reportData] = await Promise.all([
        wigleApi.listImportRuns(new URLSearchParams({ limit: '10' })),
        wigleApi.getImportCompletenessReport(),
      ]);
      setRuns(runsData.runs || []);
      setReport(reportData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch WiGLE runs');
    } finally {
      setLoading(false);
    }
  }, []);

  const resumeRun = async (runId: number) => {
    setActionLoading(true);
    try {
      await wigleApi.resumeImportRun(runId);
      await fetchRuns();
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
      await fetchRuns();
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
      await fetchRuns();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel run');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  return {
    runs,
    report,
    loading,
    error,
    actionLoading,
    refresh: fetchRuns,
    resumeRun,
    pauseRun,
    cancelRun,
  };
};
