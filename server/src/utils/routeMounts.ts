/**
 * Route mounting helpers for the main server bootstrap.
 */
import type { Express, Router } from 'express';
import type { QueryResult } from 'pg';
import type { RequestHandler } from 'express';
import { requireAuth } from '../middleware/authMiddleware';

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
  weatherRoutes: Router;
  claudeRoutes: Router;
  threatReportRoutes: Router;
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
    weatherRoutes,
    claudeRoutes,
    threatReportRoutes,
  } = deps;
  const apiGateEnabled = process.env.API_GATE_ENABLED === 'true';
  const gate: RequestHandler = apiGateEnabled
    ? requireAuth
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
    weatherRoutes,
    claudeRoutes,
    threatReportRoutes,
  };

  for (const [name, route] of Object.entries(routes)) {
    if (!route) {
      console.error(`[ROUTE ERROR] ${name} is undefined!`);
    }
  }

  // Health check (no prefix, available at /health)
  app.use('/', healthRoutes);

  // Geospatial routes (includes root redirect)
  app.use('/', geospatialRoutes);

  // Export routes (no auth required) - mount first
  app.use('/api', gate, exportRoutes);

  // Public analytics routes (no auth required) - mount outside /api
  app.use('/analytics-public', analyticsPublicRoutes);

  // Weather proxy (no auth required)
  // TEMPORARILY DISABLED - TypeScript ES module compatibility issue
  // app.use('/', weatherRoutes);

  // Agency offices (public data - mount outside /api to avoid admin auth middleware)
  const agencyOfficesRoutes = require('../api/routes/v1/agencyOffices').default;
  app.use('/agency-offices', agencyOfficesRoutes);

  // API routes
  app.use('/api', authRoutes);
  app.use('/api', gate, networksRoutes);
  app.use('/api', gate, threatsRoutes);
  app.use('/api', gate, wigleRoutes);
  app.use('/api', gate, explorerRoutes);
  app.use('/api', gate, mlRoutes);
  app.use('/api/analytics', gate, analyticsRoutes);
  app.use('/api', gate, dashboardRoutes.router);
  app.use('/api/v2/networks/filtered', gate, filteredRoutes);
  app.use('/api', gate, networksV2Routes);
  app.use('/api/v2', gate, threatsV2Routes);
  app.use('/api', gate, locationMarkersRoutes);
  app.use('/api', gate, homeLocationRoutes);
  app.use('/api', gate, keplerRoutes);
  app.use('/api', gate, backupRoutes);
  app.use('/api', gate, settingsRoutes);
  app.use('/api/network-tags', gate, networkTagsRoutes);

  // Network agencies (nearest agencies to network observations)
  const networkAgenciesRoutes = require('../api/routes/v1/network-agencies');
  app.use('/api/networks', gate, networkAgenciesRoutes);

  // Claude / Bedrock routes
  app.use('/api', gate, claudeRoutes);
  app.use('/api', gate, threatReportRoutes);

  // Admin routes (MUST BE LAST - has requireAdmin middleware on all routes)
  app.use('/api', adminRoutes);
}

export { mountDemoRoutes, mountApiRoutes, ApiRouteDependencies, DashboardRoutesModule };
