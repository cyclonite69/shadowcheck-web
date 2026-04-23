import { useState, useCallback } from 'react';
import { useWigleDetail, type WigleDetailType } from '../hooks/useWigleDetail';
import { useWigleFileUpload } from '../../../hooks/useWigleFileUpload';
import { useWigleRuns } from '../hooks/useWigleRuns';
import { wigleApi } from '../../../api/wigleApi';

export const useWigleDetailData = () => {
  const [netid, setNetid] = useState('');
  const [detailType, setDetailType] = useState<WigleDetailType>('wifi');
  const [pendingEnrichment, setPendingEnrichment] = useState<number | null>(null);

  const wigleDetail = useWigleDetail();
  const fileUpload = useWigleFileUpload();
  const wigleRuns = useWigleRuns({ limit: 10 });

  const loadEnrichmentStats = useCallback(async () => {
    try {
      const data = await wigleApi.getEnrichmentStats();
      if (data?.ok) {
        setPendingEnrichment(data.pendingCount);
      }
    } catch (e) {
      console.error('Failed to load enrichment stats', e);
    }
  }, []);

  const handleStartEnrichment = useCallback(
    async (manualBssids?: string[]) => {
      try {
        const data = await wigleApi.startEnrichment(manualBssids);
        if (data?.ok) {
          await wigleRuns.refresh();
          void loadEnrichmentStats();
        }
      } catch (e: any) {
        alert(`Failed to start enrichment: ${e.message}`);
      }
    },
    [wigleRuns, loadEnrichmentStats]
  );

  const handleSearch = useCallback(
    (shouldImport: boolean) => {
      fileUpload.reset();
      wigleDetail.fetchDetail(netid, shouldImport, detailType);
    },
    [netid, detailType, fileUpload, wigleDetail]
  );

  return {
    netid,
    setNetid,
    detailType,
    setDetailType,
    pendingEnrichment,
    loadEnrichmentStats,
    handleStartEnrichment,
    handleSearch,
    wigleDetail,
    fileUpload,
    wigleRuns,
  };
};
