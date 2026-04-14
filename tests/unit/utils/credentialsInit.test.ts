import { initializeCredentials } from '../../../server/src/utils/credentialsInit';

jest.mock('../../../server/src/utils/validateSecrets', () => ({
  validateSecrets: jest.fn(),
}));
jest.mock('../../../server/src/services/secretsManager', () => ({
  default: {
    get: jest.fn(),
    getOrThrow: jest.fn(),
    has: jest.fn(),
    load: jest.fn(),
  },
}));

const { validateSecrets } = require('../../../server/src/utils/validateSecrets');
const secretsManager = require('../../../server/src/services/secretsManager').default;

describe('credentialsInit', () => {
  it('should validate and return secrets manager', async () => {
    validateSecrets.mockResolvedValue(undefined);

    const result = await initializeCredentials();

    expect(validateSecrets).toHaveBeenCalled();
    expect(result).toBe(secretsManager);
  });
});
