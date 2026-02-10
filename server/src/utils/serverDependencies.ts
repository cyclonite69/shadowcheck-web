/**
 * Server dependency loader helpers.
 */
import type { Express } from 'express';
import type { Router } from 'express';
import * as pathModule from 'path';

interface Logger {
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
  debug: (message: string, meta?: unknown) => void;
}

interface CoreDependencies {
  express: () => Express;
  path: typeof pathModule;
  logger: Logger;
}

interface RouteModules {
  healthRoutes: Router;
  networksRoutes: Router;
  explorerRoutes: Router;
  threatsRoutes: Router;
  wigleRoutes: Router;
  adminRoutes: Router;
  mlRoutes: Router;
  geospatialRoutes: Router;
  analyticsRoutes: Router;
  networksV2Routes: Router;
  threatsV2Routes: Router;
  filteredRoutes: Router;
  dashboardRoutes: Router;
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
  miscRoutes: Router;
}

/**
 * Load core server dependencies.
 */
function loadCoreDependencies(): CoreDependencies {
  const { clearPostgresEnv } = require('./envSanitizer');
  clearPostgresEnv();

  require('dotenv').config({ override: true });
  const logger = require('../logging/logger');
  const express = require('express');
  const path = require('path');

  return { express, path, logger };
}

/**
 * Load route modules and return route registry.
 */
function loadRouteModules(): RouteModules {
  return {
    healthRoutes: require('../api/routes/v1/health'),
    networksRoutes: require('../api/routes/v1/networks/index'),
    explorerRoutes: require('../api/routes/v1/explorer'),
    threatsRoutes: require('../api/routes/v1/threats'),
    wigleRoutes: require('../api/routes/v1/wigle'),
    adminRoutes: require('../api/routes/v1/admin'),
    mlRoutes: require('../api/routes/v1/ml'),
    geospatialRoutes: require('../api/routes/v1/geospatial'),
    analyticsRoutes: require('../api/routes/v1/analytics'),
    networksV2Routes: require('../api/routes/v2/networks'),
    threatsV2Routes: require('../api/routes/v2/threats'),
    filteredRoutes: require('../api/routes/v2/filtered'),
    dashboardRoutes: require('../api/routes/v1/dashboard'),
    locationMarkersRoutes: require('../api/routes/v1/location-markers'),
    homeLocationRoutes: require('../api/routes/v1/home-location'),
    keplerRoutes: require('../api/routes/v1/kepler'),
    backupRoutes: require('../api/routes/v1/backup'),
    exportRoutes: require('../api/routes/v1/export'),
    analyticsPublicRoutes: require('../api/routes/v1/analytics-public'),
    settingsRoutes: require('../api/routes/v1/settings'),
    networkTagsRoutes: require('../api/routes/v1/network-tags'),
    authRoutes: require('../api/routes/v1/auth'),
    weatherRoutes: require('../api/routes/v1/weather'),
    miscRoutes: require('../api/routes/v1/misc'),
  };
}

export { loadCoreDependencies, loadRouteModules, CoreDependencies, RouteModules, Logger };
