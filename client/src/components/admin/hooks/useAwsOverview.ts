import { useCallback, useEffect, useState } from 'react';
import { AwsOverview } from '../types/admin.types';

export const useAwsOverview = () => {
  const [overview, setOverview] = useState<AwsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/aws/overview', { credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      setOverview(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load AWS overview');
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  return {
    overview,
    loading,
    error,
    refresh: loadOverview,
  };
};
