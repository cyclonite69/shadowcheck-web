import { validateSecrets } from '../../../server/src/utils/validateSecrets';
import secretsManager from '../../../server/src/services/secretsManager';
import logger from '../../../server/src/logging/logger';

jest.mock('../../../server/src/services/secretsManager', () => ({
  load: jest.fn(),
  smReachable: true,
  smLastError: null,
}));

jest.mock('../../../server/src/logging/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('validateSecrets', () => {
  let exitMock: jest.Mock;

  beforeEach(() => {
    exitMock = jest.fn((code) => {
      throw new Error(`process.exit called with code ${code}`);
    });
    jest.clearAllMocks();
  });

  it('should return true when secrets are loaded successfully', async () => {
    (secretsManager.load as jest.Mock).mockResolvedValue(undefined);
    (secretsManager as any).smReachable = true;

    const result = await validateSecrets({
      secretsManager: secretsManager as any,
      logger,
      exit: exitMock as any,
    });
    expect(result).toBe(true);
    expect(secretsManager.load).toHaveBeenCalled();
  });

  it('should warn when SM is unreachable', async () => {
    (secretsManager.load as jest.Mock).mockResolvedValue(undefined);
    (secretsManager as any).smReachable = false;
    (secretsManager as any).smLastError = 'Some error';

    const result = await validateSecrets({
      secretsManager: secretsManager as any,
      logger,
      exit: exitMock as any,
    });
    expect(result).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('AWS SECRETS MANAGER IS UNREACHABLE'));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Error: Some error'));
  });

  it('should warn about aws sso login if credentials expired', async () => {
    (secretsManager.load as jest.Mock).mockResolvedValue(undefined);
    (secretsManager as any).smReachable = false;
    (secretsManager as any).smLastError = 'Token is expired';

    await validateSecrets({
      secretsManager: secretsManager as any,
      logger,
      exit: exitMock as any,
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Run 'aws sso login"));
  });

  it('should log error and exit when secrets loading fails', async () => {
    const error = new Error('Secret load error');
    (secretsManager.load as jest.Mock).mockRejectedValue(error);

    await expect(
      validateSecrets({
        secretsManager: secretsManager as any,
        logger,
        exit: exitMock as any,
      })
    ).rejects.toThrow('process.exit called with code 1');
    
    expect(logger.error).toHaveBeenCalledWith('SECRETS VALIDATION FAILED');
    expect(logger.error).toHaveBeenCalledWith('Secret load error');
    expect(exitMock).toHaveBeenCalledWith(1);
  });
});
