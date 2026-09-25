export {};

import * as fs from 'fs';
import {
  validateSQLiteMagic,
  resolveEtlCommand,
  getImportCommand,
  getKmlImportCommand,
  getSqlImportCommand,
  sanitizeRelativePath,
  parseRelativePathsPayload,
  getKmlImportHistoryContext,
  parseKmlImportCounts,
} from '../../../../server/src/services/admin/adminHelpers';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  promises: {
    open: jest.fn(),
  },
}));

// Mock secretsManager via container (used by getSqlImportCommand)
jest.mock('../../../../server/src/config/container', () => ({
  secretsManager: {
    get: jest.fn().mockReturnValue(''),
  },
}));

const existsSyncMock = fs.existsSync as jest.Mock;
const openMock = fs.promises.open as jest.Mock;

describe('adminHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── validateSQLiteMagic ───────────────────────────────────────────────────

  describe('validateSQLiteMagic', () => {
    const SQLITE_MAGIC = Buffer.from('53514c69746520666f726d61742033', 'hex');

    test('returns true for a file with SQLite magic bytes', async () => {
      const readMock = jest.fn().mockImplementation((_buf: Buffer) => {
        SQLITE_MAGIC.copy(_buf);
        return Promise.resolve({ bytesRead: SQLITE_MAGIC.length });
      });
      const closeMock = jest.fn().mockResolvedValue(undefined);
      openMock.mockResolvedValue({ read: readMock, close: closeMock });

      const result = await validateSQLiteMagic('/tmp/test.sqlite');
      expect(result).toBe(true);
      expect(closeMock).toHaveBeenCalled();
    });

    test('returns false for a non-SQLite file', async () => {
      const readMock = jest.fn().mockImplementation((_buf: Buffer) => {
        Buffer.alloc(SQLITE_MAGIC.length).copy(_buf); // zeros
        return Promise.resolve({ bytesRead: SQLITE_MAGIC.length });
      });
      const closeMock = jest.fn().mockResolvedValue(undefined);
      openMock.mockResolvedValue({ read: readMock, close: closeMock });

      const result = await validateSQLiteMagic('/tmp/test.db');
      expect(result).toBe(false);
      expect(closeMock).toHaveBeenCalled();
    });

    test('closes file descriptor even when read throws', async () => {
      const readMock = jest.fn().mockRejectedValue(new Error('read error'));
      const closeMock = jest.fn().mockResolvedValue(undefined);
      openMock.mockResolvedValue({ read: readMock, close: closeMock });

      await expect(validateSQLiteMagic('/tmp/bad.db')).rejects.toThrow('read error');
      expect(closeMock).toHaveBeenCalled();
    });
  });

  // ── resolveEtlCommand ─────────────────────────────────────────────────────

  describe('resolveEtlCommand', () => {
    test('returns node runner when a compiled .js file exists', () => {
      existsSyncMock.mockImplementation((p: any) => typeof p === 'string' && p.endsWith('.js'));
      const result = resolveEtlCommand('sqlite-import', '--dry-run');
      expect(result.command).toBe('node');
      expect(result.args[0]).toContain('sqlite-import.js');
      expect(result.args[1]).toBe('--dry-run');
    });

    test('returns tsx runner when only the .ts source exists', () => {
      existsSyncMock.mockImplementation((p: any) => typeof p === 'string' && p.endsWith('.ts'));
      const result = resolveEtlCommand('kml-import');
      expect(result.command).toBe('tsx');
      expect(result.args[0]).toContain('kml-import.ts');
    });

    test('throws when script is not found at any candidate path', () => {
      existsSyncMock.mockReturnValue(false);
      expect(() => resolveEtlCommand('missing-script')).toThrow('missing-script script not found');
    });

    test('throws on invalid script base name (path traversal prevention)', () => {
      expect(() => resolveEtlCommand('../evil')).toThrow('Invalid script base name');
      expect(() => resolveEtlCommand('has spaces')).toThrow('Invalid script base name');
      expect(() => resolveEtlCommand('UPPER')).toThrow('Invalid script base name');
    });

    test('cmd and command fields are identical (both returned for compatibility)', () => {
      existsSyncMock.mockReturnValue(true);
      const result = resolveEtlCommand('sqlite-import');
      expect(result.cmd).toBe(result.command);
    });
  });

  // ── getImportCommand ──────────────────────────────────────────────────────

  describe('getImportCommand', () => {
    test('routes .kismet files to kismet-import', () => {
      existsSyncMock.mockReturnValue(true);
      const result = getImportCommand('/tmp/scan.kismet', 'tag', 'scan.kismet');
      expect(result.args[0]).toContain('kismet-import');
    });

    test('routes .sqlite files to sqlite-import', () => {
      existsSyncMock.mockReturnValue(true);
      const result = getImportCommand('/tmp/scan.sqlite', 'tag', 'scan.sqlite');
      expect(result.args[0]).toContain('sqlite-import');
    });

    test('routes .db files to sqlite-import', () => {
      existsSyncMock.mockReturnValue(true);
      const result = getImportCommand('/tmp/scan.db', 'tag', 'scan.db');
      expect(result.args[0]).toContain('sqlite-import');
    });

    test('passes sourceTag as second arg', () => {
      existsSyncMock.mockReturnValue(true);
      const result = getImportCommand('/tmp/scan.sqlite', 'mysource', 'scan.sqlite');
      expect(result.args[1]).toBe('/tmp/scan.sqlite');
      expect(result.args[2]).toBe('mysource');
    });
  });

  // ── getKmlImportCommand ───────────────────────────────────────────────────

  describe('getKmlImportCommand', () => {
    test('routes to kml-import script', () => {
      existsSyncMock.mockReturnValue(true);
      const result = getKmlImportCommand('/tmp/scan.kml', 'kml_tag');
      expect(result.args[0]).toContain('kml-import');
    });

    test('passes kml file path and source tag as args', () => {
      existsSyncMock.mockReturnValue(true);
      const result = getKmlImportCommand('/tmp/scan.kml', 'kml_tag');
      expect(result.args).toContain('/tmp/scan.kml');
      expect(result.args).toContain('kml_tag');
    });
  });

  // ── getSqlImportCommand ───────────────────────────────────────────────────

  describe('getSqlImportCommand', () => {
    test('returns psql as command', () => {
      const result = getSqlImportCommand('/tmp/migration.sql');
      expect(result.cmd).toBe('psql');
      expect(result.command).toBe('psql');
    });

    test('includes -f flag and sql file path', () => {
      const result = getSqlImportCommand('/tmp/migration.sql');
      expect(result.args).toContain('-f');
      expect(result.args).toContain('/tmp/migration.sql');
    });

    test('includes ON_ERROR_STOP=1', () => {
      const result = getSqlImportCommand('/tmp/migration.sql');
      expect(result.args).toContain('ON_ERROR_STOP=1');
    });

    test('sets PGPASSWORD in env', () => {
      const result = getSqlImportCommand('/tmp/migration.sql');
      expect(result.env).toBeDefined();
      expect(Object.prototype.hasOwnProperty.call(result.env, 'PGPASSWORD')).toBe(true);
    });

    test('uses DB env vars when set', () => {
      process.env.DB_HOST = 'testhost';
      process.env.DB_PORT = '5433';
      process.env.DB_NAME = 'testdb';
      const result = getSqlImportCommand('/tmp/migration.sql');
      expect(result.args).toContain('testhost');
      expect(result.args).toContain('5433');
      expect(result.args).toContain('testdb');
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      delete process.env.DB_NAME;
    });
  });

  // ── sanitizeRelativePath ──────────────────────────────────────────────────

  describe('sanitizeRelativePath', () => {
    test('strips leading ../ traversal', () => {
      const result = sanitizeRelativePath('../etc/passwd');
      expect(result).not.toContain('..');
    });

    test('strips multiple leading ../ segments', () => {
      const result = sanitizeRelativePath('../../etc/passwd');
      expect(result).not.toContain('..');
    });

    test('preserves safe relative paths', () => {
      const result = sanitizeRelativePath('folder/file.kml');
      expect(result).toContain('folder');
      expect(result).toContain('file.kml');
    });

    test('normalizes ./ segments', () => {
      const result = sanitizeRelativePath('folder/./file.kml');
      expect(result).not.toContain('./');
    });
  });

  // ── parseRelativePathsPayload ─────────────────────────────────────────────

  describe('parseRelativePathsPayload', () => {
    test('returns empty array on invalid JSON', () => {
      expect(parseRelativePathsPayload('not json')).toEqual([]);
    });

    test('returns empty array when JSON is not an array', () => {
      expect(parseRelativePathsPayload('{"key":"value"}')).toEqual([]);
    });

    test('sanitizes each path in a valid array', () => {
      const input = JSON.stringify(['../evil', 'safe/path.kml']);
      const result = parseRelativePathsPayload(input);
      expect(result.length).toBe(2);
      expect(result[0]).not.toContain('..');
      expect(result[1]).toContain('safe');
    });

    test('returns empty array for empty JSON array', () => {
      expect(parseRelativePathsPayload('[]')).toEqual([]);
    });
  });

  // ── getKmlImportHistoryContext ────────────────────────────────────────────

  describe('getKmlImportHistoryContext', () => {
    test('uses first file path when only one file uploaded', () => {
      const result = getKmlImportHistoryContext('scan.kml', [{}], ['/tmp/scan.kml']);
      expect(result.filename).toBe('/tmp/scan.kml');
    });

    test('shows (+N more) suffix for multiple files', () => {
      const result = getKmlImportHistoryContext(
        'batch.kml',
        [{}, {}, {}],
        ['/tmp/a.kml', '/tmp/b.kml', '/tmp/c.kml']
      );
      expect(result.filename).toContain('+2 more');
    });

    test('truncates sourceTag to 50 chars', () => {
      const longName = 'a'.repeat(100);
      const result = getKmlImportHistoryContext(longName, [], []);
      expect(result.sourceTag.length).toBeLessThanOrEqual(50);
    });

    test('sanitizes filename chars in sourceTag', () => {
      const result = getKmlImportHistoryContext('MY_SCAN-2026.kml', [], []);
      expect(result.sourceTag).toMatch(/^kml_[a-z0-9_]+$/);
    });

    test('falls back to batch.kml when no files', () => {
      const result = getKmlImportHistoryContext('', [], []);
      expect(result.filename).toBe('batch.kml');
    });
  });

  // ── parseKmlImportCounts ──────────────────────────────────────────────────

  describe('parseKmlImportCounts', () => {
    test('parses Files and Points from ETL output', () => {
      const output = 'Processing complete.\nFiles: 3\nPoints: 1,234\n';
      const result = parseKmlImportCounts(output, 0);
      expect(result.filesImported).toBe(3);
      expect(result.pointsImported).toBe(1234);
    });

    test('uses fallbackFileCount when Files line is absent', () => {
      const output = 'Points: 500\n';
      const result = parseKmlImportCounts(output, 7);
      expect(result.filesImported).toBe(7);
      expect(result.pointsImported).toBe(500);
    });

    test('returns 0 pointsImported when Points line is absent', () => {
      const output = 'Files: 2\n';
      const result = parseKmlImportCounts(output, 0);
      expect(result.filesImported).toBe(2);
      expect(result.pointsImported).toBe(0);
    });

    test('handles comma-separated numbers in Files count', () => {
      const output = 'Files: 1,000\nPoints: 50,000\n';
      const result = parseKmlImportCounts(output, 0);
      expect(result.filesImported).toBe(1000);
      expect(result.pointsImported).toBe(50000);
    });

    test('returns zeros when output is empty', () => {
      const result = parseKmlImportCounts('', 0);
      expect(result.filesImported).toBe(0);
      expect(result.pointsImported).toBe(0);
    });
  });
});
