import { registerErrorHandlers } from '../../../server/src/core/initialization/errorHandlingInit';

describe('errorHandlingInit', () => {
  it('should register handlers on the app', () => {
    const mockApp: any = {
      use: jest.fn(),
    };
    const mockLogger: any = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    registerErrorHandlers(mockApp, mockLogger);

    expect(mockApp.use).toHaveBeenCalledTimes(2);
  });
});
