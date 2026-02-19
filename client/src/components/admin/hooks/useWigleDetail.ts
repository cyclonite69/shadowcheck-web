import { useState } from 'react';
import { wigleApi } from '../../../api/wigleApi';

export interface WigleDetailData {
  networkId: string;
  name: string | null;
  ssid?: string;
  encryption?: string | null;
  type?: string | null;
  channel?: number | null;
  frequency?: number | null;
  firstSeen: string;
  lastSeen: string;
  lastUpdate: string;
  trilateratedLatitude: number;
  trilateratedLongitude: number;
  streetAddress?: {
    city?: string;
    region?: string;
    country?: string;
    road?: string;
    housenumber?: string;
    postalcode?: string;
  };
  locationClusters?: Array<{
    centroidLatitude: number;
    centroidLongitude: number;
    score: number;
    accuracy?: number;
    locations?: Array<{
      latitude: number;
      longitude: number;
      signal: number;
      time: string;
    }>;
  }>;
}

export type WigleDetailType = 'wifi' | 'bt';

export const useWigleDetail = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WigleDetailData | null>(null);
  const [observations, setObservations] = useState<any[]>([]);
  const [imported, setImported] = useState(false);

  const fetchObservations = async (netid: string) => {
    try {
      const json = await wigleApi.getWigleObservations(netid);
      if (json.ok) {
        setObservations(json.observations || []);
      }
    } catch (err) {
      console.error('Failed to fetch observations:', err);
    }
  };

  const fetchDetail = async (
    netid: string,
    shouldImport: boolean,
    detailType: WigleDetailType = 'wifi'
  ) => {
    if (!netid) {
      setError('Network ID (BSSID) is required');
      return;
    }

    setLoading(true);
    setError(null);
    setImported(false);
    setData(null);
    setObservations([]);

    try {
      const isBluetooth = detailType === 'bt';
      const json = await wigleApi.getWigleDetail(netid, isBluetooth, shouldImport);

      if (!json.ok) {
        throw new Error(json.details || json.error || 'Failed to fetch WiGLE detail');
      }

      setData(json.data);
      setImported(json.imported);

      // If we imported or it already existed, try to fetch individual observations
      if (json.imported || json.data) {
        await fetchObservations(netid);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    data,
    observations,
    imported,
    fetchDetail,
    fetchObservations,
  };
};
