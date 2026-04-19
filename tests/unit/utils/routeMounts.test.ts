import { mountDemoRoutes, mountApiRoutes } from '../../../server/src/utils/routeMounts';
import * as authMiddleware from '../../../server/src/middleware/authMiddleware';

jest.mock('../../../server/src/middleware/authMiddleware', () => ({
  requireAuth: jest.fn((req, res, next) => next()),
  requireAdmin: jest.fn((req, res, next) => next()),
}));

describe('routeMounts', () => {
  let mockApp: any;
  let mockDeps: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockApp = {
      use: jest.fn(),
    };
    mockDeps = {
      healthRoutes: 'healthRoutes',
      geospatialRoutes: 'geospatialRoutes',
      networksRoutes: 'networksRoutes',
      threatsRoutes: 'threatsRoutes',
      wigleRoutes: 'wigleRoutes',
      adminRoutes: 'adminRoutes',
      explorerRoutes: 'explorerRoutes',
      mlRoutes: 'mlRoutes',
      analyticsRoutes: 'analyticsRoutes',
      dashboardRoutes: {
        router: 'dashboardRouter',
        initDashboardRoutes: jest.fn(),
      },
      networksV2Routes: 'networksV2Routes',
      threatsV2Routes: 'threatsV2Routes',
      filteredRoutes: 'filteredRoutes',
      locationMarkersRoutes: 'locationMarkersRoutes',
      homeLocationRoutes: 'homeLocationRoutes',
      keplerRoutes: 'keplerRoutes',
      backupRoutes: 'backupRoutes',
      exportRoutes: 'exportRoutes',
      analyticsPublicRoutes: 'analyticsPublicRoutes',
      settingsRoutes: 'settingsRoutes',
      networkTagsRoutes: 'networkTagsRoutes',
      authRoutes: 'authRoutes',
      claudeRoutes: 'claudeRoutes',
      threatReportRoutes: 'threatReportRoutes',
      mobileIngestRoutes: 'mobileIngestRoutes',
      agencyOfficesRoutes: 'agencyOfficesRoutes',
      federalCourthousesRoutes: 'federalCourthousesRoutes',
      networkAgenciesRoutes: 'networkAgenciesRoutes',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should mount demo routes', () => {
    const mockMiscRoutes = 'miscRoutes' as any;
    mountDemoRoutes(mockApp, mockMiscRoutes);
    expect(mockApp.use).toHaveBeenCalledWith('/', mockMiscRoutes);
  });

  it('should mount api routes with authentication enabled by default', () => {
    delete process.env.API_GATE_ENABLED;
    mountApiRoutes(mockApp, mockDeps);

    // Verify some key mounts
    expect(mockApp.use).toHaveBeenCalledWith('/', 'healthRoutes');
    expect(mockApp.use).toHaveBeenCalledWith('/api', 'healthRoutes');
    expect(mockApp.use).toHaveBeenCalledWith(
      ['/v1/ingest', '/api/v1/ingest'],
      'mobileIngestRoutes'
    );
    expect(mockApp.use).toHaveBeenCalledWith('/agency-offices', 'agencyOfficesRoutes');
    expect(mockApp.use).toHaveBeenCalledWith('/api/networks', authMiddleware.requireAuth, 'networkAgenciesRoutes');

    // Verify gated routes use requireAuth
    const gatedNetworksCall = mockApp.use.mock.calls.find(
      (call: any) => call[0] === '/api' && call[2] === 'networksRoutes'
    );
    expect(gatedNetworksCall[1]).toBe(authMiddleware.requireAuth);

    // Verify admin routes use requireAdmin
    const gatedMlCall = mockApp.use.mock.calls.find(
      (call: any) => call[0] === '/api' && call[2] === 'mlRoutes'
    );
    expect(gatedMlCall[1]).toBe(authMiddleware.requireAdmin);
  });

  it('should mount api routes without authentication when API_GATE_ENABLED is false', () => {
    process.env.API_GATE_ENABLED = 'false';
    mountApiRoutes(mockApp, mockDeps);

    // Verify gated routes do NOT use requireAuth (they use the bypass middleware)
    const gatedNetworksCall = mockApp.use.mock.calls.find(
      (call: any) => call[0] === '/api' && call[2] === 'networksRoutes'
    );
    expect(gatedNetworksCall[1]).not.toBe(authMiddleware.requireAuth);

    // Test that the bypass middleware works
    const bypassMiddleware = gatedNetworksCall[1];
    const next = jest.fn();
    bypassMiddleware({}, {}, next);
    expect(next).toHaveBeenCalled();
  });

  it('should log error if a route is undefined', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const depsWithUndefined = { ...mockDeps, networksRoutes: undefined };
    mountApiRoutes(mockApp, depsWithUndefined);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ROUTE ERROR] networksRoutes is undefined!')
    );
    consoleSpy.mockRestore();
  });
});
