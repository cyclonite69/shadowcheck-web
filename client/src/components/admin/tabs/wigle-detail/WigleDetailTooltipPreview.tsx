import React, { RefObject } from 'react';
import { formatShortDate } from '../../../../utils/formatDate';
import type { WigleObservation } from '../../hooks/useWigleDetectionEvidence';

export interface WigleDetailTooltipPreviewProps {
  selectedObs: WigleObservation | null;
  tooltipContainerRef: RefObject<HTMLDivElement | null>;
  tooltipHtml: string | null;
  hasData: boolean;
}

export const WigleDetailTooltipPreview: React.FC<WigleDetailTooltipPreviewProps> = ({
  selectedObs,
  tooltipContainerRef,
  tooltipHtml,
  hasData,
}) => {
  return (
    <div className="bg-slate-900/40 p-4 rounded border border-slate-700/50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase">Forensic Tooltip Preview</h4>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
            selectedObs
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
              : 'bg-slate-800 text-slate-500'
          }`}
        >
          {selectedObs
            ? `Viewing observation: ${formatShortDate(selectedObs.observed_at)}`
            : 'Network overview'}
        </span>
      </div>
      <div
        ref={tooltipContainerRef}
        className="flex justify-center bg-slate-950/50 p-4 rounded-lg border border-slate-800 shadow-inner overflow-hidden"
      >
        {tooltipHtml ? (
          <div
            className="scale-[0.85] origin-top"
            dangerouslySetInnerHTML={{ __html: tooltipHtml }}
          />
        ) : (
          <div className="text-xs text-slate-500 italic py-4">
            {hasData ? 'Loading preview...' : 'No data'}
          </div>
        )}
      </div>
    </div>
  );
};
