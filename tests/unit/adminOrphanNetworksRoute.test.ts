export {};

jest.mock('../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../server/src/config/container', () => ({
  secretsManager: {
    get: jest.fn().mockReturnValue(''),
  },
  adminImportHistoryService: {
    captureImportMetrics: jest.fn(),
    createImportHistoryEntry: jest.fn(),
    markImportBackupTaken: jest.fn(),
    completeImportSuccess: jest.fn(),
    failImportHistory: jest.fn(),
    getImportHistory: jest.fn(),
    getDeviceSources: jest.fn(),
  },
  adminOrphanNetworksService: {
    listOrphanNetworks: jest.fn(),
    getOrphanNetworkCounts: jest.fn(),
  },
  backupService: {
    runPostgresBackup: jest.fn(),
  },
}));

jest.mock('../../server/src/api/routes/v1/admin/importHelpers', () => ({
  upload: {
    single: () => (_req: any, _res: any, next: any) => next(),
  },
  sqlUpload: {
    single: () => (_req: any, _res: any, next: any) => next(),
  },
  kmlUpload: {
    single: () => (_req: any, _res: any, next: any) => next(),
    array: () => (_req: any, _res: any, next: any) => next(),
  },
  validateSQLiteMagic: jest.fn(),
  getImportCommand: jest.fn(),
  getKmlImportCommand: jest.fn(),
  getSqlImportCommand: jest.fn(),
  PROJECT_ROOT: '/app',
}));

jest.mock('../../server/src/services/backup/awsCli', () => ({
  runAwsCliJson: jest.fn(),
}));

function createRes() {
  let resolveJson: (value: any) => void;
  const done = new Promise((resolve) => {
    resolveJson = resolve;
  });

  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      resolveJson(payload);
      return this;
    },
  };

  return { res, done };
}

function getOrphanNetworksHandler() {
  const router = require('../../server/src/api/routes/v1/admin/import');
  const layer = router.stack.find((entry: any) => entry.route?.path === '/admin/orphan-networks');
  if (!layer) {
    throw new Error('Could not find /admin/orphan-networks route');
  }
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe('admin/orphan-networks route', () => {
  let container: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    container = require('../../server/src/config/container');
  });

  test('returns orphan rows with total count', async () => {
    const handler = getOrphanNetworksHandler();
    const req: any = {
      query: {
        limit: '25',
        search: 'testnet',
      },
    };
    const { res, done } = createRes();

    container.adminOrphanNetworksService.listOrphanNetworks.mockResolvedValue([
      {
        bssid: 'AA:BB:CC:DD:EE:FF',
        ssid: 'TestNet',
        moved_at: '2026-04-05T07:00:00Z',
        move_reason: 'missing_observations',
      },
    ]);
    container.adminOrphanNetworksService.getOrphanNetworkCounts.mockResolvedValue({ total: 3203 });

    await handler(req, res, jest.fn());
    await done;

    expect(container.adminOrphanNetworksService.listOrphanNetworks).toHaveBeenCalledWith({
      search: 'testnet',
      limit: 25,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      total: 3203,
      rows: [
        {
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'TestNet',
          moved_at: '2026-04-05T07:00:00Z',
          move_reason: 'missing_observations',
        },
      ],
    });
  });
});
