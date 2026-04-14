import { initializeDashboardRoutes } from '../../../server/src/utils/dashboardInit';

jest.mock('../../../server/src/repositories/networkRepository', () => {
  return jest.fn().mockImplementation(() => ({}));
});

jest.mock('../../../server/src/services/dashboardService', () => {
  return jest.fn().mockImplementation(() => ({}));
});

const NetworkRepository = require('../../../server/src/repositories/networkRepository');
const DashboardService = require('../../../server/src/services/dashboardService');

describe('dashboardInit', () => {
  it('should initialize dashboard routes with services', () => {
    const mockDashboardRoutes = {
      initDashboardRoutes: jest.fn(),
      router: {},
    };

    initializeDashboardRoutes(mockDashboardRoutes);

    expect(NetworkRepository).toHaveBeenCalled();
    expect(DashboardService).toHaveBeenCalled();
    expect(mockDashboardRoutes.initDashboardRoutes).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboardService: expect.any(Object),
      })
    );
  });
});
