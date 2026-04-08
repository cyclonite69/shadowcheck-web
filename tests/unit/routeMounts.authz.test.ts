/**
 * Authz gate smoke tests for route mounting.
 * Verifies 401/403/200 behavior via mounted middleware chains.
 */

import type { RequestHandler } from 'express';

jest.mock('../../server/src/middleware/authMiddleware', () => {
  const requireAuth = (req: any, res: any, next: any) => {
    const role = req.get('x-test-role');
    if (!role) {
      return res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
    }

    req.user = { id: 'test-user', username: 'test', role };
    return next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    return requireAuth(req, res, () => {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          error: 'Admin access required',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }
      return next();
    });
  };

  return {
    requireAuth,
    requireAdmin,
    optionalAuth: (_req: any, _res: any, next: any) => next(),
    extractToken: () => null,
  };
});

jest.mock('../../server/src/api/routes/v1/agencyOffices', () => ({
  __esModule: true,
  default: (_req: any, _res: any, next: any) => next(),
}));

jest.mock(
  '../../server/src/api/routes/v1/network-agencies',
  () => (_req: any, _res: any, next: any) => next()
);

const { mountApiRoutes } = require('../../server/src/utils/routeMounts');

type MountedEntry = { path: string; handlers: RequestHandler[] };

function makeTerminalHandler(name: string): RequestHandler {
  return (req: any, res: any) => {
    res.status(200).json({ ok: true, route: name, role: req.user?.role || null });
  };
}

function buildDeps() {
  return {
    healthRoutes: makeTerminalHandler('health'),
    geospatialRoutes: makeTerminalHandler('geospatial'),
    networksRoutes: makeTerminalHandler('networks'),
    threatsRoutes: makeTerminalHandler('threats'),
    wigleRoutes: makeTerminalHandler('wigle'),
    adminRoutes: makeTerminalHandler('admin'),
    explorerRoutes: makeTerminalHandler('explorer'),
    mlRoutes: makeTerminalHandler('ml'),
    analyticsRoutes: makeTerminalHandler('analytics'),
    dashboardRoutes: {
      router: makeTerminalHandler('dashboard'),
      initDashboardRoutes: () => {},
    },
    networksV2Routes: makeTerminalHandler('networks-v2'),
    threatsV2Routes: makeTerminalHandler('threats-v2'),
    filteredRoutes: makeTerminalHandler('filtered'),
    locationMarkersRoutes: makeTerminalHandler('location-markers'),
    homeLocationRoutes: makeTerminalHandler('home-location'),
    keplerRoutes: makeTerminalHandler('kepler'),
    backupRoutes: makeTerminalHandler('backup'),
    exportRoutes: makeTerminalHandler('export'),
    analyticsPublicRoutes: makeTerminalHandler('analytics-public'),
    settingsRoutes: makeTerminalHandler('settings'),
    networkTagsRoutes: makeTerminalHandler('network-tags'),
    authRoutes: makeTerminalHandler('auth'),
    claudeRoutes: makeTerminalHandler('claude'),
    threatReportRoutes: makeTerminalHandler('threat-report'),
    mobileIngestRoutes: makeTerminalHandler('mobile-ingest'),
  };
}

function invokeChain(handlers: RequestHandler[], role?: string) {
  const req: any = {
    user: undefined,
    get: (header: string) => {
      if (header.toLowerCase() === 'x-test-role') {
        return role;
      }
      return undefined;
    },
  };

  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  const run = (index: number): void => {
    if (index >= handlers.length) {
      return;
    }

    const handler = handlers[index];
    handler(req, res, () => run(index + 1));
  };

  run(0);
  return { req, res };
}

function findMountedHandlers(mounted: MountedEntry[], path: string, terminal: RequestHandler) {
  const match = mounted.find(
    (m) => m.path === path && m.handlers[m.handlers.length - 1] === terminal
  );
  if (!match) {
    throw new Error(`Missing mounted handlers for ${path}`);
  }
  return match.handlers;
}

describe('routeMounts authz smoke', () => {
  const originalGate = process.env.API_GATE_ENABLED;

  afterEach(() => {
    if (originalGate === undefined) {
      delete process.env.API_GATE_ENABLED;
    } else {
      process.env.API_GATE_ENABLED = originalGate;
    }
  });

  test('gate enabled: user/admin/public behavior yields 401/403/200', () => {
    process.env.API_GATE_ENABLED = 'true';

    const deps = buildDeps();
    const mounted: MountedEntry[] = [];
    const app = {
      use: (path: string, ...handlers: RequestHandler[]) => {
        mounted.push({ path, handlers });
      },
    };

    mountApiRoutes(app as any, deps);

    const userHandlers = findMountedHandlers(mounted, '/api', deps.networksRoutes);
    const adminHandlers = findMountedHandlers(mounted, '/api', deps.mlRoutes);
    const authHandlers = findMountedHandlers(mounted, '/api', deps.authRoutes);
    const analyticsPublicHandlers = findMountedHandlers(
      mounted,
      '/analytics-public',
      deps.analyticsPublicRoutes
    );

    const noAuth = invokeChain(userHandlers);
    expect(noAuth.res.statusCode).toBe(401);
    expect(noAuth.res.body.code).toBe('NO_TOKEN');

    const userOk = invokeChain(userHandlers, 'user');
    expect(userOk.res.statusCode).toBe(200);
    expect(userOk.res.body.route).toBe('networks');

    const userBlockedAdmin = invokeChain(adminHandlers, 'user');
    expect(userBlockedAdmin.res.statusCode).toBe(403);
    expect(userBlockedAdmin.res.body.code).toBe('INSUFFICIENT_PERMISSIONS');

    const adminOk = invokeChain(adminHandlers, 'admin');
    expect(adminOk.res.statusCode).toBe(200);
    expect(adminOk.res.body.route).toBe('ml');

    const authPublic = invokeChain(authHandlers);
    expect(authPublic.res.statusCode).toBe(200);
    expect(authPublic.res.body.route).toBe('auth');

    const analyticsPublic = invokeChain(analyticsPublicHandlers);
    expect(analyticsPublic.res.statusCode).toBe(200);
    expect(analyticsPublic.res.body.route).toBe('analytics-public');
  });

  test('health routes stay public on both / and /api when gate is enabled', () => {
    process.env.API_GATE_ENABLED = 'true';

    const deps = buildDeps();
    const mounted: MountedEntry[] = [];
    const app = {
      use: (path: string, ...handlers: RequestHandler[]) => {
        mounted.push({ path, handlers });
      },
    };

    mountApiRoutes(app as any, deps);

    const rootHealthHandlers = findMountedHandlers(mounted, '/', deps.healthRoutes);
    const apiHealthHandlers = findMountedHandlers(mounted, '/api', deps.healthRoutes);

    expect(invokeChain(rootHealthHandlers).res.statusCode).toBe(200);
    expect(invokeChain(apiHealthHandlers).res.statusCode).toBe(200);
  });

  test('gate disabled: user/admin routes are pass-through (200)', () => {
    process.env.API_GATE_ENABLED = 'false';

    const deps = buildDeps();
    const mounted: MountedEntry[] = [];
    const app = {
      use: (path: string, ...handlers: RequestHandler[]) => {
        mounted.push({ path, handlers });
      },
    };

    mountApiRoutes(app as any, deps);

    const userHandlers = findMountedHandlers(mounted, '/api', deps.networksRoutes);
    const adminHandlers = findMountedHandlers(mounted, '/api', deps.mlRoutes);

    const userNoAuth = invokeChain(userHandlers);
    expect(userNoAuth.res.statusCode).toBe(200);

    const adminNoAuth = invokeChain(adminHandlers);
    expect(adminNoAuth.res.statusCode).toBe(200);
  });
});
