import { useState, useEffect } from 'react';
import { agencyApi } from '../../../api/agencyApi';
import type { CourthouseMatch } from '../../../api/agencyApi';

export type { CourthouseMatch };

export const useNearestCourthouses = (bssids: string[] | null) => {
  const [courthouses, setCourthouses] = useState<CourthouseMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bssidKey = bssids ? [...bssids].sort().join(',') : '';

  useEffect(() => {
    if (!bssids || bssids.length === 0) {
      setCourthouses([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      const load = async () => {
        setLoading(true);
        setError('');
        try {
          const result = await agencyApi.getNearestCourthousesBatch(bssids, 250);
          setCourthouses(result.courthouses || []);
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            setError(err.message);
            setCourthouses([]);
          }
        } finally {
          setLoading(false);
        }
      };
      load();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [bssidKey]);

  return { courthouses, loading, error };
};
