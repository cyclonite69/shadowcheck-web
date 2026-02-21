import { useState, useEffect } from 'react';
import { agencyApi } from '../../api/agencyApi';

export interface Agency {
  name: string;
  office_type?: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  distance_meters?: number;
  has_wigle_obs?: boolean;
}

export const useNearestAgencies = (bssid: string | string[] | null) => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create stable key for dependency tracking
  const bssidKey = Array.isArray(bssid) ? bssid.sort().join(',') : bssid || '';

  useEffect(() => {
    if (!bssid || (Array.isArray(bssid) && bssid.length === 0)) {
      setAgencies([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      const loadAgencies = async () => {
        setLoading(true);
        setError('');
        try {
          let data;

          if (Array.isArray(bssid)) {
            // Batch mode: multiple BSSIDs
            const result = await agencyApi.getNearestAgenciesBatch(bssid, 250);
            data = { ok: true, agencies: result.agencies || [] };
          } else {
            // Single mode: one BSSID
            const result = await agencyApi.getNearestAgencies(bssid, 250);
            data = { ok: true, agencies: result.agencies || [] };
          }

          if (!data.ok) {
            throw new Error('Failed to load agencies');
          }
          setAgencies(data.agencies || []);
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            setError(err.message);
            setAgencies([]);
          }
        } finally {
          setLoading(false);
        }
      };

      loadAgencies();
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [bssidKey]);

  return { agencies, loading, error };
};
