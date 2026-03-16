import { useState, useCallback } from 'react';
import { adminApi } from '../api/adminApi';

type AwsAction = 'start' | 'stop';

interface UseAwsInstanceActionReturn {
  actionLoading: string | null;
  actionError: string | null;
  performAction: (instanceId: string, action: AwsAction) => Promise<boolean>;
  reset: () => void;
}

export function useAwsInstanceAction(): UseAwsInstanceActionReturn {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const performAction = useCallback(
    async (instanceId: string, action: AwsAction): Promise<boolean> => {
      setActionLoading(instanceId);
      setActionError(null);

      try {
        const response = await adminApi.controlAwsInstance(instanceId, action);
        if (!response?.ok) {
          throw new Error(response?.error || `Failed to ${action} instance`);
        }

        return true;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : `Failed to ${action} instance`);
        return false;
      } finally {
        setActionLoading(null);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setActionError(null);
  }, []);

  return {
    actionLoading,
    actionError,
    performAction,
    reset,
  };
}
