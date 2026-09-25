import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../../../api/client';

export interface SiblingStats {
  total_pairs: number;
  strong_pairs: number;
  candidate_pairs: number;
  avg_confidence: string;
  oldest_computed_at: string | null;
  newest_computed_at: string | null;
}

export interface SiblingByRule {
  rule: string;
  pair_count: number;
  avg_confidence: string;
  last_run_at: string | null;
}

export interface UseSiblingStatsReturn {
  siblingStats: SiblingStats | null;
  siblingByRule: SiblingByRule[];
  purgingSiblings: boolean;
  runningSiblings: boolean;
  loadingSiblings: boolean;
  /** Non-null when runRefresh() aborts due to a poll timeout or unexpected error. */
  refreshError: string | null;
  fetchSiblingStats: () => Promise<void>;
  purgeSiblings: () => Promise<void>;
  runRefresh: (incremental?: boolean) => Promise<void>;
}

/** Maximum number of 3-second poll ticks before declaring a timeout (~60 s). */
const POLL_MAX_ATTEMPTS = 20;

export const useSiblingStats = (onPurgeComplete?: () => Promise<void>): UseSiblingStatsReturn => {
  const [siblingStats, setSiblingStats] = useState<SiblingStats | null>(null);
  const [siblingByRule, setSiblingByRule] = useState<SiblingByRule[]>([]);
  const [purgingSiblings, setPurgingSiblings] = useState<boolean>(false);
  const [runningSiblings, setRunningSiblings] = useState<boolean>(false);
  const [loadingSiblings, setLoadingSiblings] = useState<boolean>(true);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const fetchSiblingStats = useCallback(async () => {
    try {
      setLoadingSiblings(true);
      const response = await apiClient.get<{
        ok: boolean;
        stats: SiblingStats;
        byRule: SiblingByRule[];
      }>('/admin/siblings/stats');
      if (response.ok) {
        setSiblingStats(response.stats);
        setSiblingByRule(response.byRule);
      }
    } catch (_err) {
      // Intentionally ignored, mirroring original behavior
    } finally {
      setLoadingSiblings(false);
    }
  }, []);

  useEffect(() => {
    fetchSiblingStats();
  }, [fetchSiblingStats]);

  const purgeSiblings = async () => {
    if (!window.confirm('Purge all sibling pairs and start a full redetect now?')) {
      return;
    }
    setPurgingSiblings(true);
    try {
      await apiClient.delete('/admin/siblings/pairs');
      setSiblingStats(null);
      setSiblingByRule([]);
      // Trigger full redetect immediately after purge
      await apiClient.post('/admin/siblings/refresh', {});
      await fetchSiblingStats();
      if (onPurgeComplete) {
        await onPurgeComplete();
      }
    } catch (err: any) {
      window.alert(`Purge/redetect failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setPurgingSiblings(false);
    }
  };

  const runRefresh = async (incremental = false) => {
    setRunningSiblings(true);
    setRefreshError(null);
    try {
      await apiClient.post('/admin/siblings/refresh', { incremental });

      // Job is fire-and-forget (202). Poll status until running===false,
      // then refetch stats so the panel shows the actual result.
      // Bails out after POLL_MAX_ATTEMPTS ticks (~60 s) to avoid hanging
      // indefinitely if the backend job crashes without clearing the running flag.
      const poll = async (attempt: number): Promise<void> => {
        if (attempt >= POLL_MAX_ATTEMPTS) {
          setRefreshError(
            'Sibling refresh timed out — the job may still be running in the background. ' +
              'Check the monitoring panel or reload to see the latest status.'
          );
          setRunningSiblings(false);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
        try {
          const status = await apiClient.get<{ status: { running: boolean } }>(
            '/admin/siblings/refresh/status'
          );
          if (status?.status?.running) {
            return poll(attempt + 1);
          }
        } catch {
          // Status fetch failed — stop polling, don't crash
        }
        await fetchSiblingStats();
        setRunningSiblings(false);
      };

      poll(0);
      // Don't await poll() — it runs in the background while the button
      // re-enables. runningSiblings stays true until poll resolves.
    } catch (err: any) {
      window.alert(`Failed to start sibling refresh: ${err?.message || 'Unknown error'}`);
      setRunningSiblings(false);
    }
  };

  return {
    siblingStats,
    siblingByRule,
    purgingSiblings,
    runningSiblings,
    loadingSiblings,
    refreshError,
    fetchSiblingStats,
    purgeSiblings,
    runRefresh,
  };
};
