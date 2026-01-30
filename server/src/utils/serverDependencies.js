/**
 * Server dependency loader helpers.
 */

/**
 * Load core server dependencies.
 * @returns {{ express: Function, path: import('path'), logger: object }}
 */
function loadCoreDependencies() {
  const { clearPostgresEnv } = require('./envSanitizer.ts');
  clearPostgresEnv();

  require('dotenv').config({ override: true });
  const logger = require('../logging/logger');
  const express = require('express');
  const path = require('path');

  return { express, path, logger };
}

/**
 * Load route modules and return route registry.
 * @returns {object} Route modules
 */
function loadRouteModules() {
  return {
    healthRoutes: require('../api/routes/v1/health'),
    networksRoutes: require('../api/routes/v1/networks'),
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
    miscRoutes: require('../api/routes/v1/misc'),
  };
}

module.exports = {
  loadCoreDependencies,
  loadRouteModules,
};
