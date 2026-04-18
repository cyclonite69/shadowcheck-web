export {};

const path = require('path');
const fsNative = require('fs');

// Mock fs.promises
const fs = {
  promises: {
    open: jest.fn(),
    readFile: jest.fn(),
  },
  existsSync: jest.fn(),
};

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  promises: {
    open: jest.fn(),
  },
}));

jest.mock('multer', () => {
  const multer: any = jest.fn(() => ({
    any: jest.fn(),
    array: jest.fn(),
    fields: jest.fn(),
    none: jest.fn(),
    single: jest.fn(),
  }));
  multer.diskStorage = jest.fn();
  multer.memoryStorage = jest.fn();
  return multer;
});

jest.mock('../../../../server/src/config/container', () => ({
  secretsManager: {
    get: jest.fn(),
  },
}));

const {
  validateSQLiteMagic,
  resolveEtlCommand,
  getImportCommand,
  getKmlImportCommand,
  getSqlImportCommand,
  sanitizeRelativePath,
  parseRelativePathsPayload,
  getKmlImportHistoryContext,
  parseKmlImportCounts,
  buildContextMenuDemoHtml,
} = require('../../../../server/src/services/admin/adminHelpers');

const { secretsManager } = require('../../../../server/src/config/container');

describe('adminHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateSQLiteMagic', () => {
    it('should return true for valid SQLite file', async () => {
      const mockFd = {
        read: jest.fn().mockResolvedValue({ bytesRead: 15 }),
        close: jest.fn(),
      };
      (require('fs').promises.open as jest.Mock).mockResolvedValue(mockFd);

      // The magic string is Buffer.from('53514c69746520666f726d61742033', 'hex')
      // which is "SQLite format 3"
      const magicBuf = Buffer.from('53514c69746520666f726d61742033', 'hex');

      // We need to make buf.equals(SQLITE_MAGIC) return true
      // The implementation does:
      // const { bytesRead } = await fd.read(buf, 0, 15, 0);
      // return bytesRead === 15 && buf.equals(SQLITE_MAGIC);

      // We need to control the 'buf' passed to read.
      mockFd.read.mockImplementation((buf, offset, length, position) => {
        magicBuf.copy(buf);
        return Promise.resolve({ bytesRead: 15 });
      });

      const result = await validateSQLiteMagic('test.sqlite');
      expect(result).toBe(true);
      expect(mockFd.close).toHaveBeenCalled();
    });

    it('should return false for invalid bytesRead', async () => {
      const mockFd = {
        read: jest.fn().mockResolvedValue({ bytesRead: 10 }),
        close: jest.fn(),
      };
      (require('fs').promises.open as jest.Mock).mockResolvedValue(mockFd);

      const result = await validateSQLiteMagic('test.sqlite');
      expect(result).toBe(false);
    });

    it('should return false for invalid magic bytes', async () => {
      const mockFd = {
        read: jest.fn().mockImplementation((buf) => {
          Buffer.from('not sqlite').copy(buf);
          return Promise.resolve({ bytesRead: 15 });
        }),
        close: jest.fn(),
      };
      (require('fs').promises.open as jest.Mock).mockResolvedValue(mockFd);

      const result = await validateSQLiteMagic('test.sqlite');
      expect(result).toBe(false);
    });
  });

  describe('resolveEtlCommand', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should return tsx command in development if tsx and ts script exist', () => {
      process.env.NODE_ENV = 'development';
      (require('fs').existsSync as jest.Mock).mockImplementation((path) => {
        if (path.includes('node_modules/.bin/tsx')) return true;
        if (path.endsWith('.ts')) return true;
        return false;
      });

      const result = resolveEtlCommand('test-script', 'arg1');
      expect(result.cmd).toContain('tsx');
      expect(result.args[0]).toContain('test-script.ts');
    });

    it('should return node command if compiled script exists', () => {
      process.env.NODE_ENV = 'production';
      (require('fs').existsSync as jest.Mock).mockImplementation((path) => {
        if (path.endsWith('.js')) return true;
        return false;
      });

      const result = resolveEtlCommand('test-script', 'arg1');
      expect(result.cmd).toBe('node');
      expect(result.args[0]).toContain('test-script.js');
    });

    it('should throw error if no script found', () => {
      (require('fs').existsSync as jest.Mock).mockReturnValue(false);
      expect(() => resolveEtlCommand('missing')).toThrow('missing script not found');
    });

    it('should fallback to tsx if compiled script not found but tsx exists', () => {
      process.env.NODE_ENV = 'production';
      (require('fs').existsSync as jest.Mock).mockImplementation((path) => {
        if (path.includes('node_modules/.bin/tsx')) return true;
        if (path.endsWith('.ts')) return true;
        return false;
      });

      const result = resolveEtlCommand('test-script', 'arg1');
      expect(result.cmd).toContain('tsx');
    });
  });

  describe('getImportCommand', () => {
    it('should return kismet-import for .kismet files', () => {
      (require('fs').existsSync as jest.Mock).mockReturnValue(true);
      const result = getImportCommand('test.kismet', 'tag', 'test.kismet');
      expect(result.args[0]).toContain('kismet-import');
    });

    it('should return sqlite-import for .sqlite files', () => {
      (require('fs').existsSync as jest.Mock).mockReturnValue(true);
      const result = getImportCommand('test.sqlite', 'tag', 'test.sqlite');
      expect(result.args[0]).toContain('sqlite-import');
    });
  });

  describe('getKmlImportCommand', () => {
    it('should resolve kml-import script', () => {
      (require('fs').existsSync as jest.Mock).mockReturnValue(true);
      const result = getKmlImportCommand('path/to/kml', 'WiGLE');
      expect(result.args[0]).toContain('kml-import');
    });
  });

  describe('getSqlImportCommand', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use environment variables and secrets manager', () => {
      process.env.DB_HOST = 'test-host';
      process.env.DB_PORT = '9999';
      process.env.DB_NAME = 'test-db';
      process.env.DB_ADMIN_USER = 'test-admin';

      secretsManager.get.mockImplementation((key: string) => {
        if (key === 'db_admin_password') return 'admin-pass';
        return null;
      });

      const result = getSqlImportCommand('test.sql');
      expect(result.cmd).toBe('psql');
      expect(result.args).toContain('test-host');
      expect(result.args).toContain('9999');
      expect(result.args).toContain('test-db');
      expect(result.args).toContain('test-admin');
      expect(result.env.PGPASSWORD).toBe('admin-pass');
    });

    it('should use db_password if db_admin_password is not set', () => {
      secretsManager.get.mockImplementation((key: string) => {
        if (key === 'db_password') return 'user-pass';
        return null;
      });

      const result = getSqlImportCommand('test.sql');
      expect(result.env.PGPASSWORD).toBe('user-pass');
    });

    it('should use defaults if environment variables are not set', () => {
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      delete process.env.DB_NAME;
      delete process.env.DB_ADMIN_USER;
      secretsManager.get.mockReturnValue(null);

      const result = getSqlImportCommand('test.sql');
      expect(result.args).toContain('localhost');
      expect(result.args).toContain('5432');
      expect(result.args).toContain('shadowcheck_db');
      expect(result.args).toContain('shadowcheck_admin');
      expect(result.env.PGPASSWORD).toBe('');
    });
  });

  describe('sanitizeRelativePath', () => {
    it('should sanitize paths and remove dots', () => {
      expect(sanitizeRelativePath('../folder\\nested/./capture.kml')).toBe(
        'folder/nested/capture.kml'
      );
    });

    it('should handle empty or dot-only segments', () => {
      expect(sanitizeRelativePath('a/./b/../c')).toBe('a/b/c');
    });
  });

  describe('parseRelativePathsPayload', () => {
    it('should return empty array for non-string input', () => {
      expect(parseRelativePathsPayload(null)).toEqual([]);
      expect(parseRelativePathsPayload(123)).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(parseRelativePathsPayload('  ')).toEqual([]);
    });

    it('should parse valid JSON array', () => {
      expect(parseRelativePathsPayload('["a", "b"]')).toEqual(['a', 'b']);
    });

    it('should throw error for non-array JSON', () => {
      expect(() => parseRelativePathsPayload('{"a":1}')).toThrow('Invalid relative_paths payload');
    });

    it('should handle non-string elements in array by converting to string', () => {
      expect(parseRelativePathsPayload('[1, true, null]')).toEqual(['1', 'true', '']);
    });
  });

  describe('getKmlImportHistoryContext', () => {
    it('should handle multiple files and relative paths', () => {
      const result = getKmlImportHistoryContext(
        'WiGLE',
        [{ originalname: 'f1.kml' }, { originalname: 'f2.kml' }],
        ['rel/f1.kml', 'rel/f2.kml']
      );
      expect(result).toEqual({
        sourceTag: 'kml_wigle',
        filename: 'rel/f1.kml (+1 more)',
      });
    });

    it('should handle single file', () => {
      const result = getKmlImportHistoryContext(
        'Custom',
        [{ originalname: 'f1.kml' }],
        ['rel/f1.kml']
      );
      expect(result).toEqual({
        sourceTag: 'kml_custom',
        filename: 'rel/f1.kml',
      });
    });

    it('should sanitize sourceTag', () => {
      const result = getKmlImportHistoryContext('Special @ Type!', [], []);
      expect(result.sourceTag).toBe('kml_special___type_');
    });

    it('should fallback to defaults', () => {
      const result = getKmlImportHistoryContext('', [], []);
      expect(result).toEqual({
        sourceTag: 'kml_kml',
        filename: 'batch.kml',
      });
    });

    it('should handle single file in fallback path', () => {
      const result = getKmlImportHistoryContext('', [{ originalname: 'f1.kml' }], ['rel/f1.kml']);
      expect(result.filename).toBe('rel/f1.kml');
    });
  });

  describe('parseKmlImportCounts', () => {
    it('should parse counts from string', () => {
      const result = parseKmlImportCounts('Files: 1,234\nPoints: 5,678', 0);
      expect(result).toEqual({
        filesImported: 1234,
        pointsImported: 5678,
      });
    });

    it('should use fallback for files and 0 for points if not found', () => {
      const result = parseKmlImportCounts('no counts here', 10);
      expect(result).toEqual({
        filesImported: 10,
        pointsImported: 0,
      });
    });
  });

  describe('buildContextMenuDemoHtml', () => {
    it('should return a string containing HTML', () => {
      const html = buildContextMenuDemoHtml();
      expect(typeof html).toBe('string');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Right-Click Context Menu Test');
    });
  });
});
