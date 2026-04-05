export {};

const { EventEmitter } = require('events');

jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn().mockResolvedValue(undefined),
    rm: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

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

function getSQLiteImportHandler() {
  const router = require('../../server/src/api/routes/v1/admin/import');
  const layer = router.stack.find((entry: any) => entry.route?.path === '/admin/import-sqlite');
  if (!layer) {
    throw new Error('Could not find /admin/import-sqlite route');
  }
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function makeProcess({
  code,
  stdout = '',
  stderr = '',
}: {
  code: number;
  stdout?: string;
  stderr?: string;
}) {
  const proc: any = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();

  setImmediate(() => {
    if (stdout) {
      proc.stdout.emit('data', Buffer.from(stdout));
    }
    if (stderr) {
      proc.stderr.emit('data', Buffer.from(stderr));
    }
    proc.emit('close', code);
  });

  return proc;
}

describe('admin/import-sqlite route', () => {
  let spawn: jest.Mock;
  let importHelpers: any;
  let container: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    spawn = require('child_process').spawn;
    importHelpers = require('../../server/src/api/routes/v1/admin/importHelpers');
    container = require('../../server/src/config/container');

    container.adminImportHistoryService.captureImportMetrics
      .mockResolvedValueOnce({ observations: 619561, networks: 188912 })
      .mockResolvedValueOnce({ observations: 629350, networks: 187854 });
    container.adminImportHistoryService.createImportHistoryEntry.mockResolvedValue(42);
    importHelpers.validateSQLiteMagic.mockResolvedValue(true);
    importHelpers.getImportCommand.mockReturnValue({ cmd: 'node', args: ['/fake/import.js'] });
  });

  test('continues import when pre-import backup fails and reports backupTaken=false', async () => {
    const handler = getSQLiteImportHandler();
    const req: any = {
      file: { path: '/tmp/fake.sqlite', originalname: 'backup-1775315643964.sqlite' },
      body: { source_tag: 's22_backup', backup: 'true' },
    };
    const { res, done } = createRes();

    container.backupService.runPostgresBackup.mockRejectedValue(
      new Error('pg_dump failed: version mismatch')
    );
    spawn.mockReturnValue(
      makeProcess({
        code: 0,
        stdout: 'Imported: 9,789\nFailed: 0\n',
      })
    );

    await handler(req, res, jest.fn());
    await done;

    expect(container.backupService.runPostgresBackup).toHaveBeenCalledWith({ uploadToS3: true });
    expect(container.adminImportHistoryService.markImportBackupTaken).not.toHaveBeenCalled();
    expect(container.adminImportHistoryService.completeImportSuccess).toHaveBeenCalledWith(
      42,
      9789,
      0,
      expect.any(String),
      { observations: 629350, networks: 187854 }
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.backupTaken).toBe(false);
    expect(res.body.imported).toBe(9789);
    expect(res.body.failed).toBe(0);
  });

  test('records failure when the import process exits non-zero', async () => {
    const handler = getSQLiteImportHandler();
    const req: any = {
      file: { path: '/tmp/fake.sqlite', originalname: 'backup-1775315643964.sqlite' },
      body: { source_tag: 's22_backup', backup: 'false' },
    };
    const { res, done } = createRes();

    container.backupService.runPostgresBackup.mockResolvedValue(undefined);
    spawn.mockReturnValue(
      makeProcess({
        code: 1,
        stderr: 'permission denied for schema app',
      })
    );

    await handler(req, res, jest.fn());
    await done;

    expect(container.adminImportHistoryService.failImportHistory).toHaveBeenCalledWith(
      42,
      expect.stringContaining('permission denied for schema app'),
      expect.any(String)
    );
    expect(res.statusCode).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('Import script failed');
  });
});
