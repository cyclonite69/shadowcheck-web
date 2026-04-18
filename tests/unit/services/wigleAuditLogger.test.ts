import * as fs from 'fs';
import * as winston from 'winston';

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

  it('should create logs directory if it does not exist', () => {
    jest.isolateModules(() => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      require('../../../server/src/services/wigleAuditLogger');
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('logs'), {
        recursive: true,
      });
    });
  });

  it('should NOT create logs directory if it exists', () => {
    jest.isolateModules(() => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      require('../../../server/src/services/wigleAuditLogger');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });
});
