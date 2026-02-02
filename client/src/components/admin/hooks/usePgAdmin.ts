import { useCallback, useEffect, useState } from 'react';
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
      const response = await fetch('/api/admin/pgadmin/status');
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      setStatus(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load PgAdmin status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startPgAdmin = useCallback(
    async (reset = false) => {
      setActionLoading(true);
      setActionMessage('');
      setError('');
      try {
        const response = await fetch('/api/admin/pgadmin/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reset }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        setActionMessage(data.message || 'PgAdmin action completed');
        await refreshStatus();
      } catch (err: any) {
        setError(err?.message || 'PgAdmin action failed');
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
      const response = await fetch('/api/admin/pgadmin/stop', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      setActionMessage(data.message || 'PgAdmin stopped');
      await refreshStatus();
    } catch (err: any) {
      setError(err?.message || 'PgAdmin stop failed');
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
