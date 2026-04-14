import { initializeMiddleware } from '../../../server/src/utils/middlewareInit';

jest.mock('../../../server/src/middleware/requestId', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../../server/src/middleware/httpsRedirect', () => ({
  createHttpsRedirect: jest.fn(),
}));

jest.mock('../../../server/src/middleware/securityHeaders', () => ({
  createSecurityHeaders: jest.fn(),
}));

jest.mock('../../../server/src/middleware/commonMiddleware', () => ({
  mountCommonMiddleware: jest.fn(),
}));

jest.mock('cookie-parser', () => jest.fn());

const requestIdMiddleware = require('../../../server/src/middleware/requestId').default;
const { createHttpsRedirect } = require('../../../server/src/middleware/httpsRedirect');
const { createSecurityHeaders } = require('../../../server/src/middleware/securityHeaders');
const { mountCommonMiddleware } = require('../../../server/src/middleware/commonMiddleware');
const cookieParser = require('cookie-parser');

describe('middlewareInit', () => {
  let mockApp: any;
  const mockRequestId = () => {};
  const mockHttpsRedirect = () => {};
  const mockSecurityHeaders = () => {};
  const mockCookieParser = () => {};

  beforeEach(() => {
    mockApp = {
      use: jest.fn(),
    };
    jest.clearAllMocks();

    // Setup default mock returns
    (requestIdMiddleware as unknown as jest.Mock).mockImplementation(() => mockRequestId);
    createHttpsRedirect.mockReturnValue(mockHttpsRedirect);
    createSecurityHeaders.mockReturnValue(mockSecurityHeaders);
    cookieParser.mockReturnValue(mockCookieParser);
  });

  it('should register middleware in correct order without HTTPS redirect', () => {
    const options = { forceHttps: false, allowedOrigins: ['*'] };
    initializeMiddleware(mockApp, options);

    // 1. Request ID
    expect(mockApp.use).toHaveBeenCalledWith(requestIdMiddleware);

    // 2. Security Headers (No HTTPS Redirect)
    expect(createSecurityHeaders).toHaveBeenCalledWith(false);
    expect(mockApp.use).toHaveBeenCalledWith(mockSecurityHeaders);

    // 3. Common Middleware
    expect(mountCommonMiddleware).toHaveBeenCalledWith(mockApp, { allowedOrigins: ['*'] });

    // 4. Cookie Parser
    expect(cookieParser).toHaveBeenCalled();
    expect(mockApp.use).toHaveBeenCalledWith(mockCookieParser);
  });

  it('should register HTTPS redirect if enabled', () => {
    const options = { forceHttps: true, allowedOrigins: ['*'] };
    initializeMiddleware(mockApp, options);

    // 1. Request ID
    expect(mockApp.use).toHaveBeenCalledWith(requestIdMiddleware);

    // 2. HTTPS Redirect
    expect(createHttpsRedirect).toHaveBeenCalled();
    expect(mockApp.use).toHaveBeenCalledWith(mockHttpsRedirect);

    // 3. Security Headers
    expect(createSecurityHeaders).toHaveBeenCalledWith(true);
    expect(mockApp.use).toHaveBeenCalledWith(mockSecurityHeaders);
  });
});
