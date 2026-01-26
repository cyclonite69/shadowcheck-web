import { useState } from 'react';
import { BackupResult } from '../types/admin.types';

export const useBackups = () => {
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);
  const [backupError, setBackupError] = useState('');

  const runBackup = async () => {
    setBackupError('');
    setBackupResult(null);
    setBackupLoading(true);
    try {
      const res = await fetch('/api/admin/backup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      setBackupResult({
        backupDir: data.backupDir,
        fileName: data.fileName,
        filePath: data.filePath,
        bytes: data.bytes,
      });
    } catch (err: any) {
      setBackupError(err?.message || 'Backup failed');
    } finally {
      setBackupLoading(false);
    }
  };

  return {
    backupLoading,
    backupResult,
    backupError,
    runBackup,
  };
};
