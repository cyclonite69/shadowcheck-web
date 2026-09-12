import { useCallback, useState } from 'react';
import type React from 'react';
import { useWigleFileUpload } from '../../../hooks/useWigleFileUpload';
import { useWigleDetail, type WigleDetailData, type WigleDetailType } from './useWigleDetail';
import type { WigleObservation } from './useWigleDetectionEvidence';

type FetchDetail = (
  netid: string,
  shouldImport: boolean,
  detailType?: WigleDetailType
) => Promise<void>;

export interface UseWigleDetailLookupResult {
  netid: string;
  setNetid: React.Dispatch<React.SetStateAction<string>>;
  detailType: WigleDetailType;
  setDetailType: React.Dispatch<React.SetStateAction<WigleDetailType>>;
  loading: boolean;
  error: string | null;
  data: WigleDetailData | null;
  observations: WigleObservation[];
  imported: boolean;
  newObservations: number;
  totalObservations: number;
  fetchDetail: FetchDetail;
  uploadError: string | null;
  uploadSuccess: string | null;
  handleSearch: (shouldImport: boolean) => Promise<void>;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export const useWigleDetailLookup = (): UseWigleDetailLookupResult => {
  const [netid, setNetid] = useState('');
  const [detailType, setDetailType] = useState<WigleDetailType>('wifi');
  const {
    loading,
    error,
    data,
    observations,
    imported,
    newObservations,
    totalObservations,
    fetchDetail,
  } = useWigleDetail();
  const { uploadError, uploadSuccess, uploadFile, reset } = useWigleFileUpload();

  const handleSearch = useCallback(
    async (shouldImport: boolean): Promise<void> => {
      reset();
      await fetchDetail(netid, shouldImport, detailType);
    },
    [detailType, fetchDetail, netid, reset]
  );

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const networkId = await uploadFile(file);
      if (networkId) {
        setNetid(networkId);
        await fetchDetail(networkId, false, detailType);
      }

      event.target.value = '';
    },
    [detailType, fetchDetail, uploadFile]
  );

  return {
    netid,
    setNetid,
    detailType,
    setDetailType,
    loading,
    error,
    data,
    observations: observations as WigleObservation[],
    imported,
    newObservations,
    totalObservations,
    fetchDetail,
    uploadError,
    uploadSuccess,
    handleSearch,
    handleFileUpload,
  };
};
