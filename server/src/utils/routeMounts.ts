/**
 * Route mounting helpers for the main server bootstrap.
 */
import type { Express, Router } from 'express';
import type { QueryResult } from 'pg';

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
  locationMarkersRoutes: (query: QueryFunction) => Router;
  homeLocationRoutes: Router;
  keplerRoutes: Router;
  backupRoutes: Router;
  exportRoutes: Router;
  analyticsPublicRoutes: Router;
  settingsRoutes: Router;
  networkTagsRoutes: Router;
  authRoutes: Router;
  weatherRoutes: Router;
  query: QueryFunction;
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
    query,
  } = deps;

  // Health check (no prefix, available at /health)
  app.use('/', healthRoutes);

  // Geospatial routes (includes root redirect)
  app.use('/', geospatialRoutes);

  // Export routes (no auth required) - mount first
  app.use('/api', exportRoutes);

  // Public analytics routes (no auth required) - mount outside /api
  app.use('/analytics-public', analyticsPublicRoutes);

  // Weather proxy (no auth required)
  // app.use('/', weatherRoutes); // TODO: Fix module export issue

  // API routes
  app.use('/api', authRoutes);
  app.use('/api', networksRoutes);
  app.use('/api', threatsRoutes);
  app.use('/api', wigleRoutes);
  app.use('/api', explorerRoutes);
  app.use('/api', mlRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api', dashboardRoutes.router);
  app.use('/api/v2/networks/filtered', filteredRoutes);
  app.use('/api', networksV2Routes);
  app.use('/api/v2', threatsV2Routes);
  app.use('/api', locationMarkersRoutes(query));
  app.use('/api', homeLocationRoutes);
  app.use('/api', keplerRoutes);
  app.use('/api', backupRoutes);
  app.use('/api', settingsRoutes);
  app.use('/api/network-tags', networkTagsRoutes);

  // Admin routes (must be last or handled carefully due to catch-all middleware)
  app.use('/api', adminRoutes);
}

export { mountDemoRoutes, mountApiRoutes, ApiRouteDependencies, DashboardRoutesModule };
