import request from 'supertest';
import express from 'express';
import { EventEmitter } from 'events';

jest.mock('../../server/src/config/container', () => ({
  secretsManager: {
    get: jest.fn(),
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
    backfillOrphanNetworkFromWigle: jest.fn(),
  },
  backupService: {
    runPostgresBackup: jest.fn(),
  },
}));

jest.mock('../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../server/src/services/backup/awsCli', () => ({
  runAwsCliJson: jest.fn(),
}));

jest.mock('child_process', () => {
  const { EventEmitter } = require('events');
  const mockChildProcessSpawn = new EventEmitter();
  mockChildProcessSpawn.stdout = new EventEmitter();
  mockChildProcessSpawn.stderr = new EventEmitter();
  return {
    spawn: jest.fn().mockReturnValue(mockChildProcessSpawn),
    __mockChildProcessSpawn: mockChildProcessSpawn,
  };
});

const { __mockChildProcessSpawn: mockChildProcessSpawn } = require('child_process');

jest.mock('../../server/src/services/admin/adminHelpers', () => {
  const multerMock = {
    single: () => (req: any, res: any, next: any) => {
      if (req.body.nofile) {
        req.file = undefined;
      } else {
        req.file = { path: 'test.db', originalname: req.body.isKismet ? 'test.kismet' : 'test.db' };
      }
      next();
    },
    array: () => (req: any, res: any, next: any) => {
      if (req.body.nofile) {
        req.files = [];
      } else {
        req.files = [{ path: 'test.kml', originalname: 'test.kml' }];
      }
      next();
    },
  };
  return {
    upload: multerMock,
    sqlUpload: multerMock,
    kmlUpload: multerMock,
    validateSQLiteMagic: jest.fn(() => Promise.resolve(true)),
    getImportCommand: jest.fn(() => ({ cmd: 'cmd', args: [] })),
    getKmlImportCommand: jest.fn(() => ({ cmd: 'cmd', args: [] })),
    getSqlImportCommand: jest.fn(() => ({ cmd: 'cmd', args: [], env: {} })),
    sanitizeRelativePath: jest.fn((p) => p),
    parseRelativePathsPayload: jest.fn(() => []),
    getKmlImportHistoryContext: jest.fn(() => ({ sourceTag: 'test', filename: 'test.kml' })),
    parseKmlImportCounts: jest.fn(() => ({ filesImported: 1, pointsImported: 10 })),
    PROJECT_ROOT: '/root',
  };
});

const {
  adminImportHistoryService,
  adminOrphanNetworksService,
  backupService,
} = require('../../server/src/config/container');
import fs from 'fs';
const { spawn } = require('child_process');
const {
  sanitizeRelativePath,
  parseRelativePathsPayload,
  getKmlImportHistoryContext,
  parseKmlImportCounts,
} = require('../../server/src/services/admin/adminHelpers');
const {
  validateSQLiteMagic,
  getImportCommand,
  getKmlImportCommand,
  getSqlImportCommand,
} = require('../../server/src/services/admin/adminHelpers');

const adminImportRouter = require('../../server/src/api/routes/v1/admin/import');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', adminImportRouter);
app.use((err: any, req: any, res: any, next: any) => {
  res.status(err.status || 500).json({ error: err.message });
});

describe('admin/import routes', () => {
  let fsUnlinkSpy: jest.SpyInstance;
  let fsRmSpy: jest.SpyInstance;
  let fsMkdtempSpy: jest.SpyInstance;
  let fsMkdirSpy: jest.SpyInstance;
  let fsRenameSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockChildProcessSpawn.removeAllListeners();
    mockChildProcessSpawn.stdout.removeAllListeners();
    mockChildProcessSpawn.stderr.removeAllListeners();
    (spawn as jest.Mock).mockReturnValue(mockChildProcessSpawn);

    fsUnlinkSpy = jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);
    fsRmSpy = jest.spyOn(fs.promises, 'rm').mockResolvedValue(undefined);
    fsMkdtempSpy = jest.spyOn(fs.promises, 'mkdtemp').mockResolvedValue('/tmp/test');
    fsMkdirSpy = jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
    fsRenameSpy = jest.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);

    (validateSQLiteMagic as jest.Mock).mockResolvedValue(true);
    (getImportCommand as jest.Mock).mockReturnValue({ cmd: 'cmd', args: [] });
    (getKmlImportCommand as jest.Mock).mockReturnValue({ cmd: 'cmd', args: [] });
    (getSqlImportCommand as jest.Mock).mockReturnValue({ cmd: 'cmd', args: [], env: {} });

    (sanitizeRelativePath as jest.Mock).mockImplementation((p: any) => p);
    (parseRelativePathsPayload as jest.Mock).mockReturnValue([]);
    (getKmlImportHistoryContext as jest.Mock).mockReturnValue({
      sourceTag: 'test',
      filename: 'test.kml',
    });
    (parseKmlImportCounts as jest.Mock).mockReturnValue({ filesImported: 1, pointsImported: 10 });

    adminImportHistoryService.createImportHistoryEntry.mockResolvedValue(1);
    adminImportHistoryService.captureImportMetrics.mockResolvedValue({});
  });

  afterEach(() => {
    fsUnlinkSpy.mockRestore();
    fsRmSpy.mockRestore();
    fsMkdtempSpy.mockRestore();
    fsMkdirSpy.mockRestore();
    fsRenameSpy.mockRestore();
  });

  describe('POST /api/admin/import-sqlite', () => {
    it('should reject if no file uploaded', async () => {
      const res = await request(app).post('/api/admin/import-sqlite').send({ nofile: true });
      expect(res.status).toBe(400);
    });

    it('should reject if not valid sqlite magic', async () => {
      (validateSQLiteMagic as jest.Mock).mockRejectedValue(new Error('Invalid'));
      const res = await request(app).post('/api/admin/import-sqlite').send({});
      expect(res.status).toBe(400);
    });

    it('should reject if no source_tag', async () => {
      const res = await request(app).post('/api/admin/import-sqlite').send({});
      expect(res.status).toBe(400);
    });

    it('should import sqlite successfully', async () => {
      (spawn as jest.Mock).mockImplementationOnce(() => {
        setTimeout(() => {
          mockChildProcessSpawn.stdout.emit('data', Buffer.from('Imported: 10\nFailed: 2\n'));
          mockChildProcessSpawn.emit('close', 0);
        }, 5);
        return mockChildProcessSpawn;
      });

      const res = await request(app).post('/api/admin/import-sqlite').send({ source_tag: 'test' });
      expect(res.status).toBe(200);
      expect(res.body.imported).toBe(10);
      expect(res.body.failed).toBe(2);
      expect(adminImportHistoryService.completeImportSuccess).toHaveBeenCalled();
    });

    it('should run backup if requested', async () => {
      (spawn as jest.Mock).mockImplementationOnce(() => {
        setTimeout(() => {
          mockChildProcessSpawn.emit('close', 0);
        }, 5);
        return mockChildProcessSpawn;
      });
      backupService.runPostgresBackup.mockResolvedValueOnce();

      const res = await request(app)
        .post('/api/admin/import-sqlite')
        .send({ source_tag: 'test', backup: true });
      expect(res.status).toBe(200);
      expect(backupService.runPostgresBackup).toHaveBeenCalled();
      expect(adminImportHistoryService.markImportBackupTaken).toHaveBeenCalledWith(1);
    });

    it('should handle backup failure gracefully', async () => {
      (spawn as jest.Mock).mockImplementationOnce(() => {
        setTimeout(() => {
          mockChildProcessSpawn.emit('close', 0);
        }, 5);
        return mockChildProcessSpawn;
      });
      backupService.runPostgresBackup.mockRejectedValueOnce(new Error('Backup err'));

      const res = await request(app)
        .post('/api/admin/import-sqlite')
        .send({ source_tag: 'test', backup: true });
      expect(res.status).toBe(200);
    });

    it('should handle import process error', async () => {
      (spawn as jest.Mock).mockImplementationOnce(() => {
        setTimeout(() => {
          mockChildProcessSpawn.emit('error', new Error('Spawn err'));
        }, 5);
        return mockChildProcessSpawn;
      });

      const res = await request(app).post('/api/admin/import-sqlite').send({ source_tag: 'test' });
      expect(res.status).toBe(500);
      expect(adminImportHistoryService.failImportHistory).toHaveBeenCalled();
    });

    it('should handle import non-zero exit', async () => {
      (spawn as jest.Mock).mockImplementationOnce(() => {
        setTimeout(() => {
          mockChildProcessSpawn.stderr.emit('data', Buffer.from('Command failed\n'));
          mockChildProcessSpawn.emit('close', 1);
        }, 5);
        return mockChildProcessSpawn;
      });

      const res = await request(app).post('/api/admin/import-sqlite').send({ source_tag: 'test' });
      expect(res.status).toBe(500);
      expect(adminImportHistoryService.failImportHistory).toHaveBeenCalled();
    });

    it('should handle kismet import successfully', async () => {
      (spawn as jest.Mock).mockImplementationOnce(() => {
        setTimeout(() => {
          mockChildProcessSpawn.emit('close', 0);
        }, 5);
        return mockChildProcessSpawn;
      });

      const res = await request(app)
        .post('/api/admin/import-sqlite')
        .send({ source_tag: 'test', isKismet: true });
      expect(res.status).toBe(200);
      expect(res.body.importType).toBe('kismet_sidecar');
      expect(res.body.imported).toBe(1);
    });
  });

  describe('POST /api/admin/import-sql', () => {
    it('should reject if no file', async () => {
      const res = await request(app).post('/api/admin/import-sql').send({ nofile: true });
      expect(res.status).toBe(400);
    });

    it('should run sql import successfully', async () => {
      (spawn as jest.Mock).mockImplementationOnce(() => {
        setTimeout(() => {
          mockChildProcessSpawn.stdout.emit('data', Buffer.from('SQL success\n'));
          mockChildProcessSpawn.emit('close', 0);
        }, 5);
        return mockChildProcessSpawn;
      });

      const res = await request(app).post('/api/admin/import-sql').send({ source_tag: 'test_sql' });
      expect(res.status).toBe(200);
      expect(adminImportHistoryService.completeImportSuccess).toHaveBeenCalled();
    });

    it('should run backup if requested', async () => {
      (spawn as jest.Mock).mockImplementationOnce(() => {
        setTimeout(() => {
          mockChildProcessSpawn.emit('close', 0);
        }, 5);
        return mockChildProcessSpawn;
      });
      backupService.runPostgresBackup.mockResolvedValueOnce();

      const res = await request(app).post('/api/admin/import-sql').send({ backup: true });
      expect(res.status).toBe(200);
      expect(backupService.runPostgresBackup).toHaveBeenCalled();
    });

    it('should handle sql import error', async () => {
      (spawn as jest.Mock).mockImplementationOnce(() => {
        setTimeout(() => {
          mockChildProcessSpawn.emit('error', new Error('SQL err'));
        }, 5);
        return mockChildProcessSpawn;
      });

      const res = await request(app).post('/api/admin/import-sql').send({});
      expect(res.status).toBe(500);
    });

    it('should handle sql non-zero exit', async () => {
      (spawn as jest.Mock).mockImplementationOnce(() => {
        setTimeout(() => {
          mockChildProcessSpawn.emit('close', 1);
        }, 5);
        return mockChildProcessSpawn;
      });

      const res = await request(app).post('/api/admin/import-sql').send({});
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/admin/import-history', () => {
    it('should return import history', async () => {
      adminImportHistoryService.getImportHistory.mockResolvedValueOnce([]);
      const res = await request(app).get('/api/admin/import-history');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/device-sources', () => {
    it('should return device sources', async () => {
      adminImportHistoryService.getDeviceSources.mockResolvedValueOnce([]);
      const res = await request(app).get('/api/admin/device-sources');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/orphan-networks', () => {
    it('should return orphan networks', async () => {
      adminOrphanNetworksService.listOrphanNetworks.mockResolvedValueOnce([]);
      adminOrphanNetworksService.getOrphanNetworkCounts.mockResolvedValueOnce({ total: 0 });
      const res = await request(app).get('/api/admin/orphan-networks');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/admin/orphan-networks/:bssid/check-wigle', () => {
    it('should run backfill', async () => {
      adminOrphanNetworksService.backfillOrphanNetworkFromWigle.mockResolvedValueOnce({ ok: true });
      const res = await request(app).post('/api/admin/orphan-networks/123/check-wigle');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/admin/import-kml', () => {
    it('should reject if no file', async () => {
      const res = await request(app).post('/api/admin/import-kml').send({ nofile: true });
      expect(res.status).toBe(400);
    });

    it('should reject if payload parsing fails', async () => {
      (parseRelativePathsPayload as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Bad json');
      });
      const res = await request(app).post('/api/admin/import-kml').send({ relative_paths: 'bad' });
      expect(res.status).toBe(400);
    });

    it('should run kml import successfully', async () => {
      (spawn as jest.Mock).mockImplementationOnce(() => {
        setTimeout(() => {
          mockChildProcessSpawn.emit('close', 0);
        }, 5);
        return mockChildProcessSpawn;
      });

      const res = await request(app).post('/api/admin/import-kml').send({});
      expect(res.status).toBe(200);
      expect(adminImportHistoryService.completeImportSuccess).toHaveBeenCalled();
    });

    it('should handle kml import failure', async () => {
      (spawn as jest.Mock).mockImplementationOnce(() => {
        setTimeout(() => {
          mockChildProcessSpawn.emit('close', 1);
        }, 5);
        return mockChildProcessSpawn;
      });

      const res = await request(app).post('/api/admin/import-kml').send({});
      expect(res.status).toBe(500);
      expect(adminImportHistoryService.failImportHistory).toHaveBeenCalled();
    });

    it('should handle process spawn error', async () => {
      (spawn as jest.Mock).mockImplementationOnce(() => {
        setTimeout(() => {
          mockChildProcessSpawn.emit('error', new Error('Spawn error'));
        }, 5);
        return mockChildProcessSpawn;
      });

      const res = await request(app).post('/api/admin/import-kml').send({});
      expect(res.status).toBe(500);
    });
  });
});
