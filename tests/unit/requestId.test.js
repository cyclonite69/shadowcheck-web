const requestIdMiddleware = require('../../src/middleware/requestId');

describe('Request ID Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = { setHeader: jest.fn() };
    next = jest.fn();
  });

  test('should generate request ID if not provided', () => {
    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe('string');
    expect(req.requestId.length).toBeGreaterThan(0);
    expect(next).toHaveBeenCalled();
  });

  test('should use existing request ID from header', () => {
    req.headers['x-request-id'] = 'existing-id-123';

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe('existing-id-123');
    expect(next).toHaveBeenCalled();
  });

  test('should set X-Request-ID response header', () => {
    requestIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.requestId);
  });

  test('should attach startTime to request', () => {
    const before = Date.now();
    requestIdMiddleware(req, res, next);
    const after = Date.now();

    expect(req.startTime).toBeDefined();
    expect(req.startTime).toBeGreaterThanOrEqual(before);
    expect(req.startTime).toBeLessThanOrEqual(after);
  });

  test('should generate unique IDs for different requests', () => {
    const req1 = { headers: {} };
    const req2 = { headers: {} };
    const res1 = { setHeader: jest.fn() };
    const res2 = { setHeader: jest.fn() };

    requestIdMiddleware(req1, res1, next);
    requestIdMiddleware(req2, res2, next);

    expect(req1.requestId).not.toBe(req2.requestId);
  });
});
