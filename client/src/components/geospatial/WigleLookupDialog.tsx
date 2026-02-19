import type { NetworkRow } from '../../types/network';

interface WigleLookupDialogProps {
  visible: boolean;
  network: NetworkRow | null;
  loading: boolean;
  result: { success: boolean; message: string; observationsImported?: number } | null;
  onLookup: (withLookup: boolean) => void;
  onClose: () => void;
}

export const WigleLookupDialog = ({
  visible,
  network,
  loading,
  result,
  onLookup,
  onClose,
}: WigleLookupDialogProps) => {
  if (!visible || !network) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700 bg-slate-800/50">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <span className="text-blue-400">&#128269;</span>
            Investigate Network
          </h3>
          <p className="text-xs text-slate-400 mt-1 font-mono">{network.bssid}</p>
          {network.ssid && <p className="text-sm text-slate-300 mt-1">{network.ssid}</p>}
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          {!result ? (
            <>
              <p className="text-slate-300 text-sm mb-4">
                Would you like to lookup and import observations for this BSSID from WiGLE?
              </p>
              <p className="text-slate-400 text-xs mb-4">
                This will query the WiGLE v3 API for any additional sightings of this device and
                import them into your database.
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => onLookup(true)}
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Looking up...
                    </>
                  ) : (
                    <>
                      <span>&#127760;</span>
                      Yes, Lookup from WiGLE
                    </>
                  )}
                </button>

                <button
                  onClick={() => onLookup(false)}
                  disabled={loading}
                  className="w-full px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 text-slate-200 font-medium transition-colors"
                >
                  No, Just Tag as Investigate
                </button>
              </div>
            </>
          ) : (
            <div
              className={`text-center py-4 ${result.success ? 'text-emerald-400' : 'text-red-400'}`}
            >
              <div className="text-3xl mb-2">{result.success ? '\u2713' : '\u2717'}</div>
              <p className="text-sm">{result.message}</p>
              {result.observationsImported !== undefined && result.observationsImported > 0 && (
                <p className="text-xs text-slate-400 mt-2">
                  Refresh the page to see new observations
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-700 bg-slate-800/30 flex justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors text-sm"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};
