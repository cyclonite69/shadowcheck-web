export {};

const mockPoolQuery = jest.fn();
const mockPoolConnect = jest.fn();
const mockPoolOn = jest.fn();
const mockPoolEnd = jest.fn();

jest.mock('pg', () => ({
  __esModule: true,
  Pool: jest.fn().mockImplementation(() => ({
    query: mockPoolQuery,
    connect: mockPoolConnect,
    on: mockPoolOn,
    end: mockPoolEnd,
  })),
  default: {
    Pool: jest.fn().mockImplementation(() => ({
      query: mockPoolQuery,
      connect: mockPoolConnect,
      on: mockPoolOn,
      end: mockPoolEnd,
    })),
  },
}));

const mockLoggerError = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerInfo = jest.fn();

jest.mock('../../../server/src/config/loadEnv', () => ({}));

jest.mock('../../../server/src/logging/logger', () => ({
  error: mockLoggerError,
  warn: mockLoggerWarn,
  info: mockLoggerInfo,
  default: { error: mockLoggerError, warn: mockLoggerWarn, info: mockLoggerInfo },
}));

const mockSecretsGet = jest.fn();
jest.mock('../../../server/src/services/secretsManager', () => ({
  get: mockSecretsGet,
  default: { get: mockSecretsGet },
}));

function getMockPoolCtor(): jest.Mock {
  return require('pg').Pool as jest.Mock;
}

// Each test uses resetModules to get a fresh module with a clean pool singleton.
function loadFresh() {
  jest.resetModules();
  return require('../../../server/src/services/adminDbService');
}

beforeEach(() => {
  jest.clearAllMocks();
  getMockPoolCtor().mockClear();
});

describe('adminDbService — getAdminPool', () => {
  test('creates pool when DB_ADMIN_PASSWORD env var is set', () => {
    process.env.DB_ADMIN_PASSWORD = 'test-admin-pass';
    process.env.DB_HOST = 'localhost';
    mockSecretsGet.mockReturnValue(null);

    const { getAdminPool } = loadFresh();
    const pool = getAdminPool();

    expect(pool).not.toBeNull();
    expect(getMockPoolCtor()).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'test-admin-pass' })
    );
    delete process.env.DB_ADMIN_PASSWORD;
  });

  test('uses secretsManager value when env var not set', () => {
    delete process.env.DB_ADMIN_PASSWORD;
    process.env.DB_HOST = 'localhost';
    mockSecretsGet.mockReturnValue('sm-admin-pass');

    const { getAdminPool } = loadFresh();
    const pool = getAdminPool();

    expect(pool).not.toBeNull();
    expect(getMockPoolCtor()).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'sm-admin-pass' })
    );
  });

  test('returns null and logs error when no password and not local compose', () => {
    delete process.env.DB_ADMIN_PASSWORD;
    process.env.DB_HOST = 'remote-host.example.com';
    mockSecretsGet.mockReturnValue(null);

    const logger = require('../../../server/src/logging/logger');
    const { getAdminPool } = loadFresh();
    const pool = getAdminPool();

    expect(pool).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('db_admin_password not available')
    );
    delete process.env.DB_HOST;
  });

  test('allows passwordless connection when host=postgres and no SSL', () => {
    delete process.env.DB_ADMIN_PASSWORD;
    process.env.DB_HOST = 'postgres';
    process.env.DB_SSL = 'false';
    mockSecretsGet.mockReturnValue(null);

    const logger = require('../../../server/src/logging/logger');
    const { getAdminPool } = loadFresh();
    const pool = getAdminPool();

    expect(pool).not.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('passwordless local admin'));
    delete process.env.DB_HOST;
    delete process.env.DB_SSL;
  });

  test('returns cached pool on second call (no re-init)', () => {
    process.env.DB_ADMIN_PASSWORD = 'test-pass';
    mockSecretsGet.mockReturnValue(null);

    const { getAdminPool } = loadFresh();
    const pool1 = getAdminPool();
    const pool2 = getAdminPool();

    expect(pool1).toBe(pool2);
    expect(getMockPoolCtor()).toHaveBeenCalledTimes(1);
    delete process.env.DB_ADMIN_PASSWORD;
  });
});

describe('adminDbService — adminQuery', () => {
  test('throws when pool is null (no password configured)', async () => {
    delete process.env.DB_ADMIN_PASSWORD;
    process.env.DB_HOST = 'remote-host.example.com';
    mockSecretsGet.mockReturnValue(null);

    const { adminQuery } = loadFresh();
    await expect(adminQuery('SELECT 1')).rejects.toThrow('Admin database pool not initialized');
    delete process.env.DB_HOST;
  });

  test('executes query when pool is available', async () => {
    process.env.DB_ADMIN_PASSWORD = 'test-pass';
    mockSecretsGet.mockReturnValue(null);
    mockPoolQuery.mockResolvedValue({ rows: [{ result: 1 }] });

    const { adminQuery } = loadFresh();
    const result = await adminQuery('SELECT 1', []);

    expect(mockPoolQuery).toHaveBeenCalledWith('SELECT 1', []);
    expect(result.rows).toEqual([{ result: 1 }]);
    delete process.env.DB_ADMIN_PASSWORD;
  });

  test.each([
    ['TRUNCATE app.observations', 'TRUNCATE'],
    ['  \nTruncate app.observations', 'TRUNCATE'],
    ['DROP TABLE app.observations', 'DROP'],
    ['DELETE FROM app.observations', 'DELETE'],
  ])('blocks %s against a non-test database', async (sql) => {
    process.env.DB_ADMIN_PASSWORD = 'test-pass';
    process.env.DB_NAME = 'shadowcheck_db';
    delete process.env.PGDATABASE;
    delete process.env.ALLOW_UNSAFE_DATA_RESET;

    const { adminQuery } = loadFresh();
    await expect(adminQuery(sql)).rejects.toThrow('Refusing destructive SQL');
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  test.each([
    'TRUNCATE app.observations',
    'DROP TABLE app.observations',
    'DELETE FROM app.observations',
  ])('allows %s against a test database', async (sql) => {
    process.env.DB_ADMIN_PASSWORD = 'test-pass';
    process.env.DB_NAME = 'shadowcheck_test';
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const { adminQuery } = loadFresh();
    await expect(adminQuery(sql)).resolves.toEqual({ rows: [] });
  });

  test('allows destructive SQL with the explicit override', async () => {
    process.env.DB_ADMIN_PASSWORD = 'test-pass';
    process.env.DB_NAME = 'shadowcheck_db';
    process.env.ALLOW_UNSAFE_DATA_RESET = 'true';
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const { adminQuery } = loadFresh();
    await expect(adminQuery('DROP TABLE app.observations')).resolves.toEqual({ rows: [] });
  });

  test('allows conditional DELETE against a non-test database', async () => {
    process.env.DB_ADMIN_PASSWORD = 'test-pass';
    process.env.DB_NAME = 'shadowcheck_db';
    mockPoolQuery.mockResolvedValue({ rows: [] });

    const { adminQuery } = loadFresh();
    await expect(
      adminQuery('DELETE FROM app.observations WHERE bssid = $1', ['test'])
    ).resolves.toEqual({
      rows: [],
    });
  });

  test('guards queries issued through a connected client', async () => {
    process.env.DB_ADMIN_PASSWORD = 'test-pass';
    process.env.DB_NAME = 'shadowcheck_db';
    delete process.env.ALLOW_UNSAFE_DATA_RESET;
    const clientQuery = jest.fn().mockResolvedValue({ rows: [] });
    mockPoolConnect.mockResolvedValue({ query: clientQuery, release: jest.fn() });

    const { getAdminPool } = loadFresh();
    const client = await getAdminPool()!.connect();

    expect(() => client.query('TRUNCATE app.observations')).toThrow('Refusing destructive SQL');
    await expect(
      client.query('DELETE FROM app.observations WHERE bssid = $1', ['test'])
    ).resolves.toEqual({
      rows: [],
    });
    expect(clientQuery).toHaveBeenCalledWith('DELETE FROM app.observations WHERE bssid = $1', [
      'test',
    ]);
  });

  test('preserves the callback connect contract and release callback', async () => {
    process.env.DB_ADMIN_PASSWORD = 'test-pass';
    const clientQuery = jest.fn();
    const release = jest.fn();
    const client = { query: clientQuery };
    mockPoolConnect.mockImplementationOnce((callback) => {
      callback(undefined, client, release);
      return undefined;
    });

    const { getAdminPool } = loadFresh();
    const callback = jest.fn();
    getAdminPool()!.connect(callback);

    expect(callback).toHaveBeenCalledWith(undefined, client, release);
    expect(client.query).not.toBe(clientQuery);
    expect(typeof client.query).toBe('function');
  });
});

describe('adminDbService — closeAdminPool', () => {
  test('calls pool.end() when pool exists', async () => {
    process.env.DB_ADMIN_PASSWORD = 'test-pass';
    mockSecretsGet.mockReturnValue(null);
    mockPoolEnd.mockResolvedValue(undefined);

    const { getAdminPool, closeAdminPool } = loadFresh();
    getAdminPool();
    await closeAdminPool();

    expect(mockPoolEnd).toHaveBeenCalled();
    delete process.env.DB_ADMIN_PASSWORD;
  });

  test('is a no-op when pool was never initialized', async () => {
    delete process.env.DB_ADMIN_PASSWORD;
    process.env.DB_HOST = 'remote-host.example.com';
    mockSecretsGet.mockReturnValue(null);

    const { closeAdminPool } = loadFresh();
    await expect(closeAdminPool()).resolves.toBeUndefined();
    expect(mockPoolEnd).not.toHaveBeenCalled();
    delete process.env.DB_HOST;
  });
});
