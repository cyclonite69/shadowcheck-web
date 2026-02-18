import { useState, useEffect } from 'react';

export interface Agency {
  office_name: string;
  office_type: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  has_wigle_obs: boolean;
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
          let res;

          if (Array.isArray(bssid)) {
            // Batch mode: multiple BSSIDs
            console.log('[useNearestAgencies] Fetching batch for', bssid.length, 'BSSIDs');
            res = await fetch('/api/networks/nearest-agencies/batch?radius=250', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bssids: bssid }),
              signal: controller.signal,
            });
          } else {
            // Single mode: one BSSID
            console.log('[useNearestAgencies] Fetching single for', bssid);
            res = await fetch(
              `/api/networks/${encodeURIComponent(bssid)}/nearest-agencies?radius=250`,
              { signal: controller.signal }
            );
          }

          const data = await res.json();
          if (!data.ok) {
            throw new Error(data.error || 'Failed to load agencies');
          }
          console.log('[useNearestAgencies] Loaded', data.agencies.length, 'agencies');
          console.log(
            '[useNearestAgencies] States:',
            [...new Set(data.agencies.map((a: Agency) => a.state))].sort()
          );
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
