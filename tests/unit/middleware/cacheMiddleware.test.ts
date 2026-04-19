import { Request, Response, NextFunction } from 'express';
import { cacheMiddleware } from '../../../server/src/middleware/cacheMiddleware';

describe('cacheMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  const cacheService = {
    isEnabled: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(() => {
    req = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      app: { locals: { cacheService } } as any,
      method: 'GET',
      path: '/test',
      query: {},
    };
    res = {
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    (cacheService.isEnabled as jest.Mock).mockReturnValue(true);
  });

  it('should call next() if request method is not GET', async () => {
    req.method = 'POST';
    const middleware = cacheMiddleware();
    await middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should call next() if cache service is disabled', async () => {
    (cacheService.isEnabled as jest.Mock).mockReturnValue(false);
    const middleware = cacheMiddleware();
    await middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should return cached data if found', async () => {
    const cachedData = { foo: 'bar' };
    (cacheService.get as jest.Mock).mockResolvedValue(cachedData);

    const middleware = cacheMiddleware();
    await middleware(req as Request, res as Response, next);

    expect(res.json).toHaveBeenCalledWith(cachedData);
  });

  it('should call next() and setup caching if no cache found', async () => {
    (cacheService.get as jest.Mock).mockResolvedValue(null);
    const middleware = cacheMiddleware();

    const originalJson = res.json;
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.json).not.toBe(originalJson); // Should be wrapped
  });
});
