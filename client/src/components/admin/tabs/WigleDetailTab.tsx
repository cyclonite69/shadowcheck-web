import React from 'react';
import { AdminCard } from '../components/AdminCard';
import { useWigleDetailLookup } from '../hooks/useWigleDetailLookup';
import { useWigleDetectionEvidence } from '../hooks/useWigleDetectionEvidence';
import { useWigleTooltipPreview } from '../hooks/useWigleTooltipPreview';
import { useWigleEnrichmentControls } from '../hooks/useWigleEnrichmentControls';
import {
  computeTemporalSummary,
  computeSsidDisplaySummary,
  bestObservedSsid,
} from '../../../utils/wigleDetailUtils';
import { DetailIcon } from './wigle-detail/WigleDetailIcons';
import { WigleDetailSearchCard } from './wigle-detail/WigleDetailSearchCard';
import { WigleDetailOverviewCard } from './wigle-detail/WigleDetailOverviewCard';
import { WigleDetailTooltipPreview } from './wigle-detail/WigleDetailTooltipPreview';
import { WigleDetailLocationCard } from './wigle-detail/WigleDetailLocationCard';
import { WigleDetailObservationsTable } from './wigle-detail/WigleDetailObservationsTable';
import { WigleDetailEvidencePanel } from './wigle-detail/WigleDetailEvidencePanel';
import { WigleDetailBatchSection } from './wigle-detail/WigleDetailBatchSection';

export const WigleDetailTab: React.FC = () => {
  const {
    netid,
    setNetid,
    detailType,
    setDetailType,
    loading,
    error,
    data,
    observations,
    imported,
    newObservations,
    totalObservations,
    fetchDetail,
    uploadError,
    uploadSuccess,
    handleSearch,
    handleFileUpload,
  } = useWigleDetailLookup();

  const { selectedObs, setSelectedObs, detectionEvidence, detectionLoading, detectionError } =
    useWigleDetectionEvidence(data);

  const { tooltipContainerRef, tooltipHtml } = useWigleTooltipPreview({
    data,
    selectedObs,
    observations,
  });

  const {
    pendingEnrichment,
    isManualMode,
    setIsManualMode,
    activeEnrichmentRun,
    runsLoading,
    actionLoading,
    stopEnrichment,
    handleStartEnrichment,
    handleManualEnrich,
    handleManualSelect,
  } = useWigleEnrichmentControls({ detailType, fetchDetail, setNetid });

  // ── Derived display values ────────────────────────────────────────────────
  const temporal = data
    ? computeTemporalSummary(observations, selectedObs?.observed_at, data.firstSeen, data.lastSeen)
    : null;

  const observedSsid = data ? bestObservedSsid(observations, selectedObs?.ssid) : null;

  const ssidSummary = data ? computeSsidDisplaySummary(data.ssid ?? data.name, observedSsid) : null;

  return (
    <div className="space-y-6">
      {/* 1. Search & File Upload */}
      <WigleDetailSearchCard
        netid={netid}
        setNetid={setNetid}
        detailType={detailType}
        setDetailType={setDetailType}
        loading={loading}
        handleSearch={handleSearch}
        handleFileUpload={handleFileUpload}
        error={error}
        uploadError={uploadError}
        uploadSuccess={uploadSuccess}
      />

      {/* 2. Forensic Details */}
      {data && (
        <AdminCard
          icon={DetailIcon}
          title="Network Forensics"
          color="from-violet-500 to-violet-600"
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <WigleDetailOverviewCard
                  data={data}
                  ssidSummary={ssidSummary}
                  totalObservations={totalObservations}
                  newObservations={newObservations}
                />
              </div>

              <WigleDetailTooltipPreview
                selectedObs={selectedObs}
                tooltipContainerRef={tooltipContainerRef}
                tooltipHtml={tooltipHtml}
                hasData={Boolean(data)}
              />
            </div>

            {/* Address & Location */}
            <WigleDetailLocationCard data={data} />

            {/* Timestamps & Observations Table */}
            <WigleDetailObservationsTable
              temporal={temporal}
              channel={data.channel}
              selectedObs={selectedObs}
              setSelectedObs={setSelectedObs}
              observations={observations}
            />

            {/* Detection Evidence Panel */}
            <WigleDetailEvidencePanel
              detectionEvidence={detectionEvidence}
              detectionLoading={detectionLoading}
              detectionError={detectionError}
            />

            {/* Import Status Banner */}
            {imported && (
              <div className="bg-green-900/20 border border-green-800/50 p-3 rounded text-center text-sm text-green-400">
                {newObservations > 0
                  ? totalObservations > newObservations
                    ? `Imported ${newObservations} new records (had ${totalObservations - newObservations}, now ${totalObservations} total) ✓`
                    : `Imported ${newObservations} records ✓`
                  : totalObservations > 0
                    ? `No new records — all ${totalObservations} already in database ✓`
                    : 'Imported to database ✓'}
              </div>
            )}
          </div>
        </AdminCard>
      )}

      {/* 3. Batch Enrichment Section */}
      <WigleDetailBatchSection
        activeEnrichmentRun={activeEnrichmentRun}
        stopEnrichment={stopEnrichment}
        actionLoading={actionLoading}
        pendingEnrichment={pendingEnrichment}
        isManualMode={isManualMode}
        setIsManualMode={setIsManualMode}
        runsLoading={runsLoading}
        handleStartEnrichment={handleStartEnrichment}
        handleManualEnrich={handleManualEnrich}
        handleManualSelect={handleManualSelect}
      />
    </div>
  );
};
