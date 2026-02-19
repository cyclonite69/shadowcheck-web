import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../../api/adminApi';
import { AwsOverview } from '../types/admin.types';

export const useAwsOverview = () => {
  const [overview, setOverview] = useState<AwsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getAwsOverview();
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
