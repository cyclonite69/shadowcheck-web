/**
 * Route mounting helpers for the main server bootstrap.
 */
import type { Express, Router } from 'express';
import type { QueryResult } from 'pg';
import type { RequestHandler } from 'express';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';

type QueryFunction = (text: string, params?: unknown[]) => Promise<QueryResult>;

interface DashboardRoutesModule {
  router: Router;
  initDashboardRoutes: (deps: { dashboardService: unknown }) => void;
}

interface ApiRouteDependencies {
  healthRoutes: Router;
  geospatialRoutes: Router;
  networksRoutes: Router;
  threatsRoutes: Router;
  wigleRoutes: Router;
  adminRoutes: Router;
  explorerRoutes: Router;
  mlRoutes: Router;
  analyticsRoutes: Router;
  dashboardRoutes: DashboardRoutesModule;
  networksV2Routes: Router;
  threatsV2Routes: Router;
  filteredRoutes: Router;
  locationMarkersRoutes: Router;
  homeLocationRoutes: Router;
  keplerRoutes: Router;
  backupRoutes: Router;
  exportRoutes: Router;
  analyticsPublicRoutes: Router;
  settingsRoutes: Router;
  networkTagsRoutes: Router;
  authRoutes: Router;
  claudeRoutes: Router;
  threatReportRoutes: Router;
  mobileIngestRoutes: Router;
}

/**
 * Mount demo routes (must run before static asset middleware).
 */
function mountDemoRoutes(app: Express, miscRoutes: Router): void {
  app.use('/', miscRoutes);
}

/**
 * Mount API and page routes (must run after static assets).
 */
function mountApiRoutes(app: Express, deps: ApiRouteDependencies): void {
  const {
    healthRoutes,
    geospatialRoutes,
    networksRoutes,
    threatsRoutes,
    wigleRoutes,
    adminRoutes,
    explorerRoutes,
    mlRoutes,
    analyticsRoutes,
    dashboardRoutes,
    networksV2Routes,
    threatsV2Routes,
    filteredRoutes,
    locationMarkersRoutes,
    homeLocationRoutes,
    keplerRoutes,
    backupRoutes,
    exportRoutes,
    analyticsPublicRoutes,
    settingsRoutes,
    networkTagsRoutes,
    authRoutes,
    claudeRoutes,
    threatReportRoutes,
    mobileIngestRoutes,
  } = deps;
  // Fail closed: gate is enabled unless explicitly set to "false".
  const apiGateEnabled =
    String(process.env.API_GATE_ENABLED ?? 'true')
      .trim()
      .toLowerCase() === 'true';
  const userGate: RequestHandler = apiGateEnabled
    ? requireAuth
    : (_req, _res, next) => {
        next();
      };
  const adminGate: RequestHandler = apiGateEnabled
    ? requireAdmin
    : (_req, _res, next) => {
        next();
      };

  // Debug: Check for undefined routes
  const routes = {
    healthRoutes,
    geospatialRoutes,
    networksRoutes,
    threatsRoutes,
    wigleRoutes,
    adminRoutes,
    explorerRoutes,
    mlRoutes,
    analyticsRoutes,
    networksV2Routes,
    threatsV2Routes,
    filteredRoutes,
    homeLocationRoutes,
    keplerRoutes,
    backupRoutes,
    exportRoutes,
    analyticsPublicRoutes,
    settingsRoutes,
    networkTagsRoutes,
    authRoutes,
    claudeRoutes,
    threatReportRoutes,
    mobileIngestRoutes,
  };

  for (const [name, route] of Object.entries(routes)) {
    if (!route) {
      console.error(`[ROUTE ERROR] ${name} is undefined!`);
    }
  }

  // Health checks are intentionally public and mounted at both /health and
  // /api/health for backward compatibility with older deploy probes.
  app.use('/', healthRoutes);
  app.use('/api', healthRoutes);

  // Geospatial routes (includes root redirect)
  app.use('/', geospatialRoutes);

  // Export routes define their own per-route auth checks. Do not gate the mount
  // itself or it will block public auth endpoints like /api/auth/login.
  app.use('/api', exportRoutes);

  // Public analytics routes (no auth required) - mount outside /api
  app.use('/analytics-public', analyticsPublicRoutes);

  // Agency offices (public data - mount outside /api to avoid admin auth middleware)
  const agencyOfficesRoutes = require('../api/routes/v1/agencyOffices').default;
  app.use('/agency-offices', agencyOfficesRoutes);

  const federalCourthousesRoutes = require('../api/routes/v1/federalCourthouses').default;
  app.use('/federal-courthouses', federalCourthousesRoutes);

  // API routes
  app.use('/api', authRoutes);
  app.use('/api', userGate, networksRoutes);
  app.use('/api', userGate, threatsRoutes);
  app.use('/api/wigle', userGate, wigleRoutes);
  app.use('/api', userGate, explorerRoutes);
  app.use('/api/analytics', userGate, analyticsRoutes);
  app.use('/api', userGate, dashboardRoutes.router);
  app.use('/api/v2/networks/filtered', userGate, filteredRoutes);
  app.use('/api', userGate, networksV2Routes);
  app.use('/api/v2', userGate, threatsV2Routes);
  app.use('/api', userGate, locationMarkersRoutes);
  app.use('/api', userGate, homeLocationRoutes);
  app.use('/api', userGate, keplerRoutes);
  app.use('/api/network-tags', userGate, networkTagsRoutes);
  app.use('/api', userGate, claudeRoutes);
  app.use('/api', userGate, threatReportRoutes);
  app.use('/api/v1/ingest', userGate, mobileIngestRoutes);

  // Network agencies (nearest agencies to network observations)
  const networkAgenciesRoutes = require('../api/routes/v1/network-agencies');
  app.use('/api/networks', userGate, networkAgenciesRoutes);

  // Admin-page/system routes
  app.use('/api', adminGate, mlRoutes);
  app.use('/api', adminGate, backupRoutes);
  app.use('/api', adminGate, settingsRoutes);

  // Admin routes (MUST BE LAST - has requireAdmin middleware on all routes)
  app.use('/api', adminRoutes);
}

export { mountDemoRoutes, mountApiRoutes, ApiRouteDependencies, DashboardRoutesModule };
