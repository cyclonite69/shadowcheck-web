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

const MAC_RE = /^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/;

function normalizeMac(value: string): string {
  return value.trim().replace(/-/g, ':').toUpperCase();
}

export const useWigleDetail = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WigleDetailData | null>(null);
  const [observations, setObservations] = useState<any[]>([]);
  const [imported, setImported] = useState(false);
  const [newObservations, setNewObservations] = useState<number>(0);
  const [totalObservations, setTotalObservations] = useState<number>(0);

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

    const normalized = normalizeMac(netid);
    if (!MAC_RE.test(normalized)) {
      setError(
        `Invalid MAC address format "${netid}" — expected XX:XX:XX:XX:XX:XX (e.g. EC:81:93:76:BD:CE)`
      );
      return;
    }

    setLoading(true);
    setError(null);
    setImported(false);
    setNewObservations(0);
    setTotalObservations(0);
    setData(null);
    setObservations([]);

    try {
      const isBluetooth = detailType === 'bt';
      const json = await wigleApi.getWigleDetail(normalized, isBluetooth, shouldImport);

      if (!json.ok) {
        throw new Error(json.details || json.error || 'Failed to fetch WiGLE detail');
      }

      setData(json.data);
      setImported(json.imported);
      setNewObservations(json.importedObservations ?? 0);
      setTotalObservations(json.totalObservations ?? json.importedObservations ?? 0);

      if (json.imported || json.data) {
        await fetchObservations(normalized);
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
    newObservations,
    totalObservations,
    fetchDetail,
    fetchObservations,
  };
};
