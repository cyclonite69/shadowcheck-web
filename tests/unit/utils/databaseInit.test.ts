import { initializeDatabase } from '../../../server/src/core/initialization/databaseInit';

describe('databaseInit', () => {
  let mockPool: any;
  let mockClient: any;
  let mockLogger: any;
  let mockTestConnection: jest.Mock;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool = {
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(mockClient),
    };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    mockTestConnection = jest.fn().mockResolvedValue(undefined);
  });

  it('should initialize database successfully when MV is already populated', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [{ '1': 1 }] });

    await initializeDatabase({
      pool: mockPool,
      testConnection: mockTestConnection,
      logger: mockLogger,
    });

    expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockTestConnection).toHaveBeenCalled();
    expect(mockPool.connect).toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT 1 FROM app.api_network_explorer_mv LIMIT 1'
    );
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should refresh MV if it has not been populated (code 55000)', async () => {
    const error = new Error('has not been populated');
    (error as any).code = '55000';
    mockClient.query.mockRejectedValueOnce(error);
    mockClient.query.mockResolvedValueOnce({}); // REFRESH SUCCESS

    await initializeDatabase({
      pool: mockPool,
      testConnection: mockTestConnection,
      logger: mockLogger,
    });

    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT 1 FROM app.api_network_explorer_mv LIMIT 1'
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW app.api_network_explorer_mv'
    );
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Auto-refreshing...'));
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('populated successfully'));
  });

  it('should warn if MV does not exist (code 42P01)', async () => {
    const error = new Error('relation does not exist');
    (error as any).code = '42P01';
    mockClient.query.mockRejectedValueOnce(error);

    await initializeDatabase({
      pool: mockPool,
      testConnection: mockTestConnection,
      logger: mockLogger,
    });

    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('does not exist yet'));
  });

  it('should log error if MV refresh fails with unknown error', async () => {
    const error = new Error('Unknown DB error');
    mockClient.query.mockRejectedValueOnce(error);

    await initializeDatabase({
      pool: mockPool,
      testConnection: mockTestConnection,
      logger: mockLogger,
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error during auto-refresh'),
      expect.objectContaining({ error })
    );
  });

  it('should call logger.debug when pool connects', async () => {
    await initializeDatabase({
      pool: mockPool,
      testConnection: mockTestConnection,
      logger: mockLogger,
    });

    const connectHandler = mockPool.on.mock.calls.find((call: any) => call[0] === 'connect')[1];
    connectHandler({ host: 'localhost', port: 5432 });

    expect(mockLogger.debug).toHaveBeenCalledWith('Pool connected: localhost:5432');
  });
});
