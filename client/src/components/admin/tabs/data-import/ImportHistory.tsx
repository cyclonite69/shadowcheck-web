import React, { useEffect, useState } from 'react';
import { adminApi } from '../../../../api/adminApi';
import type { Metrics } from './types';

interface ImportRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  source_tag: string;
  filename: string | null;
  imported: number | null;
  failed: number | null;
  duration_s: string | null;
  status: 'running' | 'success' | 'failed';
  error_detail: string | null;
  metrics_before: Metrics | null;
  metrics_after: Metrics | null;
  backup_taken: boolean;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

function diff(after: number | undefined, before: number | undefined): React.ReactNode {
  if (after == null || before == null) return null;
  const d = after - before;
  if (d === 0) return <span className="text-slate-500 text-xs ml-1">(+0)</span>;
  return (
    <span className={`text-xs ml-1 ${d > 0 ? 'text-green-400' : 'text-red-400'}`}>
      ({d > 0 ? '+' : ''}
      {d.toLocaleString()})
    </span>
  );
}

export function MetricsTable({ before, after }: { before: Metrics | null; after: Metrics | null }) {
  const rows: { label: string; key: keyof Metrics }[] = [
    { label: 'Networks', key: 'networks' },
    { label: 'Access Points', key: 'access_points' },
    { label: 'Observations', key: 'observations' },
    { label: 'Explorer MV', key: 'in_explorer_mv' },
    { label: 'Kismet Devices', key: 'kismet_devices' },
    { label: 'Kismet Packets', key: 'kismet_packets' },
    { label: 'Kismet Alerts', key: 'kismet_alerts' },
  ];

  return (
    <table className="text-xs text-slate-300 w-full mt-2">
      <thead>
        <tr className="text-slate-500 border-b border-slate-700/50">
          <th className="text-left py-1 pr-4">Table</th>
          <th className="text-right py-1 pr-4">Before</th>
          <th className="text-right py-1">After</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, key }) => (
          <tr key={key} className="border-b border-slate-800/40">
            <td className="py-1 pr-4 text-slate-400">{label}</td>
            <td className="py-1 pr-4 text-right tabular-nums">{fmt(before?.[key] ?? null)}</td>
            <td className="py-1 text-right tabular-nums">
              {fmt(after?.[key] ?? null)}
              {diff(after?.[key], before?.[key])}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExpandedRow({ run }: { run: ImportRun }) {
  return (
    <tr>
      <td colSpan={8} className="bg-slate-900/80 border-b border-slate-700/50 px-4 py-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">Before / After</p>
            <MetricsTable before={run.metrics_before} after={run.metrics_after} />
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            <p>
              <span className="text-slate-500">File:</span> {run.filename ?? '—'}
            </p>
            <p>
              <span className="text-slate-500">Duration:</span>{' '}
              {run.duration_s ? `${run.duration_s}s` : '—'}
            </p>
            <p>
              <span className="text-slate-500">Backup:</span>{' '}
              {run.backup_taken ? '✓ taken before import' : '✗ skipped'}
            </p>
            {run.error_detail && (
              <div className="mt-2 p-2 bg-red-900/20 border border-red-700/40 rounded text-red-300 font-mono break-all">
                {run.error_detail}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export function ImportHistory({ refreshKey }: { refreshKey: number }) {
  const [history, setHistory] = useState<ImportRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLoading(true);
    adminApi
      .getImportHistory(10)
      .then((data: any) => setHistory(data?.history ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading) return <p className="text-sm text-slate-500 py-2">Loading history...</p>;
  if (history.length === 0)
    return <p className="text-sm text-slate-500 py-2">No imports recorded yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-slate-300">
        <thead>
          <tr className="text-slate-500 border-b border-slate-700/50">
            <th className="text-left py-1.5 pr-3">When</th>
            <th className="text-left py-1.5 pr-3">Source</th>
            <th className="text-right py-1.5 pr-3">Imported</th>
            <th className="text-right py-1.5 pr-3">Failed</th>
            <th className="text-right py-1.5 pr-3">Duration</th>
            <th className="text-center py-1.5 pr-3">Backup</th>
            <th className="text-left py-1.5 pr-3">Status</th>
            <th className="text-left py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {history.map((run) => (
            <React.Fragment key={run.id}>
              <tr
                className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                onClick={() => toggle(run.id)}
              >
                <td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap">
                  {new Date(run.started_at).toLocaleString()}
                </td>
                <td className="py-1.5 pr-3 font-mono">{run.source_tag}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(run.imported)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(run.failed)}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-slate-400">
                  {run.duration_s ? `${run.duration_s}s` : '—'}
                </td>
                <td className="py-1.5 pr-3 text-center">
                  {run.backup_taken ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="py-1.5 pr-3">
                  {run.status === 'success' && <span className="text-green-400">✓ success</span>}
                  {run.status === 'failed' && <span className="text-red-400">✗ failed</span>}
                  {run.status === 'running' && <span className="text-yellow-400">⏳ running</span>}
                </td>
                <td className="py-1.5 text-slate-500 text-xs">
                  {expanded.has(run.id) ? '▲' : '▼'}
                </td>
              </tr>
              {expanded.has(run.id) && <ExpandedRow run={run} />}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
