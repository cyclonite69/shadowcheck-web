const {
  resolveBackupScope,
  parseBackupSchemas,
} = require('../../server/src/services/backup/backupUtils');

describe('backup utilities', () => {
  describe('parseBackupSchemas', () => {
    it('parses a comma-separated schema list', () => {
      expect(parseBackupSchemas(' app, public ,import ,, ')).toEqual(['app', 'public', 'import']);
    });
  });

  describe('resolveBackupScope', () => {
    it('defaults to a full database backup when no scope is configured', () => {
      expect(resolveBackupScope({})).toEqual({
        mode: 'full_database',
        schemas: [],
        explicit: false,
      });
    });

    it('uses schema subset mode when schemas are explicitly configured', () => {
      expect(resolveBackupScope({ BACKUP_SCHEMAS: 'app,public' })).toEqual({
        mode: 'schema_subset',
        schemas: ['app', 'public'],
        explicit: true,
      });
    });

    it('honors explicit full-database configuration', () => {
      expect(
        resolveBackupScope({
          BACKUP_INCLUDE_ALL_SCHEMAS: 'true',
          BACKUP_SCHEMAS: 'app,public',
        })
      ).toEqual({
        mode: 'full_database',
        schemas: [],
        explicit: true,
      });
    });

    it('honors explicit schema restriction configuration', () => {
      expect(
        resolveBackupScope({
          BACKUP_INCLUDE_ALL_SCHEMAS: 'false',
          BACKUP_SCHEMAS: 'app,public',
        })
      ).toEqual({
        mode: 'schema_subset',
        schemas: ['app', 'public'],
        explicit: true,
      });
    });
  });
});
