import {
  loadCoreDependencies,
  loadRouteModules,
} from '../../../server/src/utils/serverDependencies';

// Mock all the required modules
jest.mock('../../../server/src/utils/envSanitizer', () => ({
  clearPostgresEnv: jest.fn(),
}));

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

jest.mock('../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('express', () => {
  const mockRouter = {
    get: jest.fn().mockReturnThis(),
    post: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    use: jest.fn().mockReturnThis(),
  };
  const mockExpress = () => ({
    use: jest.fn(),
    listen: jest.fn(),
  });
  (mockExpress as any).Router = jest.fn(() => mockRouter);
  return mockExpress;
});

// Mock all the route modules that loadRouteModules requires
const mockRoute = { default: { get: jest.fn(), post: jest.fn(), use: jest.fn() } };
const mockRouteModule = { get: jest.fn(), post: jest.fn(), use: jest.fn() };

jest.mock('../../../server/src/api/routes/v1/health', () => mockRoute);
jest.mock('../../../server/src/api/routes/v1/networks/index', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/explorer', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/threats', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/wigle', () => mockRoute);
jest.mock('../../../server/src/api/routes/v1/admin', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/ml', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/geospatial', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/analytics', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v2/networks', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v2/threats', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v2/filtered', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/dashboard', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/location-markers', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/home-location', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/kepler', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/backup', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/export', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/analytics-public', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/settings', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/network-tags', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/auth', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/misc', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/claude', () => mockRouteModule);
jest.mock('../../../server/src/api/routes/v1/threat-report', () => mockRoute);
jest.mock('../../../server/src/api/routes/v1/mobileIngest', () => mockRoute);

describe('serverDependencies', () => {
  it('should load core dependencies correctly', () => {
    const deps = loadCoreDependencies();

    expect(deps).toHaveProperty('express');
    expect(deps).toHaveProperty('path');
    expect(deps).toHaveProperty('logger');

    const { clearPostgresEnv } = require('../../../server/src/utils/envSanitizer');
    expect(clearPostgresEnv).toHaveBeenCalled();

    const dotenv = require('dotenv');
    expect(dotenv.config).toHaveBeenCalledWith({ override: true });
  });

  it('should load route modules correctly', () => {
    // Mock routes that use agencyService or other dependencies
    jest.mock('../../../server/src/api/routes/v1/agencyOffices', () => ({ default: { get: jest.fn() } }), { virtual: true });
    jest.mock('../../../server/src/api/routes/v1/federalCourthouses', () => ({ default: { get: jest.fn() } }), { virtual: true });
    jest.mock('../../../server/src/api/routes/v1/network-agencies', () => ({ get: jest.fn() }), { virtual: true });

    const routeModules = loadRouteModules();

    expect(routeModules).toHaveProperty('healthRoutes');
    expect(routeModules).toHaveProperty('networksRoutes');
    expect(routeModules).toHaveProperty('explorerRoutes');
    expect(routeModules).toHaveProperty('threatsRoutes');
    expect(routeModules).toHaveProperty('wigleRoutes');
    expect(routeModules).toHaveProperty('agencyOfficesRoutes');
    expect(routeModules).toHaveProperty('federalCourthousesRoutes');
    expect(routeModules).toHaveProperty('networkAgenciesRoutes');
  });
});
