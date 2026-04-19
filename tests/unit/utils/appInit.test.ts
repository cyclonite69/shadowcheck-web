import { initializeApp } from '../../../server/src/core/initialization/appInit';

jest.mock('../../../server/src/utils/serverConfig', () => ({
  getServerConfig: jest.fn().mockReturnValue({
    port: 3000,
    host: 'localhost',
    forceHttps: false,
    allowedOrigins: ['*'],
  }),
}));

describe('appInit', () => {
  let mockApp: any;
  let mockExpress: jest.Mock;

  beforeEach(() => {
    mockApp = {
      set: jest.fn(),
      use: jest.fn(),
    };
    mockExpress = jest.fn().mockReturnValue(mockApp);
  });

  it('should initialize express app with helmet and correct settings', () => {
    const result = initializeApp(mockExpress);

    expect(mockExpress).toHaveBeenCalled();
    expect(mockApp.set).toHaveBeenCalledWith('trust proxy', 1);
    expect(mockApp.use).toHaveBeenCalled(); // helmet
    expect(result.app).toBe(mockApp);
    expect(result.port).toBe(3000);
    expect(result.host).toBe('localhost');
  });
});
