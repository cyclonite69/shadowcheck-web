import { registerShutdownHandlers } from '../../../server/src/utils/shutdownHandlers';

jest.mock('../../../server/src/services/backgroundJobsService', () => ({
  shutdown: jest.fn()
}));

jest.mock('../../../server/src/websocket/ssmTerminal', () => ({
  shutdownSsmWebSocket: jest.fn().mockResolvedValue(undefined)
}));

describe('shutdownHandlers', () => {
  let exitSpy: jest.SpyInstance;
  let mockLogger: any;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Match the actual process.exit signature
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => { 
      return undefined as never; 
    });
    mockLogger = { info: jest.fn(), error: jest.fn() };
    mockPool = { end: jest.fn().mockResolvedValue(undefined) };
    
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
  });

  afterEach(() => {
    exitSpy.mockRestore();
    jest.useRealTimers();
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
  });

  it('should register handlers and handle SIGTERM/SIGINT', () => {
    registerShutdownHandlers({ logger: mockLogger, pool: mockPool });

    expect(process.listenerCount('SIGTERM')).toBeGreaterThan(0);
    expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
  });

  it('should shut down gracefully on SIGTERM', async () => {
    registerShutdownHandlers({ logger: mockLogger, pool: mockPool });
    const termHandler = process.listeners('SIGTERM')[process.listeners('SIGTERM').length - 1] as any;
    
    await termHandler();

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('SIGTERM received'));
    expect(mockPool.end).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should handle database pool shutdown timeout', async () => {
    mockPool.end.mockReturnValue(new Promise(() => {})); // Never resolves

    registerShutdownHandlers({ logger: mockLogger, pool: mockPool });
    const termHandler = process.listeners('SIGTERM')[process.listeners('SIGTERM').length - 1] as any;
    
    const shutdownPromise = termHandler();
    
    // Fast-forward timers to trigger the timeout
    // We need to run pending timers multiple times to clear the promise queue
    for(let i=0; i<10; i++) {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
    }
    
    await shutdownPromise;

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Database pool shutdown timed out'));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
