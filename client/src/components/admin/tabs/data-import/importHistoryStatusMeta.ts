export type ImportHistoryStatus = 'pending' | 'running' | 'success' | 'failed' | 'quarantined';

export function getImportHistoryStatusMeta(status: ImportHistoryStatus): {
  className: string;
  label: string;
} {
  if (status === 'pending') {
    return { className: 'text-sky-400', label: '● pending' };
  }
  if (status === 'success') {
    return { className: 'text-green-400', label: '✓ success' };
  }
  if (status === 'failed') {
    return { className: 'text-red-400', label: '✗ failed' };
  }
  if (status === 'quarantined') {
    return { className: 'text-amber-400', label: '⚠ Quarantined' };
  }
  if (status === 'running') {
    return { className: 'text-yellow-400', label: '⏳ running' };
  }
  return { className: 'text-slate-400', label: status };
}
