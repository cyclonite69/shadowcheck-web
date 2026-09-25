import React from 'react';
import { WigleRunsCard } from '../../components/WigleRunsCard';
import { wigleApi } from '../../../../api/wigleApi';
import type { WigleImportRun } from '../../../../types/admin';
import type { SortEntry } from '../../hooks/useWigleRuns';

export interface WigleImportRunsSectionProps {
  runs: WigleImportRun[];
  runsLoading: boolean;
  actionLoading: boolean;
  runsError: string | null;
  runsSortCols: SortEntry[];
  setRunsSortCols: React.Dispatch<React.SetStateAction<SortEntry[]>>;
  refreshRuns: () => Promise<void>;
  resumeRun: (runId: number) => Promise<void>;
  pauseRun: (runId: number) => Promise<void>;
  cancelRun: (runId: number) => Promise<void>;
  deleteRun: (runId: number) => Promise<void>;
}

export const WigleImportRunsSection: React.FC<WigleImportRunsSectionProps> = ({
  runs,
  runsLoading,
  actionLoading,
  runsError,
  runsSortCols,
  setRunsSortCols,
  refreshRuns,
  resumeRun,
  pauseRun,
  cancelRun,
  deleteRun,
}) => {
  return (
    <WigleRunsCard
      runs={runs}
      loading={runsLoading}
      actionLoading={actionLoading}
      error={runsError}
      sortCols={runsSortCols}
      onSort={(col, e) => {
        if (!col.sortKey) {
          return;
        }
        setRunsSortCols((prev) => {
          const existing = prev.find((s) => s.key === col.sortKey);
          if (e.shiftKey) {
            if (existing) {
              return prev.map((s) =>
                s.key === col.sortKey ? { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' } : s
              );
            }
            return [...prev, { key: col.sortKey!, dir: 'asc' }];
          }
          if (existing && prev.length === 1) {
            return [{ key: col.sortKey!, dir: existing.dir === 'asc' ? 'desc' : 'asc' }];
          }
          return [{ key: col.sortKey!, dir: 'asc' }];
        });
      }}
      onRefresh={refreshRuns}
      onResume={resumeRun}
      onPause={pauseRun}
      onCancel={cancelRun}
      onDelete={deleteRun}
      onCleanupCluster={async () => {
        await wigleApi.cleanupCancelledCluster();
        await refreshRuns();
      }}
    />
  );
};
