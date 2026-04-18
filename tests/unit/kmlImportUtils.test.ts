const fs = require('fs');
const os = require('os');
const path = require('path');

const { collectKmlFiles, deriveKmlSourceFile } = require('../../etl/load/kmlImportUtils');
const {
  sanitizeRelativePath,
  parseRelativePathsPayload,
  getKmlImportHistoryContext,
  parseKmlImportCounts,
} = require('../../server/src/services/admin/adminHelpers');

describe('KML import utilities', () => {
  describe('collectKmlFiles', () => {
    it('finds nested KML files recursively in sorted order', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kml-utils-'));

      try {
        fs.mkdirSync(path.join(tempDir, 'nested', 'deeper'), { recursive: true });
        fs.writeFileSync(path.join(tempDir, 'root.kml'), '<kml />');
        fs.writeFileSync(path.join(tempDir, 'nested', 'child.kml'), '<kml />');
        fs.writeFileSync(path.join(tempDir, 'nested', 'deeper', 'leaf.kml'), '<kml />');
        fs.writeFileSync(path.join(tempDir, 'ignore.txt'), 'skip');

        expect(collectKmlFiles(tempDir)).toEqual([
          path.join(tempDir, 'nested', 'child.kml'),
          path.join(tempDir, 'nested', 'deeper', 'leaf.kml'),
          path.join(tempDir, 'root.kml'),
        ]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('deriveKmlSourceFile', () => {
    it('uses a stable relative path for directory imports', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kml-source-dir-'));
      const nestedDir = path.join(tempDir, 'folder');
      const filePath = path.join(nestedDir, 'capture.kml');

      try {
        fs.mkdirSync(nestedDir, { recursive: true });
        fs.writeFileSync(filePath, '<kml />');
        expect(deriveKmlSourceFile(tempDir, filePath)).toBe('folder/capture.kml');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('uses the basename for direct file imports', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kml-source-file-'));
      const filePath = path.join(tempDir, 'capture.kml');

      try {
        fs.writeFileSync(filePath, '<kml />');
        expect(deriveKmlSourceFile(filePath, filePath)).toBe('capture.kml');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('route helpers', () => {
    it('sanitizes relative paths without stripping useful subdirectories', () => {
      expect(sanitizeRelativePath('../folder\\nested/./capture.kml')).toBe(
        'folder/nested/capture.kml'
      );
    });

    it('parses relative path payloads', () => {
      expect(parseRelativePathsPayload('["a.kml","nested/b.kml"]')).toEqual([
        'a.kml',
        'nested/b.kml',
      ]);
      expect(parseRelativePathsPayload(undefined)).toEqual([]);
      expect(() => parseRelativePathsPayload('{"bad":true}')).toThrow(
        'Invalid relative_paths payload'
      );
    });

    it('builds consistent KML history metadata', () => {
      expect(
        getKmlImportHistoryContext(
          'WiGLE',
          [{ originalname: 'capture.kml' }, { originalname: 'other.kml' }],
          ['folder/capture.kml', 'other.kml']
        )
      ).toEqual({
        sourceTag: 'kml_wigle',
        filename: 'folder/capture.kml (+1 more)',
      });
    });

    it('parses file and point counts from importer output', () => {
      expect(parseKmlImportCounts('Import complete\nFiles:  2\nPoints: 37\n', 5)).toEqual({
        filesImported: 2,
        pointsImported: 37,
      });
      expect(parseKmlImportCounts('Import complete\n', 5)).toEqual({
        filesImported: 5,
        pointsImported: 0,
      });
    });
  });
});
