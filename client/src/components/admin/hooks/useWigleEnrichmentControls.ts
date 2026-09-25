import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { wigleApi } from '../../../api/wigleApi';
import type { WigleImportRun } from '../../../types/admin';
import type { WigleDetailType } from './useWigleDetail';
import { useWigleRuns } from './useWigleRuns';

type FetchDetail = (
  netid: string,
  shouldImport: boolean,
  detailType?: WigleDetailType
) => Promise<void>;

interface EnrichmentStartResponse {
  ok?: boolean;
  run?: {
    id?: number;
    status?: string;
    lastError?: string | null;
  };
}

interface EnrichmentError extends Error {
  status?: number;
}

export interface UseWigleEnrichmentControlsOptions {
  detailType: WigleDetailType;
  fetchDetail: FetchDetail;
  setNetid: React.Dispatch<React.SetStateAction<string>>;
}

export interface UseWigleEnrichmentControlsResult {
  pendingEnrichment: number | null;
  isManualMode: boolean;
  setIsManualMode: React.Dispatch<React.SetStateAction<boolean>>;
  manualBssids: string;
  setManualBssids: React.Dispatch<React.SetStateAction<string>>;
  activeEnrichmentRun: WigleImportRun | null;
  runsLoading: boolean;
  actionLoading: boolean;
  stopEnrichment: () => Promise<void>;
  loadEnrichmentStats: () => Promise<void>;
  handleEnrichmentConflict: <T>(
    err: unknown,
    retry: (bssids?: string[]) => Promise<T>,
    bssids?: string[]
  ) => Promise<T | undefined>;
  handleStartEnrichment: () => Promise<void>;
  handleManualEnrich: (bssids: string[]) => Promise<EnrichmentStartResponse | void>;
  handleManualSelect: (bssid: string) => void;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function getEnrichmentError(err: unknown): EnrichmentError | null {
  return err instanceof Error ? (err as EnrichmentError) : null;
}

export const useWigleEnrichmentControls = ({
  detailType,
  fetchDetail,
  setNetid,
}: UseWigleEnrichmentControlsOptions): UseWigleEnrichmentControlsResult => {
  const [pendingEnrichment, setPendingEnrichment] = useState<number | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualBssids, setManualBssids] = useState('');

  const {
    runs,
    loading: runsLoading,
    actionLoading,
    refresh: refreshRuns,
  } = useWigleRuns({ limit: 10 });

  const activeEnrichmentRun = useMemo(
    () =>
      runs.find(
        (r) => r.status === 'running' && (r.source === 'v3_batch' || r.source === 'v3_manual')
      ) ?? null,
    [runs]
  );

  const stopEnrichment = useCallback(async () => {
    if (!activeEnrichmentRun) {
      return;
    }
    try {
      await wigleApi.cancelImportRun(activeEnrichmentRun.id);
      await refreshRuns();
    } catch (err) {
      alert(`Failed to stop enrichment: ${getErrorMessage(err)}`);
    }
  }, [activeEnrichmentRun, refreshRuns]);

  const loadEnrichmentStats = useCallback(async () => {
    try {
      const data = await wigleApi.getEnrichmentStats();
      if (data?.ok) {
        setPendingEnrichment(data.pendingCount);
      }
    } catch (err) {
      console.error('Failed to load enrichment stats', err);
    }
  }, []);

  useEffect(() => {
    void loadEnrichmentStats();
  }, [loadEnrichmentStats]);

  const handleEnrichmentConflict = useCallback(
    async <T>(
      err: unknown,
      retry: (bssids?: string[]) => Promise<T>,
      bssids?: string[]
    ): Promise<T | undefined> => {
      const enrichmentError = getEnrichmentError(err);
      const message = getErrorMessage(err);

      if (enrichmentError?.status !== 409) {
        alert(`Failed to start enrichment: ${message}`);
        return undefined;
      }

      const match = message.match(/#(\d+)/);
      const stuckRunId = match ? Number(match[1]) : null;
      const label = stuckRunId ? `Run #${stuckRunId} is stuck` : 'An enrichment run is stuck';
      if (!window.confirm(`${label} (status: running). Force-clear it and start a new run?`)) {
        return undefined;
      }

      try {
        if (stuckRunId) {
          await wigleApi.forceClearEnrichmentRun(stuckRunId);
        }
        return await retry(bssids);
      } catch (retryErr) {
        alert(`Failed after force-clear: ${getErrorMessage(retryErr)}`);
        throw retryErr;
      }
    },
    []
  );

  const startEnrichment = useCallback(
    async (bssids?: string[]): Promise<EnrichmentStartResponse | void> => {
      const data = await wigleApi.startEnrichment(bssids);
      if (data?.ok) {
        await refreshRuns();
        void loadEnrichmentStats();
        if (isManualMode) {
          setManualBssids('');
        }
      }
      return data;
    },
    [isManualMode, loadEnrichmentStats, refreshRuns]
  );

  const handleStartEnrichment = useCallback(async () => {
    const bssids = isManualMode
      ? manualBssids
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 5)
      : undefined;

    try {
      await startEnrichment(bssids);
    } catch (err) {
      await handleEnrichmentConflict(err, startEnrichment, bssids);
    }
  }, [handleEnrichmentConflict, isManualMode, manualBssids, startEnrichment]);

  const handleManualEnrich = useCallback(
    async (bssids: string[]): Promise<EnrichmentStartResponse | void> => {
      try {
        return await startEnrichment(bssids);
      } catch (err) {
        return (await handleEnrichmentConflict(err, startEnrichment, bssids)) ?? undefined;
      }
    },
    [handleEnrichmentConflict, startEnrichment]
  );

  const handleManualSelect = useCallback(
    (bssid: string) => {
      setNetid(bssid);
      void fetchDetail(bssid, false, detailType);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [detailType, fetchDetail, setNetid]
  );

  return {
    pendingEnrichment,
    isManualMode,
    setIsManualMode,
    manualBssids,
    setManualBssids,
    activeEnrichmentRun,
    runsLoading,
    actionLoading,
    stopEnrichment,
    loadEnrichmentStats,
    handleEnrichmentConflict,
    handleStartEnrichment,
    handleManualEnrich,
    handleManualSelect,
  };
};
