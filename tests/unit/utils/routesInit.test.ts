import { initializeRoutes } from '../../../server/src/utils/routesInit';

jest.mock('../../../server/src/utils/dashboardInit', () => ({
  initializeDashboardRoutes: jest.fn(),
}));
jest.mock('../../../server/src/utils/routeMounts', () => ({
  mountApiRoutes: jest.fn(),
}));

const { initializeDashboardRoutes } = require('../../../server/src/utils/dashboardInit');
const { mountApiRoutes } = require('../../../server/src/utils/routeMounts');

describe('routesInit', () => {
  let mockApp: any;
  let mockOptions: any;

  beforeEach(() => {
    mockApp = {
      locals: {},
    };
    mockOptions = {
      routes: {
        dashboardRoutes: { router: {}, initDashboardRoutes: jest.fn() },
        healthRoutes: {},
        geospatialRoutes: {},
        networksRoutes: {},
        threatsRoutes: {},
        wigleRoutes: {},
        adminRoutes: {},
        explorerRoutes: {},
        mlRoutes: {},
        analyticsRoutes: {},
        networksV2Routes: {},
        threatsV2Routes: {},
        filteredRoutes: {},
        locationMarkersRoutes: {},
        homeLocationRoutes: {},
        keplerRoutes: {},
        backupRoutes: {},
        exportRoutes: {},
        analyticsPublicRoutes: {},
        settingsRoutes: {},
        networkTagsRoutes: {},
        authRoutes: {},
        claudeRoutes: {},
        threatReportRoutes: {},
        mobileIngestRoutes: {},
      },
      secretsManager: {},
      logger: {
        info: jest.fn(),
      },
    };
    jest.clearAllMocks();
  });

  it('should initialize routes and mount them', () => {
    initializeRoutes(mockApp, mockOptions);

    expect(mockApp.locals.secretsManager).toBe(mockOptions.secretsManager);
    expect(initializeDashboardRoutes).toHaveBeenCalledWith(mockOptions.routes.dashboardRoutes);
    expect(mountApiRoutes).toHaveBeenCalledWith(mockApp, expect.any(Object));
    expect(mockOptions.logger.info).toHaveBeenCalledWith('All routes mounted successfully');
  });
});
