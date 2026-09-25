import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import os from 'os';
import { spawn, execSync } from 'child_process';
import {
  runPostgresBackup,
  listS3Backups,
  deleteS3Backup,
} from '../../../server/src/services/backupService';
import secretsManager from '../../../server/src/services/secretsManager';
import {
  deleteS3BackupObject,
  listS3BackupObjects,
  uploadBackupToS3,
} from '../../../server/src/services/backup/awsCli';
import {
  resolveBackupScope,
  verifyBackupFile,
} from '../../../server/src/services/backup/backupUtils';
import logger from '../../../server/src/logging/logger';
import { EventEmitter } from 'events';

// Mock winston to avoid file transport issues
jest.mock('winston', () => ({
  format: {
    combine: jest.fn().mockReturnThis(),
    timestamp: jest.fn().mockReturnThis(),
    errors: jest.fn().mockReturnThis(),
    splat: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    colorize: jest.fn().mockReturnThis(),
    printf: jest.fn().mockReturnThis(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
  createLogger: jest.fn().mockReturnValue({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
    on: jest.fn(),
  }),
  addColors: jest.fn(),
}));

// Mock all dependencies
jest.mock('fs/promises');
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    createWriteStream: jest.fn(),
    constants: { X_OK: 1, F_OK: 0, R_OK: 4, W_OK: 2 },
  };
});
jest.mock('os');
jest.mock('child_process');
jest.mock('../../../server/src/services/secretsManager');
jest.mock('../../../server/src/services/backup/awsCli');
jest.mock('../../../server/src/services/backup/backupUtils');
jest.mock('../../../server/src/logging/logger');

describe('backupService', () => {
  const mockEnv = { ...process.env };

  const createMockStream = () => {
    const stream = new EventEmitter() as any;
    stream.write = jest.fn().mockReturnValue(true);
    stream.end = jest.fn();
    stream.destroy = jest.fn();
    stream.pipe = jest.fn().mockReturnThis();
    stream.writable = true;
    return stream;
  };

  const createMockProcess = (code: number, stderrContent = '') => {
    const stdout = new EventEmitter() as any;
    stdout.pipe = jest.fn();
    const stderr = new EventEmitter() as any;
    const child = new EventEmitter() as any;
    child.stdout = stdout;
    child.stderr = stderr;

    child.on = jest.fn().mockImplementation((event, cb) => {
      if (event === 'close') {
        process.nextTick(() => {
          if (stderrContent) {
            stderr.emit('data', Buffer.from(stderrContent));
          }
          cb(code);
        });
      }
      return child;
    });

    return child;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...mockEnv,
      DB_HOST: 'localhost',
      DB_NAME: 'test_db',
      DB_USER: 'test_user',
      BACKUP_DIR: '/tmp/backups',
      S3_BACKUP_BUCKET: 'test-bucket',
    };

    (os.hostname as jest.Mock).mockReturnValue('test-host');
    (resolveBackupScope as jest.Mock).mockReturnValue({ mode: 'full', schemas: [] });
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.stat as jest.Mock).mockResolvedValue({ size: 1024, mtimeMs: Date.now() });
    (fs.readdir as jest.Mock).mockResolvedValue([]);
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
    (verifyBackupFile as jest.Mock).mockResolvedValue(1024);
    (createWriteStream as jest.Mock).mockImplementation(createMockStream);
    (spawn as jest.Mock).mockImplementation(() => createMockProcess(0));
    (execSync as jest.Mock).mockImplementation(() => {
      throw new Error('not aws');
    });
  });

  afterAll(() => {
    process.env = mockEnv;
  });

  describe('runPostgresBackup', () => {
    it('should successfully run a standard backup', async () => {
      const result = await runPostgresBackup();

      expect(fs.mkdir).toHaveBeenCalledWith('/tmp/backups', { recursive: true });
      expect(spawn).toHaveBeenCalled();
      expect(verifyBackupFile).toHaveBeenCalled();
      expect(result.fileName).toContain('test_db_');
      expect(result.bytes).toBe(1024);
    });

    it('should run a dockerized backup when DB_HOST is "postgres"', async () => {
      process.env.DB_HOST = 'postgres';
      process.env.DB_SSL = 'false';

      const result = await runPostgresBackup();

      expect(spawn).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['exec', 'shadowcheck_postgres_local', 'pg_dump']),
        expect.any(Object)
      );
      expect(result.source.environment).toBe('local');
    });

    it('should handle pg_dump failure', async () => {
      (spawn as jest.Mock).mockImplementation((cmd, args) => {
        if (args.includes('pg_dump') || cmd.includes('pg_dump')) {
          return createMockProcess(1, 'dump failed');
        }
        return createMockProcess(0);
      });

      await expect(runPostgresBackup()).rejects.toThrow('pg_dump failed (code 1): dump failed');
    });

    it('should upload to S3 when requested', async () => {
      (uploadBackupToS3 as jest.Mock).mockResolvedValue({
        ETag: 'test-etag',
        Location: 's3-location',
        Key: 'backup-key',
      });

      const result = await runPostgresBackup({ uploadToS3: true });

      expect(uploadBackupToS3).toHaveBeenCalled();
      expect(result.s3).toBeDefined();
      expect(result.s3[0].Key).toBe('backup-key');
    });

    it('should continue if S3 upload fails', async () => {
      (uploadBackupToS3 as jest.Mock).mockRejectedValue(new Error('S3 upload error'));

      const result = await runPostgresBackup({ uploadToS3: true });

      expect(result.s3Error).toBe('S3 upload error');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('S3 upload failed'));
    });

    it('should handle schema-scoped backup', async () => {
      (resolveBackupScope as jest.Mock).mockReturnValue({
        mode: 'schema_subset',
        schemas: ['public', 'audit'],
      });

      await runPostgresBackup();

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--schema', 'public', '--schema', 'audit']),
        expect.any(Object)
      );
    });

    it('should prune old backups', async () => {
      process.env.BACKUP_RETENTION_DAYS = '7';
      const now = Date.now();
      const oldTime = now - 10 * 24 * 60 * 60 * 1000;

      (fs.readdir as jest.Mock).mockResolvedValue([
        { isFile: () => true, name: 'old.dump' },
        { isFile: () => true, name: 'new.dump' },
      ]);

      (fs.stat as jest.Mock).mockImplementation((path: string) => {
        if (path.endsWith('old.dump')) {
          return Promise.resolve({ size: 1024, mtimeMs: oldTime });
        }
        return Promise.resolve({ size: 1024, mtimeMs: now });
      });

      await runPostgresBackup();

      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('old.dump'));
      expect(fs.unlink).not.toHaveBeenCalledWith(expect.stringContaining('new.dump'));
    });

    it('should not prune if retention days is 0', async () => {
      process.env.BACKUP_RETENTION_DAYS = '0';
      await runPostgresBackup();
      expect(fs.readdir).not.toHaveBeenCalled();
    });

    it('should use secretsManager for passwords', async () => {
      (secretsManager.get as jest.Mock).mockImplementation((key) => {
        if (key === 'db_admin_password') {
          return 'admin-pass';
        }
        return null;
      });

      await runPostgresBackup();

      const spawnCalls = (spawn as jest.Mock).mock.calls;
      const pgDumpCall = spawnCalls.find(
        (call) =>
          (call[0].includes('pg_dump') || (call[1] && call[1].includes('pg_dump'))) &&
          call[2].env.PGPASSWORD === 'admin-pass'
      );
      expect(pgDumpCall).toBeDefined();
    });

    it('should fall back to application credentials if admin ones are missing', async () => {
      process.env.DB_HOST = 'remote-host';
      process.env.DB_USER = 'app-user';
      (secretsManager.get as jest.Mock).mockImplementation((key) => {
        if (key === 'db_password') {
          return 'app-pass';
        }
        return null;
      });
      delete process.env.DB_ADMIN_PASSWORD;

      await runPostgresBackup();

      const spawnCalls = (spawn as jest.Mock).mock.calls;
      const pgDumpCall = spawnCalls.find((call) => call[1].includes('--format=custom'));
      expect(pgDumpCall[2].env.PGUSER).toBe('app-user');
      expect(pgDumpCall[2].env.PGPASSWORD).toBe('app-pass');
    });

    it('should detect AWS environment via IMDS', async () => {
      (execSync as jest.Mock).mockReturnValue('i-1234567890abcdef0');

      const result = await runPostgresBackup();

      expect(result.source.environment).toBe('aws-ec2');
      expect(result.source.instanceId).toBe('i-1234567890abcdef0');
    });

    it('should detect AWS environment via hostname', async () => {
      (os.hostname as jest.Mock).mockReturnValue('ip-10-0-0-1.ec2.internal');
      const result = await runPostgresBackup();
      expect(result.source.environment).toBe('aws-ec2');
    });

    it('should resolve tool path from env var', async () => {
      process.env.PG_DUMP_PATH = '/custom/pg_dump';
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      await runPostgresBackup();

      expect(fs.access).toHaveBeenCalledWith('/custom/pg_dump', expect.anything());
    });

    it('should throw error if backup directory cannot be created', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValueOnce(new Error('Permission Denied'));
      await expect(runPostgresBackup()).rejects.toThrow('Permission Denied');
    });

    it('should throw if globals file is empty', async () => {
      (fs.stat as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('globals_')) {
          return Promise.resolve({ size: 0 });
        }
        return Promise.resolve({ size: 1024 });
      });

      await expect(runPostgresBackup()).rejects.toThrow('Globals backup file is empty');
    });

    it('should handle S3 bucket listing error', async () => {
      (listS3BackupObjects as jest.Mock).mockRejectedValueOnce(new Error('S3 Access Denied'));
      await expect(listS3Backups()).rejects.toThrow('S3 Access Denied');
    });

    it('should handle S3 backup deletion error', async () => {
      (deleteS3BackupObject as jest.Mock).mockRejectedValueOnce(new Error('Delete Failed'));
      await expect(deleteS3Backup('key')).rejects.toThrow('Delete Failed');
    });
  });
});
