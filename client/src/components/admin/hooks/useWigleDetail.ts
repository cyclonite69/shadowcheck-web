import { useState } from 'react';

export interface WigleDetailData {
  networkId: string;
  name: string | null;
  ssid?: string;
  encryption: string;
  type: string;
  channel: number;
  frequency: number;
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

export const useWigleDetail = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WigleDetailData | null>(null);
  const [observations, setObservations] = useState<any[]>([]);
  const [imported, setImported] = useState(false);

  const fetchObservations = async (netid: string) => {
    try {
      const res = await fetch(`/api/wigle/observations/${encodeURIComponent(netid)}`);
      const json = await res.json();
      if (json.ok) {
        setObservations(json.observations || []);
      }
    } catch (err) {
      console.error('Failed to fetch observations:', err);
    }
  };

  const fetchDetail = async (netid: string, shouldImport: boolean) => {
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
      const response = await fetch(`/api/wigle/detail/${encodeURIComponent(netid)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ import: shouldImport }),
      });

      const json = await response.json();

      if (!response.ok) {
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
