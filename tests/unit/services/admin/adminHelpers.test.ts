import * as fs from 'fs';
import * as path from 'path';
import {
  upload,
  sqlUpload,
  kmlUpload,
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
} from '../../../../server/src/services/admin/adminHelpers';
import { query } from '../../../../server/src/config/database';
import logger from '../../../../server/src/logging/logger';

jest.mock('../../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../../server/src/logging/logger', () => ({
  warn: jest.fn(),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  promises: {
    open: jest.fn(),
  },
}));


describe('adminHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveEtlCommand', () => {
    it('should return node command if compiled script exists', () => {
      process.env.NODE_ENV = 'production';
      jest.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
        return typeof p === 'string' && p.endsWith('.js');
      });

      const result = resolveEtlCommand('test-script', 'arg1');
      expect(result.command).toBe('node');
      expect(result.args[0]).toContain('test-script.js');
    });

    it('should fallback to tsx if compiled script not found but tsx exists', () => {
      process.env.NODE_ENV = 'production';
      jest.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
        return typeof p === 'string' && p.endsWith('.ts');
      });

      const result = resolveEtlCommand('test-script', 'arg1');
      expect(result.command).toContain('tsx');
    });
  });

  describe('getSqlImportCommand', () => {
    it('should return SQL import command', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const result = getSqlImportCommand('test.sql', 'admin-tag');
      expect(result.command).toBe('node');
      expect(result.args[0]).toContain('sqlite-import.js');
    });
  });

  describe('sanitizeRelativePath', () => {
    it('should sanitize paths and remove dots', () => {
      const result = sanitizeRelativePath('../folder/nested/./capture.kml');
      expect(path.normalize(result.replace(/\\/g, '/'))).toBe(path.normalize('folder/nested/capture.kml'));
    });

    it('should handle empty or dot-only segments', () => {
      const result = sanitizeRelativePath('a/./b/../c');
      expect(path.normalize(result.replace(/\\/g, '/'))).toBe(path.normalize('a/c'));
    });
  });

  describe('getKmlImportHistoryContext', () => {
    it('should fallback to defaults', () => {
        const result = getKmlImportHistoryContext('', [], []);
        expect(result).toEqual({
            sourceTag: 'kml_',
            filename: 'batch.kml'
        });
    });
  });
});
