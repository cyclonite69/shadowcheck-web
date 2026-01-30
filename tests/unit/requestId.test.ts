import requestIdMiddleware from '../../server/src/middleware/requestId';
import { Request, Response, NextFunction } from 'express';

interface MockRequest extends Partial<Request> {
  headers: Record<string, string>;
  requestId?: string;
  startTime?: number;
}

interface MockResponse extends Partial<Response> {
  setHeader: jest.MockedFunction<(name: string, value: string) => void>;
}

describe('Request ID Middleware', () => {
  let req: MockRequest;
  let res: MockResponse;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    req = { headers: {} };
    res = { setHeader: jest.fn() };
    next = jest.fn();
  });

  test('should generate request ID if not provided', () => {
    requestIdMiddleware(req as Request, res as Response, next);

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe('string');
    expect(req.requestId!.length).toBeGreaterThan(0);
    expect(next).toHaveBeenCalled();
  });

  test('should use existing request ID from header', () => {
    req.headers['x-request-id'] = 'existing-id-123';

    requestIdMiddleware(req as Request, res as Response, next);

    expect(req.requestId).toBe('existing-id-123');
    expect(next).toHaveBeenCalled();
  });

  test('should set X-Request-ID response header', () => {
    requestIdMiddleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.requestId);
  });

  test('should attach startTime to request', () => {
    const before = Date.now();
    requestIdMiddleware(req as Request, res as Response, next);
    const after = Date.now();

    expect(req.startTime).toBeDefined();
    expect(req.startTime!).toBeGreaterThanOrEqual(before);
    expect(req.startTime!).toBeLessThanOrEqual(after);
  });

  test('should generate unique IDs for different requests', () => {
    const req1: MockRequest = { headers: {} };
    const req2: MockRequest = { headers: {} };
    const res1: MockResponse = { setHeader: jest.fn() };
    const res2: MockResponse = { setHeader: jest.fn() };

    requestIdMiddleware(req1 as Request, res1 as Response, next);
    requestIdMiddleware(req2 as Request, res2 as Response, next);

    expect(req1.requestId).not.toBe(req2.requestId);
  });
});
