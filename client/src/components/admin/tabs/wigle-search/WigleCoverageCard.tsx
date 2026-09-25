import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { formatShortDate } from '../../../../utils/formatDate';
import { getCoverageStatusMeta } from '../wigleCoverageStatusMeta';
import {
  getCoverageCountDisplay,
  getCoverageRemoteDisplay,
  mergeCoverageStates,
} from '../../hooks/wigleCoverageHelpers';
import { US_STATES } from '../../../../constants/network';
import { BadgeIcon } from './WigleSearchIcons';
import type { WigleCompletenessReport } from '../../hooks/useWigleRuns';

export interface WigleCoverageCardProps {
  coverageTerms: string[];
  coverageTerm: string;
  setCoverageTerm: (term: string) => void;
  termReport: WigleCompletenessReport | null;
  termReportLoading: boolean;
}

export const WigleCoverageCard: React.FC<WigleCoverageCardProps> = ({
  coverageTerms,
  coverageTerm,
  setCoverageTerm,
  termReport,
  termReportLoading,
}) => {
  if (coverageTerms.length === 0) {
    return null;
  }

  return (
    <AdminCard icon={BadgeIcon} title="WiGLE Coverage by State" color="from-amber-500 to-amber-600">
      <div className="space-y-3">
        {/* Search term selector */}
        <div className="flex items-center gap-2">
          <select
            value={coverageTerm}
            onChange={(e) => setCoverageTerm(e.target.value)}
            className="flex-1 px-2 py-1.5 bg-slate-800/60 border border-slate-700/60 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          >
            {coverageTerms.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {termReport && (
            <span className="text-[10px] text-slate-500 whitespace-nowrap">
              Updated: {new Date(termReport.generatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* State grid */}
        {!coverageTerm ? (
          <p className="text-xs text-slate-500 py-2">Select a search term to view coverage.</p>
        ) : termReportLoading ? (
          <p className="text-xs text-slate-500 py-2">Loading coverage…</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {(() => {
              const mergedStates = mergeCoverageStates(termReport?.states, US_STATES);

              return mergedStates.map((s) => {
                const isUnverified = s.probeStatus === 'unverified';
                const isActive = s.isQueried || s.hasLocalData;
                const countDisplay = getCoverageCountDisplay(s);
                const remoteDisplay = getCoverageRemoteDisplay(s);
                const statusMeta = isUnverified
                  ? getCoverageStatusMeta(s.status, s.rowsInserted, s.probeStatus)
                  : s.isQueried
                    ? getCoverageStatusMeta(s.status, s.rowsInserted)
                    : s.hasLocalData
                      ? {
                          className: 'text-emerald-300 bg-emerald-500/10',
                          label: 'Local',
                          title: 'Local records found without matching import-run metadata',
                        }
                      : {
                          className: 'text-slate-500 bg-slate-500/5',
                          label: 'Not Queried',
                          title: 'Not Queried',
                        };

                return (
                  <div
                    key={s.state}
                    className={`p-2 rounded flex flex-col justify-between ${
                      isUnverified
                        ? 'bg-amber-500/5 border border-amber-500/20'
                        : isActive
                          ? 'bg-slate-900/40 border border-slate-800/60'
                          : 'bg-slate-900/10 border border-slate-800/30 opacity-60'
                    }`}
                    title={
                      isUnverified
                        ? statusMeta.title
                        : s.lastLedgerError
                          ? `Ledger: ${s.lastLedgerError}`
                          : s.lastError
                            ? `Note: ${s.lastError}`
                            : statusMeta.title || undefined
                    }
                  >
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span
                        className={`text-xs font-black ${
                          isUnverified
                            ? 'text-amber-200'
                            : isActive
                              ? 'text-white'
                              : 'text-slate-400'
                        }`}
                      >
                        {s.state}
                      </span>
                      <span
                        className={`text-[9px] px-1 rounded whitespace-nowrap ${statusMeta.className}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        isUnverified
                          ? 'text-amber-200/70'
                          : isActive
                            ? 'text-slate-100'
                            : 'text-slate-500'
                      }`}
                    >
                      {countDisplay.value === null ? '—' : countDisplay.value.toLocaleString()}
                    </div>
                    <div className="text-[9px] text-slate-500 uppercase font-semibold">
                      {countDisplay.label}
                    </div>
                    {!isUnverified && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-800/50 text-[9px] leading-tight text-slate-400 space-y-0.5">
                        <div>{remoteDisplay.availabilityLabel}</div>
                        {remoteDisplay.gapLabel && <div>{remoteDisplay.gapLabel}</div>}
                        {remoteDisplay.statusLabel && (
                          <div
                            className={
                              s.ledgerStatus === 'rate_limited' ? 'text-amber-300' : 'text-red-300'
                            }
                          >
                            {remoteDisplay.statusLabel}
                          </div>
                        )}
                        {s.lastLedgerProbeAt && (
                          <div className="text-slate-600">
                            Checked {formatShortDate(s.lastLedgerProbeAt)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </AdminCard>
  );
};
