import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../../api/adminApi';
import type { PgAdminStatus } from '../types/admin.types';

export const usePgAdmin = () => {
  const [status, setStatus] = useState<PgAdminStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await adminApi.getPgAdminStatus();
      setStatus(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load PgAdmin status';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startPgAdmin = useCallback(
    async (_reset = false) => {
      setActionLoading(true);
      setActionMessage('');
      setError('');
      try {
        const data = await adminApi.startPgAdmin();
        setActionMessage(data.message || 'PgAdmin action completed');
        await refreshStatus();
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'PgAdmin action failed';
        setError(errorMessage);
      } finally {
        setActionLoading(false);
      }
    },
    [refreshStatus]
  );

  const stopPgAdmin = useCallback(async () => {
    setActionLoading(true);
    setActionMessage('');
    setError('');
    try {
      const data = await adminApi.stopPgAdmin();
      setActionMessage(data.message || 'PgAdmin stopped');
      await refreshStatus();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'PgAdmin stop failed';
      setError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  }, [refreshStatus]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    status,
    isLoading,
    actionLoading,
    error,
    actionMessage,
    refreshStatus,
    startPgAdmin,
    stopPgAdmin,
  };
};
