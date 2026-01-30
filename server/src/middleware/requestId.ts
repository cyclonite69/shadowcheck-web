import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request interface to include our custom properties
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

/**
 * Adds a request ID to the request/response cycle for tracing.
 */
function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use existing request ID from header or generate new one
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();

  // Attach to request
  req.requestId = requestId;
  req.startTime = Date.now();

  // Add to response headers
  res.setHeader('X-Request-ID', requestId);

  next();
}

export default requestIdMiddleware;
