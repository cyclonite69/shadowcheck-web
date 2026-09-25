import { useState } from 'react';
import { wigleApi } from '../../../api/wigleApi';
import { networkApi } from '../../../api/networkApi';

interface BatchWigleLookupDialogProps {
  visible: boolean;
  bssids: string[];
  onComplete: () => void;
  onClose: () => void;
}

type BatchState =
  | { phase: 'confirm' }
  | { phase: 'running'; completed: number; total: number }
  | { phase: 'done'; succeeded: number; failed: number; totalImported: number };

export const BatchWigleLookupDialog = ({
  visible,
  bssids,
  onComplete,
  onClose,
}: BatchWigleLookupDialogProps) => {
  const [state, setState] = useState<BatchState>({ phase: 'confirm' });
  const [error, setError] = useState<string | null>(null);

  if (!visible || bssids.length === 0) {
    return null;
  }

  const isRunning = state.phase === 'running';

  const handleImport = async () => {
    setState({ phase: 'running', completed: 0, total: bssids.length });
    setError(null);

    try {
      let taggedCount = 0;
      for (const bssid of bssids) {
        try {
          await networkApi.investigateNetwork(bssid);
          taggedCount++;
          setState((prev) =>
            prev.phase === 'running' ? { ...prev, completed: taggedCount } : prev
          );
        } catch {
          // Tag failures are non-fatal — continue with import
        }
      }

      const result = await wigleApi.batchImportWigleDetail(bssids);

      setState({
        phase: 'done',
        succeeded: result.summary.succeeded,
        failed: result.summary.failed,
        totalImported: result.summary.totalImported,
      });
      onComplete();
    } catch (err: any) {
      setError(err?.message || 'Batch import failed');
      setState({ phase: 'confirm' });
    }
  };

  const handleClose = () => {
    setState({ phase: 'confirm' });
    setError(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !isRunning && handleClose()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 bg-slate-800/50">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <span className="text-blue-400">&#128269;</span>
            Batch WiGLE Import
          </h3>
          <p className="text-xs text-slate-400 mt-1">{bssids.length} networks selected</p>
        </div>

        <div className="px-5 py-4">
          {state.phase === 'confirm' && (
            <>
              <p className="text-slate-300 text-sm mb-4">
                Import WiGLE v3 observations for all {bssids.length} selected networks? Each will be
                tagged as Investigate and queried sequentially.
              </p>
              {error && (
                <p className="text-red-400 text-sm mb-4 bg-red-400/10 rounded px-3 py-2">{error}</p>
              )}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleImport}
                  className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <span>&#127760;</span>
                  Import All from WiGLE
                </button>
                <button
                  onClick={handleClose}
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {state.phase === 'running' && (
            <div className="text-center py-4">
              <div className="w-8 h-8 border-3 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-300 text-sm">
                Processing {state.completed} / {state.total}...
              </p>
              <div className="mt-3 bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{ width: `${(state.completed / state.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {state.phase === 'done' && (
            <div className="text-center py-4">
              <div className="text-3xl mb-2 text-emerald-400">&#10003;</div>
              <p className="text-sm text-slate-300">
                {state.succeeded} of {state.succeeded + state.failed} networks imported
                successfully.
              </p>
              {state.totalImported > 0 && (
                <p className="text-xs text-slate-400 mt-2">
                  {state.totalImported} total observations imported
                </p>
              )}
              {state.failed > 0 && (
                <p className="text-xs text-amber-400 mt-1">
                  {state.failed} failed (rate limit or no data)
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-700 bg-slate-800/30 flex justify-end">
          <button
            onClick={handleClose}
            disabled={isRunning}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors text-sm disabled:opacity-50"
          >
            {state.phase === 'done' ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};
