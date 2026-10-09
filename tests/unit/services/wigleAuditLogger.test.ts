import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.mock('winston', () => {
  const mLogger = {
    info: jest.fn(),
  };
  return {
    createLogger: jest.fn(() => mLogger),
    format: {
      json: jest.fn(),
      combine: jest.fn(),
      timestamp: jest.fn(),
      printf: jest.fn(),
    },
    transports: {
      File: jest.fn(),
      Console: jest.fn(),
    },
  };
});

describe('wigleAuditLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log audit events', () => {
    jest.isolateModules(() => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      const { logWigleAuditEvent } = require('../../../server/src/services/wigleAuditLogger');
      const winston = require('winston');
      const loggerMock = winston.createLogger.mock.results[0]?.value;

      if (!loggerMock) {
        throw new Error('Logger mock not initialized');
      }

      const payload = {
        entrypoint: 'test-entrypoint',
        endpointType: 'search',
        paramsHash: 'hash',
        status: 200,
        latencyMs: 123,
        servedFromCache: false,
        retryCount: 0,
        kind: 'search',
      };

      logWigleAuditEvent(payload);

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.objectContaining({
          ...payload,
          timestampIso: expect.any(String),
        })
      );
    });
  });

  it('should create <cwd>/logs if it does not exist and LOG_DIR is unset', () => {
    jest.isolateModules(() => {
      const originalLogDir = process.env.LOG_DIR;
      delete process.env.LOG_DIR;
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      try {
        require('../../../server/src/services/wigleAuditLogger');
        expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(process.cwd(), 'logs'), {
          recursive: true,
        });
      } finally {
        if (originalLogDir === undefined) {
          delete process.env.LOG_DIR;
        } else {
          process.env.LOG_DIR = originalLogDir;
        }
      }
    });
  });

  it('uses <cwd>/logs for the audit file when LOG_DIR is unset', () => {
    const originalLogDir = process.env.LOG_DIR;
    delete process.env.LOG_DIR;
    try {
      jest.isolateModules(() => {
        require('../../../server/src/services/wigleAuditLogger');
        const winston = require('winston');
        const expectedFilename = path.join(process.cwd(), 'logs/wigle-audit.log');
        const [fileOptions] = winston.transports.File.mock.calls.map(
          ([options]: [{ filename: string }]) => options
        );

        expect(fileOptions.filename).toBe(expectedFilename);
      });
    } finally {
      if (originalLogDir === undefined) {
        delete process.env.LOG_DIR;
      } else {
        process.env.LOG_DIR = originalLogDir;
      }
    }
  });

  it('uses LOG_DIR for the audit file when set', () => {
    const originalLogDir = process.env.LOG_DIR;
    process.env.LOG_DIR = '/tmp/shadowcheck-wigle-audit-test-logs';
    try {
      jest.isolateModules(() => {
        require('../../../server/src/services/wigleAuditLogger');
        const winston = require('winston');
        const [fileOptions] = winston.transports.File.mock.calls.map(
          ([options]: [{ filename: string }]) => options
        );

        expect(fileOptions.filename).toBe('/tmp/shadowcheck-wigle-audit-test-logs/wigle-audit.log');
      });
    } finally {
      if (originalLogDir === undefined) {
        delete process.env.LOG_DIR;
      } else {
        process.env.LOG_DIR = originalLogDir;
      }
    }
  });

  it('should NOT create logs directory if it exists', () => {
    jest.isolateModules(() => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      require('../../../server/src/services/wigleAuditLogger');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });
});
