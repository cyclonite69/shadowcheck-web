export {};

import type { Request, Response, NextFunction } from 'express';
const { asyncHandler } = require('../../server/src/utils/asyncHandler');

const mockReq = {} as Request;
const mockRes = {} as Response;

describe('asyncHandler', () => {
  test('calls the wrapped handler with req, res, next', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const handler = asyncHandler(fn);

    const next = jest.fn();
    handler(mockReq, mockRes, next);

    await Promise.resolve(); // flush microtask queue
    expect(fn).toHaveBeenCalledWith(mockReq, mockRes, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next with the error when the handler rejects', async () => {
    const err = new Error('boom');
    const fn = jest.fn().mockRejectedValue(err);
    const handler = asyncHandler(fn);

    const next = jest.fn() as NextFunction;
    handler(mockReq, mockRes, next);

    await new Promise((r) => setTimeout(r, 0)); // flush rejection
    expect(next).toHaveBeenCalledWith(err);
  });

  test('synchronous throws propagate uncaught (not forwarded to next)', async () => {
    // asyncHandler wraps fn in Promise.resolve(fn(...)), so a synchronous throw
    // inside fn escapes before Promise.resolve can catch it. This is expected
    // behavior — route handlers should return rejected promises, not throw sync.
    const err = new Error('sync throw');
    const fn = jest.fn().mockImplementation(() => {
      throw err;
    });
    const handler = asyncHandler(fn);
    const next = jest.fn() as NextFunction;

    expect(() => handler(mockReq, mockRes, next)).toThrow('sync throw');
    expect(next).not.toHaveBeenCalled();
  });

  test('returns a function (RequestHandler)', () => {
    const handler = asyncHandler(jest.fn().mockResolvedValue(undefined));
    expect(typeof handler).toBe('function');
  });
});
