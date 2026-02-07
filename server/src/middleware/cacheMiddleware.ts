import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../services/cacheService';

export const cacheMiddleware = (ttlSeconds = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if Redis not enabled
    if (!cacheService.isEnabled()) {
      return next();
    }

    // Create cache key from URL and query params
    const cacheKey = `api:${req.path}:${JSON.stringify(req.query)}`;

    try {
      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function (data: any) {
        cacheService.set(cacheKey, data, ttlSeconds).catch(() => {});
        return originalJson(data);
      };

      next();
    } catch {
      next();
    }
  };
};
