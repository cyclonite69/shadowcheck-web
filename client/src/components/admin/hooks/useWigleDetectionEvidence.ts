import { useEffect, useState } from 'react';
import type React from 'react';
import { apiClient } from '../../../api/client';
import type { WigleDetailData } from './useWigleDetail';

export interface WigleObservation {
  id: number | string;
  observed_at: string;
  latitude: number;
  longitude: number;
  signal: number;
  altitude?: number | null;
  ssid?: string | null;
}

export interface WigleDetectionEvidence {
  device_type: string;
  detected_at?: string | null;
  lastupdt?: string | null;
  threat_score: number;
  confidence: number;
  detection_method?: string | null;
  notes?: string | null;
  matched_signals?: string[] | null;
  false_positive?: boolean;
  fp_reason?: string | null;
  tags?: string[] | Record<string, unknown> | null;
}

interface DetectionEvidenceResponse {
  evidence?: WigleDetectionEvidence[];
}

export interface UseWigleDetectionEvidenceResult {
  selectedObs: WigleObservation | null;
  setSelectedObs: React.Dispatch<React.SetStateAction<WigleObservation | null>>;
  detectionEvidence: WigleDetectionEvidence[];
  detectionLoading: boolean;
  detectionError: string | null;
}

export const useWigleDetectionEvidence = (
  data: WigleDetailData | null
): UseWigleDetectionEvidenceResult => {
  const [selectedObs, setSelectedObs] = useState<WigleObservation | null>(null);
  const [detectionEvidence, setDetectionEvidence] = useState<WigleDetectionEvidence[]>([]);
  const [detectionLoading, setDetectionLoading] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedObs(null);

    if (!data?.networkId) {
      setDetectionEvidence([]);
      setDetectionError(null);
      return;
    }

    const bssid = data.networkId.toUpperCase();
    setDetectionLoading(true);
    setDetectionError(null);
    apiClient
      .get<DetectionEvidenceResponse>(`/admin/networks/${bssid}/detection-evidence`)
      .then((response) => {
        setDetectionEvidence(response?.evidence || []);
      })
      .catch((error: Error) => {
        setDetectionEvidence([]);
        setDetectionError(error.message || 'Failed to load detection evidence');
      })
      .finally(() => {
        setDetectionLoading(false);
      });
  }, [data]);

  return {
    selectedObs,
    setSelectedObs,
    detectionEvidence,
    detectionLoading,
    detectionError,
  };
};
