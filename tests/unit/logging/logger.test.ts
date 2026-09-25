export {};

// Mock winston to avoid file system side effects and capture log calls
const mockInfo = jest.fn();
const mockWarn = jest.fn();
const mockError = jest.fn();
const mockDebug = jest.fn();
const mockHttp = jest.fn();

jest.mock('winston', () => {
  const format = {
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    errors: jest.fn(() => ({})),
    splat: jest.fn(() => ({})),
    json: jest.fn(() => ({})),
    colorize: jest.fn(() => ({})),
    printf: jest.fn(() => ({})),
  };
  const Console = jest.fn().mockImplementation(() => ({}));
  const File = jest.fn().mockImplementation(() => ({}));

  const addColors = jest.fn();

  const createLogger = jest.fn().mockReturnValue({
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
    debug: mockDebug,
    http: mockHttp,
    on: jest.fn(),
  });

  return { format, transports: { Console, File }, addColors, createLogger };
});

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

jest.mock('path', () => jest.requireActual('path'));

describe('logger', () => {
  let logger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    // Re-mock after resetModules
    jest.mock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(true),
      mkdirSync: jest.fn(),
    }));
    jest.mock('winston', () => {
      const format = {
        combine: jest.fn(() => ({})),
        timestamp: jest.fn(() => ({})),
        errors: jest.fn(() => ({})),
        splat: jest.fn(() => ({})),
        json: jest.fn(() => ({})),
        colorize: jest.fn(() => ({})),
        printf: jest.fn((fn: any) => fn),
      };
      const Console = jest.fn().mockImplementation(() => ({}));
      const File = jest.fn().mockImplementation(() => ({}));
      const addColors = jest.fn();
      const createLogger = jest.fn().mockReturnValue({
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
        debug: mockDebug,
        http: mockHttp,
        on: jest.fn(),
      });
      return { format, transports: { Console, File }, addColors, createLogger };
    });
    logger = require('../../../server/src/logging/logger');
  });

  it('exports a logger object', () => {
    expect(logger).toBeDefined();
  });

  it('has a stream.write method for Morgan integration', () => {
    const loggerInstance = logger.default || logger;
    expect(loggerInstance.stream).toBeDefined();
    expect(typeof loggerInstance.stream.write).toBe('function');
  });

  it('stream.write delegates to logger.http (trimmed)', () => {
    const loggerInstance = logger.default || logger;
    loggerInstance.stream.write('GET /api/test 200  \n');
    expect(mockHttp).toHaveBeenCalledWith('GET /api/test 200');
  });

  it('logRequest emits an http log with method and path', () => {
    const loggerInstance = logger.default || logger;
    const req = {
      method: 'GET',
      path: '/api/v1/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('TestAgent/1.0'),
    };
    loggerInstance.logRequest(req);
    expect(mockHttp).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'GET /api/v1/test',
        method: 'GET',
        path: '/api/v1/test',
      })
    );
  });

  it('logResponse uses "warn" level for 4xx status', () => {
    const loggerInstance = logger.default || logger;
    const req = { method: 'GET', path: '/api/test', ip: '127.0.0.1' };
    loggerInstance.logResponse(req, 404, 12);
    expect(mockWarn).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('logResponse uses "info" level for 2xx status', () => {
    const loggerInstance = logger.default || logger;
    const req = { method: 'GET', path: '/api/test', ip: '127.0.0.1' };
    loggerInstance.logResponse(req, 200, 5);
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 200, durationMs: 5 })
    );
  });

  it('logQuery calls debug with truncated query', () => {
    const loggerInstance = logger.default || logger;
    loggerInstance.logQuery('SELECT * FROM networks WHERE id = $1', [42], 15);
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Database query',
        paramCount: 1,
        durationMs: 15,
      })
    );
  });

  it('logQuery truncates query to 200 chars', () => {
    const loggerInstance = logger.default || logger;
    const longQuery = `SELECT ${'x'.repeat(300)}`;
    loggerInstance.logQuery(longQuery, [], 0);
    const call = mockDebug.mock.calls[0][0];
    expect(call.query.length).toBeLessThanOrEqual(200);
  });

  it('logSecurityEvent calls warn with event name', () => {
    const loggerInstance = logger.default || logger;
    loggerInstance.logSecurityEvent('unauthorized-access', { ip: '1.2.3.4' });
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'unauthorized-access',
        ip: '1.2.3.4',
      })
    );
  });

  it('logPerformance calls info with metric and value', () => {
    const loggerInstance = logger.default || logger;
    loggerInstance.logPerformance('db-query-time', 42);
    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'db-query-time', value: 42, unit: 'ms' })
    );
  });

  it('logPerformance accepts custom unit', () => {
    const loggerInstance = logger.default || logger;
    loggerInstance.logPerformance('throughput', 100, 'rps');
    expect(mockInfo).toHaveBeenCalledWith(expect.objectContaining({ unit: 'rps' }));
  });

  it('createRequestLogger returns scoped logger with requestId in all calls', () => {
    const loggerInstance = logger.default || logger;
    const reqLogger = loggerInstance.createRequestLogger('req-abc-123');
    reqLogger.info('test message', { extra: 'data' });
    expect(mockInfo).toHaveBeenCalledWith('test message', {
      extra: 'data',
      requestId: 'req-abc-123',
    });
  });

  it('createRequestLogger supports all log levels', () => {
    const loggerInstance = logger.default || logger;
    const reqLogger = loggerInstance.createRequestLogger('req-xyz');
    reqLogger.debug('debug msg');
    reqLogger.warn('warn msg');
    reqLogger.error('error msg');
    reqLogger.http('http msg');
    expect(mockDebug).toHaveBeenCalledWith('debug msg', { requestId: 'req-xyz' });
    expect(mockWarn).toHaveBeenCalledWith('warn msg', { requestId: 'req-xyz' });
    expect(mockError).toHaveBeenCalledWith('error msg', { requestId: 'req-xyz' });
    expect(mockHttp).toHaveBeenCalledWith('http msg', { requestId: 'req-xyz' });
  });
});
