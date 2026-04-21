import { adminApi } from '../../../api/adminApi';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { AwsOverview } from '../../../types/admin';

export const useAwsOverview = () => {
  const {
    data: overview,
    loading,
    error: fetchError,
    refetch: refresh,
  } = useAsyncData<AwsOverview>(() => adminApi.getAwsOverview(), []);

  return {
    overview,
    loading,
    error: fetchError?.message ?? null,
    refresh,
  };
};
