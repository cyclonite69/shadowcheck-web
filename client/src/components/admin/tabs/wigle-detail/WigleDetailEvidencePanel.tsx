import React from 'react';
import { formatShortDate } from '../../../../utils/formatDate';
import { formatDeviceType } from '../../../../utils/deviceClassUtils';
import type { WigleDetectionEvidence } from '../../hooks/useWigleDetectionEvidence';

export interface WigleDetailEvidencePanelProps {
  detectionEvidence: WigleDetectionEvidence[];
  detectionLoading: boolean;
  detectionError: string | null;
}

export const WigleDetailEvidencePanel: React.FC<WigleDetailEvidencePanelProps> = ({
  detectionEvidence,
  detectionLoading,
  detectionError,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-xs font-bold text-amber-400 uppercase">
          Surveillance Detection Evidence ({detectionEvidence.length})
        </h4>
        {detectionLoading && (
          <div className="text-[10px] text-slate-500 animate-pulse">Refreshing...</div>
        )}
      </div>
      {detectionLoading && detectionEvidence.length === 0 ? (
        <div className="text-xs text-slate-400 py-2">Loading detection evidence...</div>
      ) : detectionError ? (
        <div className="text-xs text-red-400 py-2">{detectionError}</div>
      ) : detectionEvidence.length === 0 ? (
        <div className="text-xs text-slate-400 py-2">
          No surveillance detections recorded for this BSSID.
        </div>
      ) : (
        <div className="bg-slate-900/50 rounded border border-slate-700/50 overflow-hidden">
          <div className="divide-y divide-slate-800">
            {detectionEvidence.map((det, idx) => (
              <div key={idx} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-[10px] font-bold uppercase tracking-wider">
                        {formatDeviceType(det.device_type)}
                      </span>
                      {det.false_positive && (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-300 border border-red-500/30 rounded text-[10px] font-bold uppercase tracking-wider">
                          False Positive
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Detected: {formatShortDate(det.detected_at || det.lastupdt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-white font-mono leading-none">
                      {det.threat_score}
                    </div>
                    <div className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">
                      Threat Score
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
                      Confidence
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full"
                          style={{ width: `${det.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-cyan-400">
                        {(det.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
                      Detection Method
                    </div>
                    <div className="text-xs text-slate-300">
                      {det.detection_method?.replace(/_/g, ' ') || 'N/A'}
                    </div>
                  </div>
                </div>

                {det.notes && (
                  <div className="bg-slate-950/40 p-2.5 rounded border border-slate-800/50 text-xs text-slate-400 italic">
                    {det.notes}
                  </div>
                )}

                {det.matched_signals && det.matched_signals.length > 0 && (
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1.5">
                      Matched Signals / Rules
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {det.matched_signals.map((sig: string, sIdx: number) => (
                        <span
                          key={sIdx}
                          className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px] font-mono border border-slate-700/50"
                        >
                          {sig}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {det.false_positive && det.fp_reason && (
                  <div className="bg-red-900/10 p-2.5 rounded border border-red-900/30 text-xs text-red-300/80">
                    <span className="font-bold uppercase text-[10px] mr-2">FP Reason:</span>
                    {det.fp_reason}
                  </div>
                )}

                {det.tags && typeof det.tags === 'object' && Object.keys(det.tags).length > 0 && (
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold mb-1.5">
                      Tags
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(Array.isArray(det.tags) ? det.tags : Object.keys(det.tags)).map(
                        (tag: string, tIdx: number) => (
                          <span
                            key={tIdx}
                            className="px-2 py-0.5 bg-slate-700/40 text-slate-300 rounded text-[10px] font-mono border border-slate-600/50"
                          >
                            {tag}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
