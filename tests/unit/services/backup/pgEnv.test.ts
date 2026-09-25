import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { buildPgEnv, buildBackupPgEnv } from '../../../../server/src/services/backup/pgEnv';
import secretsManager from '../../../../server/src/services/secretsManager';
import logger from '../../../../server/src/logging/logger';

jest.mock('../../../../server/src/services/secretsManager', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
  get: jest.fn(),
}));

jest.mock('../../../../server/src/logging/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('pgEnv Service', () => {
  const originalEnv = { ...process.env };
  const mockSecretsManager = secretsManager as any;
  const mockLogger = logger as any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Completely clean out all database and PG environment variables to prevent host bleed
    const envKeys = [
      'PGHOST',
      'PGPORT',
      'PGUSER',
      'PGDATABASE',
      'PGPASSWORD',
      'DB_HOST',
      'DB_PORT',
      'DB_USER',
      'DB_NAME',
      'DB_ADMIN_USER',
      'DB_ADMIN_PASSWORD',
      'DB_SSL',
    ];
    for (const key of envKeys) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('buildPgEnv()', () => {
    it('maps DB env variables to PG equivalents', () => {
      process.env.DB_HOST = 'db-host-1';
      process.env.DB_PORT = '9999';
      process.env.DB_USER = 'db-user-1';
      process.env.DB_NAME = 'db-name-1';

      const env = buildPgEnv();
      expect(env.PGHOST).toBe('db-host-1');
      expect(env.PGPORT).toBe('9999');
      expect(env.PGUSER).toBe('db-user-1');
      expect(env.PGDATABASE).toBe('db-name-1');
    });

    it('falls back to secretsManager db_password if PGPASSWORD is not configured', () => {
      mockSecretsManager.get.mockReturnValueOnce('secret-db-pass');

      const env = buildPgEnv();
      expect(env.PGPASSWORD).toBe('secret-db-pass');
    });
  });

  describe('buildBackupPgEnv()', () => {
    it('uses preferred admin DB user and db_admin_password if available', () => {
      process.env.DB_ADMIN_USER = 'admin-user-override';
      mockSecretsManager.get.mockImplementation((key: string) => {
        if (key === 'db_admin_password') {
          return 'secret-admin-pass';
        }
        return null;
      });

      const env = buildBackupPgEnv();
      expect(env.PGUSER).toBe('admin-user-override');
      expect(env.PGPASSWORD).toBe('secret-admin-pass');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Using admin DB role'));
    });

    it('allows passwordless local admin if no password but on compose local setup', () => {
      mockSecretsManager.get.mockReturnValue(null);
      process.env.DB_HOST = 'postgres';
      process.env.DB_SSL = 'false';

      const env = buildBackupPgEnv();
      expect(env.PGUSER).toBe('shadowcheck_admin');
      expect(env.PGPASSWORD).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('using passwordless local admin')
      );
    });

    it('warns and falls back to application DB credentials otherwise', () => {
      mockSecretsManager.get.mockReturnValue(null);
      process.env.DB_HOST = 'remote-db';
      process.env.DB_SSL = 'true';

      buildBackupPgEnv();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('falling back to application DB credentials')
      );
    });
  });
});
