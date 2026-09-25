import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs/promises';
import { constants, createWriteStream } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import {
  pruneOldBackups,
  resolvePgToolPath,
  isLocalComposePostgres,
  getLocalPostgresContainerName,
  runDockerizedLocalPgDump,
  runNativePgDump,
} from '../../../../server/src/services/backup/pgTools';

// Mock dependencies
jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
  access: jest.fn(),
}));

jest.mock('fs', () => ({
  constants: { X_OK: 1 },
  createWriteStream: jest.fn(),
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('../../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('pgTools Service', () => {
  const originalEnv = { ...process.env };
  const mockReaddir = fs.readdir as any;
  const mockStat = fs.stat as any;
  const mockUnlink = fs.unlink as any;
  const mockAccess = fs.access as any;
  const mockCreateWriteStream = createWriteStream as any;
  const mockSpawn = spawn as any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('pruneOldBackups()', () => {
    it('returns immediately if days is not positive', async () => {
      await pruneOldBackups('/tmp', 0);
      expect(mockReaddir).not.toHaveBeenCalled();
    });

    it('unlinks only old dump files', async () => {
      mockReaddir.mockResolvedValueOnce([
        { isFile: () => true, name: 'old.dump' },
        { isFile: () => true, name: 'new.dump' },
        { isFile: () => false, name: 'directory.dump' },
        { isFile: () => true, name: 'other.txt' },
      ] as any);

      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;

      mockStat.mockImplementation((filePath: string) => {
        if (filePath.includes('old.dump')) {
          return Promise.resolve({ mtimeMs: now - 5 * oneDayMs }); // 5 days old
        }
        return Promise.resolve({ mtimeMs: now - Number(oneDayMs) }); // 1 day old
      });

      await pruneOldBackups('/tmp', 3); // prune > 3 days old

      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledWith(path.join('/tmp', 'old.dump'));
    });
  });

  describe('resolvePgToolPath()', () => {
    it('returns the toolName itself if candidates matching toolName is hit first', async () => {
      process.env.PG_DUMP_PATH = 'pg_dump';
      const result = await resolvePgToolPath('pg_dump');
      expect(result).toBe('pg_dump');
      expect(mockAccess).not.toHaveBeenCalled();
    });

    it('returns first accessible candidate path', async () => {
      process.env.PG_DUMP_PATH = '/custom/path/pg_dump';
      mockAccess.mockResolvedValueOnce(undefined); // access custom path succeeds

      const result = await resolvePgToolPath('pg_dump');
      expect(result).toBe('/custom/path/pg_dump');
      expect(mockAccess).toHaveBeenCalledWith('/custom/path/pg_dump', 1);
    });

    it('falls back to default toolName if all candidates access checks fail', async () => {
      process.env.PG_DUMP_PATH = '/custom/path/pg_dump';
      mockAccess.mockRejectedValue(new Error('no access')); // all fail

      const result = await resolvePgToolPath('pg_dump');
      expect(result).toBe('pg_dump');
    });
  });

  describe('isLocalComposePostgres()', () => {
    it('returns true if host is postgres and ssl is not true', () => {
      process.env.DB_HOST = 'postgres';
      process.env.DB_SSL = 'false';
      expect(isLocalComposePostgres()).toBe(true);
    });

    it('returns false otherwise', () => {
      process.env.DB_HOST = 'remote-host';
      expect(isLocalComposePostgres()).toBe(false);
    });
  });

  describe('getLocalPostgresContainerName()', () => {
    it('prefers POSTGRES_CONTAINER env if set', () => {
      process.env.POSTGRES_CONTAINER = 'my_custom_pg';
      expect(getLocalPostgresContainerName()).toBe('my_custom_pg');
    });

    it('defaults to shadowcheck_postgres_local', () => {
      delete process.env.POSTGRES_CONTAINER;
      expect(getLocalPostgresContainerName()).toBe('shadowcheck_postgres_local');
    });
  });

  describe('runDockerizedLocalPgDump()', () => {
    const setupDockerSpawns = () => {
      const mockOutput = {
        destroy: jest.fn(),
        end: jest.fn(),
      };
      mockCreateWriteStream.mockReturnValue(mockOutput);

      const spawnCallbacks: Record<string, Function> = {};
      const stderrCallbacks: Record<string, Function> = {};
      const mockChild = {
        stdout: {
          pipe: jest.fn(),
        },
        stderr: {
          on: jest.fn((event: any, cb: any) => {
            stderrCallbacks[event] = cb;
          }),
        },
        on: jest.fn((event: any, cb: any) => {
          spawnCallbacks[event] = cb;
        }),
      };
      mockSpawn.mockReturnValue(mockChild);

      return { mockOutput, mockChild, spawnCallbacks, stderrCallbacks };
    };

    it('runs successful globals and main database dumps', async () => {
      const { spawnCallbacks } = setupDockerSpawns();

      const promise = runDockerizedLocalPgDump({
        dbFilePath: '/tmp/db.dump',
        globalsFilePath: '/tmp/globals.sql',
        database: 'shadowcheck_db',
        backupScope: { mode: 'full_database', schemas: [], explicit: false },
        adminUser: 'shadowcheck_admin',
      });

      // Tick to register pg_dumpall callbacks
      await new Promise((resolve) => setImmediate(resolve));
      spawnCallbacks['close'](0); // pg_dumpall succeeds

      // Tick to register main pg_dump callbacks
      await new Promise((resolve) => setImmediate(resolve));
      spawnCallbacks['close'](0); // pg_dump succeeds

      const result = await promise;
      expect(result).toEqual({ globalsSuccess: true });
      expect(mockSpawn).toHaveBeenCalledTimes(2);
    });

    it('continues main dump if globals dump fails', async () => {
      const { spawnCallbacks, stderrCallbacks } = setupDockerSpawns();

      const promise = runDockerizedLocalPgDump({
        dbFilePath: '/tmp/db.dump',
        globalsFilePath: '/tmp/globals.sql',
        database: 'shadowcheck_db',
        backupScope: { mode: 'schema_subset', schemas: ['app'], explicit: true },
        adminUser: 'shadowcheck_admin',
      });

      // Tick for pg_dumpall globals
      await new Promise((resolve) => setImmediate(resolve));
      stderrCallbacks['data'](Buffer.from('Permission Denied'));
      spawnCallbacks['close'](1); // pg_dumpall fails

      // Tick for main pg_dump
      await new Promise((resolve) => setImmediate(resolve));
      spawnCallbacks['close'](0); // pg_dump succeeds

      const result = await promise;
      expect(result).toEqual({ globalsSuccess: false });
      expect(mockSpawn).toHaveBeenCalledTimes(2);
    });

    it('rejects on main dump failure', async () => {
      const { spawnCallbacks, stderrCallbacks } = setupDockerSpawns();

      const promise = runDockerizedLocalPgDump({
        dbFilePath: '/tmp/db.dump',
        globalsFilePath: '/tmp/globals.sql',
        database: 'shadowcheck_db',
        backupScope: { mode: 'full_database', schemas: [], explicit: false },
        adminUser: 'shadowcheck_admin',
      });

      // Tick for pg_dumpall
      await new Promise((resolve) => setImmediate(resolve));
      spawnCallbacks['close'](0);

      // Tick for main pg_dump
      await new Promise((resolve) => setImmediate(resolve));
      stderrCallbacks['data'](Buffer.from('Database does not exist'));
      spawnCallbacks['close'](1); // pg_dump fails

      await expect(promise).rejects.toThrow('pg_dump failed (code 1): Database does not exist');
    });

    it('rejects on spawn error event', async () => {
      const { spawnCallbacks, mockOutput } = setupDockerSpawns();

      const promise = runDockerizedLocalPgDump({
        dbFilePath: '/tmp/db.dump',
        globalsFilePath: '/tmp/globals.sql',
        database: 'shadowcheck_db',
        backupScope: { mode: 'full_database', schemas: [], explicit: false },
        adminUser: 'shadowcheck_admin',
      });

      // Tick and resolve the first spawn (globals dump) successfully
      await new Promise((resolve) => setImmediate(resolve));
      spawnCallbacks['close'](0);

      // Tick and trigger error on the second spawn (main database dump)
      await new Promise((resolve) => setImmediate(resolve));
      spawnCallbacks['error'](new Error('Docker executable not found'));

      await expect(promise).rejects.toThrow('Docker executable not found');
      expect(mockOutput.destroy).toHaveBeenCalled();
    });
  });

  describe('runNativePgDump()', () => {
    const setupNativeSpawns = () => {
      const spawnCallbacks: Record<string, Function> = {};
      const stderrCallbacks: Record<string, Function> = {};
      const mockChild = {
        stderr: {
          on: jest.fn((event: any, cb: any) => {
            stderrCallbacks[event] = cb;
          }),
        },
        on: jest.fn((event: any, cb: any) => {
          spawnCallbacks[event] = cb;
        }),
      };
      mockSpawn.mockReturnValue(mockChild);

      return { mockChild, spawnCallbacks, stderrCallbacks };
    };

    it('executes native dumps successfully', async () => {
      const { spawnCallbacks } = setupNativeSpawns();

      const promise = runNativePgDump({
        dbFilePath: '/tmp/db.dump',
        globalsFilePath: '/tmp/globals.sql',
        pgDumpPath: 'pg_dump',
        pgDumpAllPath: 'pg_dumpall',
        pgEnv: {},
        backupScope: { mode: 'full_database', schemas: [], explicit: false },
      });

      // Tick for pg_dumpall
      await new Promise((resolve) => setImmediate(resolve));
      spawnCallbacks['close'](0);

      // Tick for main pg_dump
      await new Promise((resolve) => setImmediate(resolve));
      spawnCallbacks['close'](0);

      const result = await promise;
      expect(result).toEqual({ globalsSuccess: true });
    });

    it('handles schema subsets in native pg_dump arguments', async () => {
      const { spawnCallbacks } = setupNativeSpawns();

      const promise = runNativePgDump({
        dbFilePath: '/tmp/db.dump',
        globalsFilePath: '/tmp/globals.sql',
        pgDumpPath: 'pg_dump',
        pgDumpAllPath: 'pg_dumpall',
        pgEnv: {},
        backupScope: { mode: 'schema_subset', schemas: ['geo', 'app'], explicit: true },
      });

      await new Promise((resolve) => setImmediate(resolve));
      spawnCallbacks['close'](0);

      await new Promise((resolve) => setImmediate(resolve));
      spawnCallbacks['close'](0);

      await promise;
      const lastSpawnArgs = mockSpawn.mock.calls[1][1];
      expect(lastSpawnArgs).toContain('--schema');
      expect(lastSpawnArgs).toContain('geo');
      expect(lastSpawnArgs).toContain('app');
    });

    it('rejects on main pg_dump failure', async () => {
      const { spawnCallbacks, stderrCallbacks } = setupNativeSpawns();

      const promise = runNativePgDump({
        dbFilePath: '/tmp/db.dump',
        globalsFilePath: '/tmp/globals.sql',
        pgDumpPath: 'pg_dump',
        pgDumpAllPath: 'pg_dumpall',
        pgEnv: {},
        backupScope: { mode: 'full_database', schemas: [], explicit: false },
      });

      // Tick for pg_dumpall
      await new Promise((resolve) => setImmediate(resolve));
      spawnCallbacks['close'](0);

      // Tick for pg_dump
      await new Promise((resolve) => setImmediate(resolve));
      stderrCallbacks['data'](Buffer.from('pg_dump connection error'));
      spawnCallbacks['close'](1);

      await expect(promise).rejects.toThrow('pg_dump failed (code 1): pg_dump connection error');
    });
  });
});
