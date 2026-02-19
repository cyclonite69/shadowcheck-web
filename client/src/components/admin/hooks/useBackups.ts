import { useState } from 'react';
import { adminApi } from '../../../api/adminApi';
import { BackupResult } from '../types/admin.types';

export const useBackups = () => {
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);
  const [backupError, setBackupError] = useState('');
  const [s3Backups, setS3Backups] = useState<any[]>([]);
  const [s3Loading, setS3Loading] = useState(false);

  const runBackup = async (uploadToS3 = false) => {
    setBackupError('');
    setBackupResult(null);
    setBackupLoading(true);
    try {
      const data = await adminApi.createBackup(uploadToS3);
      if (!data.ok) {
        throw new Error(data.error || 'Backup failed');
      }
      setBackupResult({
        backupDir: data.backupDir,
        fileName: data.fileName,
        filePath: data.filePath,
        bytes: data.bytes,
        s3: data.s3,
        s3Error: data.s3Error,
      });

      // Refresh S3 list if upload was successful
      if (uploadToS3 && data.s3) {
        loadS3Backups();
      }
    } catch (err: any) {
      setBackupError(err?.message || 'Backup failed');
    } finally {
      setBackupLoading(false);
    }
  };

  const loadS3Backups = async () => {
    setS3Loading(true);
    try {
      const data = await adminApi.listS3Backups();
      if (data.ok) {
        setS3Backups(data.backups || []);
      }
    } catch (err) {
      console.error('Failed to load S3 backups:', err);
    } finally {
      setS3Loading(false);
    }
  };

  const deleteS3Backup = async (key: string) => {
    try {
      const data = await adminApi.deleteS3Backup(key);
      if (data.ok) {
        // Refresh the list after deletion
        loadS3Backups();
        return true;
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (err: any) {
      console.error('Failed to delete S3 backup:', err);
      throw err;
    }
  };

  return {
    backupLoading,
    backupResult,
    backupError,
    runBackup,
    s3Backups,
    s3Loading,
    loadS3Backups,
    deleteS3Backup,
  };
};
