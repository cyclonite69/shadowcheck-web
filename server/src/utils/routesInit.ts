/**
 * Route initialization helpers.
 */
import type { Express, Router } from 'express';
import type { QueryResult } from 'pg';

type QueryFunction = (text: string, params?: unknown[]) => Promise<QueryResult>;

interface Logger {
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
  debug: (message: string, meta?: unknown) => void;
}

interface SecretsManager {
  get: (key: string) => string | null;
  getOrThrow: (key: string) => string;
  has: (key: string) => boolean;
}

interface DashboardRoutesModule {
  router: Router;
  initDashboardRoutes: (deps: { dashboardService: unknown }) => void;
}

interface RouteModules {
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
  miscRoutes: Router;
}

interface InitializeRoutesOptions {
  routes: RouteModules;
  query: QueryFunction;
  secretsManager: SecretsManager;
  logger: Logger;
}

/**
 * Initialize API routes and their dependencies.
 */
function initializeRoutes(app: Express, options: InitializeRoutesOptions): void {
  const { routes, query, secretsManager, logger } = options;

  // Make secretsManager available to routes
  app.locals.secretsManager = secretsManager;

  const { initializeDashboardRoutes } = require('./dashboardInit');
  initializeDashboardRoutes(routes.dashboardRoutes);

  const { mountApiRoutes } = require('./routeMounts');
  mountApiRoutes(app, {
    healthRoutes: routes.healthRoutes,
    geospatialRoutes: routes.geospatialRoutes,
    networksRoutes: routes.networksRoutes,
    threatsRoutes: routes.threatsRoutes,
    wigleRoutes: routes.wigleRoutes,
    adminRoutes: routes.adminRoutes,
    explorerRoutes: routes.explorerRoutes,
    mlRoutes: routes.mlRoutes,
    analyticsRoutes: routes.analyticsRoutes,
    dashboardRoutes: routes.dashboardRoutes,
    networksV2Routes: routes.networksV2Routes,
    threatsV2Routes: routes.threatsV2Routes,
    filteredRoutes: routes.filteredRoutes,
    locationMarkersRoutes: routes.locationMarkersRoutes,
    homeLocationRoutes: routes.homeLocationRoutes,
    keplerRoutes: routes.keplerRoutes,
    backupRoutes: routes.backupRoutes,
    exportRoutes: routes.exportRoutes,
    analyticsPublicRoutes: routes.analyticsPublicRoutes,
    settingsRoutes: routes.settingsRoutes,
    networkTagsRoutes: routes.networkTagsRoutes,
    authRoutes: routes.authRoutes,
    query,
  });

  logger.info('All routes mounted successfully');
}

export { initializeRoutes, InitializeRoutesOptions, RouteModules };
