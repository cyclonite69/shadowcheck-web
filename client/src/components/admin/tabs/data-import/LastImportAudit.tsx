import React from 'react';
import { MetricsTable } from './ImportHistory';
import type { DataImportResult } from './types';

interface LastImportAuditProps {
  lastResult: DataImportResult;
  sourceTag: string;
}

export const LastImportAudit = ({ lastResult, sourceTag }: LastImportAuditProps) => {
  if (!lastResult.metricsBefore || !lastResult.metricsAfter) return null;
  const metricValues = [
    ...Object.values(lastResult.metricsBefore),
    ...Object.values(lastResult.metricsAfter),
  ];
  const hasAnyMetric = metricValues.some((value) => value != null);

  return (
    <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-1">Last Import Audit</h3>
      <p className="text-xs text-slate-500 mb-3">
        Source:{' '}
        <span className="font-mono">
          {lastResult.sourceTag || lastResult.source_tag || sourceTag || 'sql_upload'}
        </span>
        {lastResult.importType ? (
          <>
            {' '}
            · Type: <span className="font-mono">{String(lastResult.importType)}</span>
          </>
        ) : null}
        {lastResult.durationSec ? (
          <>
            {' '}
            · Duration: <span className="font-mono">{lastResult.durationSec}s</span>
          </>
        ) : null}
        {typeof lastResult.backupTaken === 'boolean' ? (
          <>
            {' '}
            · Backup: <span className="font-mono">{lastResult.backupTaken ? 'yes' : 'no'}</span>
          </>
        ) : null}
      </p>
      {!hasAnyMetric ? (
        <p className="text-xs text-amber-300 mb-3">
          Import metrics were not captured for this run.
        </p>
      ) : null}
      <MetricsTable before={lastResult.metricsBefore} after={lastResult.metricsAfter} />
    </div>
  );
};
