import {
  runPostgresBackup,
  listS3Backups,
  deleteS3Backup,
} from '../../../server/src/services/backupService';
import fs from 'fs/promises';
import {
  uploadBackupToS3,
  listS3BackupObjects,
  deleteS3BackupObject,
} from '../../../server/src/services/backup/awsCli';
import {
  verifyBackupFile,
  resolveBackupScope,
} from '../../../server/src/services/backup/backupUtils';
import { spawn } from 'child_process';

jest.mock('fs/promises');
jest.mock('../../../server/src/services/backup/awsCli');
jest.mock('../../../server/src/services/backup/backupUtils');
jest.mock('child_process');

describe('backupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DB_HOST = 'postgres';
    process.env.DB_SSL = 'true';
    (resolveBackupScope as jest.Mock).mockReturnValue({ mode: 'full', schemas: [] });
  });

  describe('runPostgresBackup', () => {
    it('should execute backup process', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.readdir as jest.Mock).mockResolvedValue([]);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      (verifyBackupFile as jest.Mock).mockResolvedValue(1024);
      (spawn as any).mockReturnValue({
        stderr: { on: jest.fn() },
        on: jest.fn((event, cb) => event === 'close' && cb(0)),
      });

      const result = await runPostgresBackup({ uploadToS3: false });

      expect(fs.mkdir).toHaveBeenCalled();
      expect(verifyBackupFile).toHaveBeenCalled();
      expect(result.bytes).toBe(1024);
    });
  });

  describe('listS3Backups', () => {
    it('should list S3 backups', async () => {
      (listS3BackupObjects as jest.Mock).mockResolvedValue([
        {
          Key: 'backups/db_20260101.dump',
          Size: 100,
          LastModified: new Date(),
        },
      ]);
      process.env.S3_BACKUP_BUCKET = 'test-bucket';

      const backups = await listS3Backups();
      expect(backups).toHaveLength(1);
      expect(backups[0].fileName).toBe('db_20260101.dump');
    });
  });

  describe('deleteS3Backup', () => {
    it('should delete S3 backup', async () => {
      process.env.S3_BACKUP_BUCKET = 'test-bucket';
      (deleteS3BackupObject as jest.Mock).mockResolvedValue(undefined);

      const result = await deleteS3Backup('key');
      expect(result.deleted).toBe(true);
      expect(deleteS3BackupObject).toHaveBeenCalledWith('test-bucket', 'key');
    });
  });
});
