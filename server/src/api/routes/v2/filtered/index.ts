import type { Request, Response } from 'express';
import type { HandlerDeps } from './types';
import { createListHandler } from './handlers/list';
import { createGeospatialHandler } from './handlers/geospatial';
import {
  createGetObservationsHandler,
  createPostObservationsHandler,
} from './handlers/observations';
import { createAnalyticsHandler } from './handlers/analytics';

const createHandlers = (deps: HandlerDeps) => ({
  list: createListHandler(deps),
  geospatial: createGeospatialHandler(deps),
  getObservations: createGetObservationsHandler(deps),
  postObservations: createPostObservationsHandler(deps),
  analytics: createAnalyticsHandler(deps),
  debug: (_req: Request, res: Response) => {
    res.json({ message: 'Debug route works', timestamp: new Date().toISOString() });
  },
});

export { createHandlers };
