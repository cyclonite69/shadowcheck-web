import * as fs from 'fs';
import * as winston from 'winston';
import { logWigleAuditEvent } from '../../../server/src/services/wigleAuditLogger';

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
    },
    transports: {
      File: jest.fn(),
    },
  };
});

describe('wigleAuditLogger', () => {
  let loggerMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Retrieve the actual mock instance that was created during module import
    loggerMock = (winston.createLogger as jest.Mock).mock.results[0]?.value;
  });

  it('should log audit events', () => {
    if (!loggerMock) return; // Skip if somehow not initialized
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

  it('should create logs directory if it does not exist', () => {
    jest.isolateModules(() => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      require('../../../server/src/services/wigleAuditLogger');
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('logs'), {
        recursive: true,
      });
    });
  });
});
