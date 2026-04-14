import fs from 'fs/promises';
import { spawn } from 'child_process';
import {
  parseBackupSchemas,
  resolveBackupScope,
  verifyBackupFile,
} from '../../../../server/src/services/backup/backupUtils';

jest.mock('fs/promises', () => ({
  stat: jest.fn(),
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

describe('backupUtils Service', () => {
  const mockStat = fs.stat as jest.Mock;
  const mockSpawn = spawn as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseBackupSchemas()', () => {
    it('should parse comma-separated schemas', () => {
      expect(parseBackupSchemas('public, app ,  geo')).toEqual(['public', 'app', 'geo']);
    });

    it('should return empty array for empty input', () => {
      expect(parseBackupSchemas('')).toEqual([]);
      expect(parseBackupSchemas(undefined)).toEqual([]);
    });
  });

  describe('resolveBackupScope()', () => {
    it('should return full_database if BACKUP_INCLUDE_ALL_SCHEMAS is true', () => {
      const scope = resolveBackupScope({ BACKUP_INCLUDE_ALL_SCHEMAS: 'true' });
      expect(scope.mode).toBe('full_database');
      expect(scope.explicit).toBe(true);
    });

    it('should return schema_subset if BACKUP_INCLUDE_ALL_SCHEMAS is false and schemas provided', () => {
      const scope = resolveBackupScope({
        BACKUP_INCLUDE_ALL_SCHEMAS: 'false',
        BACKUP_SCHEMAS: 'public,app',
      });
      expect(scope.mode).toBe('schema_subset');
      expect(scope.schemas).toEqual(['public', 'app']);
    });

    it('should return full_database if BACKUP_INCLUDE_ALL_SCHEMAS is false but no schemas provided', () => {
      const scope = resolveBackupScope({
        BACKUP_INCLUDE_ALL_SCHEMAS: 'false',
      });
      expect(scope.mode).toBe('full_database');
      expect(scope.schemas).toEqual([]);
    });

    it('should return schema_subset if schemas provided without flag', () => {
      const scope = resolveBackupScope({
        BACKUP_SCHEMAS: 'public,app',
      });
      expect(scope.mode).toBe('schema_subset');
      expect(scope.schemas).toEqual(['public', 'app']);
    });

    it('should return default full_database if nothing provided', () => {
      const scope = resolveBackupScope({});
      expect(scope.mode).toBe('full_database');
      expect(scope.explicit).toBe(false);
    });

    it('should handle different truthy/falsy values for flags', () => {
      expect(resolveBackupScope({ BACKUP_INCLUDE_ALL_SCHEMAS: 'yes' }).mode).toBe('full_database');
      expect(resolveBackupScope({ BACKUP_INCLUDE_ALL_SCHEMAS: '1' }).mode).toBe('full_database');
      expect(resolveBackupScope({ BACKUP_INCLUDE_ALL_SCHEMAS: 'on' }).mode).toBe('full_database');

      expect(resolveBackupScope({ BACKUP_INCLUDE_ALL_SCHEMAS: 'no' }).mode).toBe('full_database');
      expect(resolveBackupScope({ BACKUP_INCLUDE_ALL_SCHEMAS: '0' }).mode).toBe('full_database');
      expect(resolveBackupScope({ BACKUP_INCLUDE_ALL_SCHEMAS: 'off' }).mode).toBe('full_database');

      expect(resolveBackupScope({ BACKUP_INCLUDE_ALL_SCHEMAS: 'invalid' }).mode).toBe(
        'full_database'
      );
    });
  });

  describe('verifyBackupFile()', () => {
    it('should resolve with file size on success', async () => {
      mockStat.mockResolvedValueOnce({ size: 1024 });
      const callbacks: Record<string, Function> = {};
      mockSpawn.mockReturnValue({
        stderr: { on: jest.fn() },
        on: jest.fn((event, cb) => {
          callbacks[event] = cb;
        }),
      });

      const promise = verifyBackupFile('/tmp/file.dump', 'pg_restore');

      await new Promise((resolve) => setImmediate(resolve));
      callbacks['close'](0);

      const result = await promise;
      expect(result).toBe(1024);
      expect(mockSpawn).toHaveBeenCalledWith(
        'pg_restore',
        ['-l', '/tmp/file.dump'],
        expect.any(Object)
      );
    });

    it('should throw if file is empty', async () => {
      mockStat.mockResolvedValueOnce({ size: 0 });
      await expect(verifyBackupFile('/tmp/file.dump', 'pg_restore')).rejects.toThrow(
        'Backup file is empty'
      );
    });

    it('should throw if pg_restore fails', async () => {
      mockStat.mockResolvedValueOnce({ size: 1024 });
      const callbacks: Record<string, Function> = {};
      const stderrCallbacks: Record<string, Function> = {};
      mockSpawn.mockReturnValue({
        stderr: {
          on: jest.fn((event, cb) => {
            stderrCallbacks[event] = cb;
          }),
        },
        on: jest.fn((event, cb) => {
          callbacks[event] = cb;
        }),
      });

      const promise = verifyBackupFile('/tmp/file.dump', 'pg_restore');

      await new Promise((resolve) => setImmediate(resolve));
      stderrCallbacks['data'](Buffer.from('corrupt file'));
      callbacks['close'](1);

      await expect(promise).rejects.toThrow('corrupt file');
    });

    it('should throw default error if pg_restore fails with no stderr', async () => {
      mockStat.mockResolvedValueOnce({ size: 1024 });
      const callbacks: Record<string, Function> = {};
      mockSpawn.mockReturnValue({
        stderr: { on: jest.fn() },
        on: jest.fn((event, cb) => {
          callbacks[event] = cb;
        }),
      });

      const promise = verifyBackupFile('/tmp/file.dump', 'pg_restore');

      await new Promise((resolve) => setImmediate(resolve));
      callbacks['close'](1);

      await expect(promise).rejects.toThrow('pg_restore failed verifying /tmp/file.dump (code 1)');
    });

    it('should reject on spawn error', async () => {
      mockStat.mockResolvedValueOnce({ size: 1024 });
      const callbacks: Record<string, Function> = {};
      mockSpawn.mockReturnValue({
        stderr: { on: jest.fn() },
        on: jest.fn((event, cb) => {
          callbacks[event] = cb;
        }),
      });

      const promise = verifyBackupFile('/tmp/file.dump', 'pg_restore');

      await new Promise((resolve) => setImmediate(resolve));
      callbacks['error'](new Error('Spawn failed'));

      await expect(promise).rejects.toThrow('Spawn failed');
    });
  });
});
