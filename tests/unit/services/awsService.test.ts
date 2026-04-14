const {
  getAwsConfig,
  getAwsRegion,
  getConfiguredAwsRegion,
} = require('../../../server/src/services/awsService');
const { query } = require('../../../server/src/config/database');

jest.mock('../../../server/src/config/database');

describe('awsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
  });

  describe('getConfiguredAwsRegion', () => {
    it('should return region from database', async () => {
      query.mockResolvedValue({ rows: [{ value: 'us-west-2' }] });
      const region = await getConfiguredAwsRegion();
      expect(region).toBe('us-west-2');
      expect(query).toHaveBeenCalledWith(expect.any(String), ['aws_region']);
    });

    it('should return null if no db config', async () => {
      query.mockResolvedValue({ rows: [] });
      const region = await getConfiguredAwsRegion();
      expect(region).toBeNull();
    });
  });

  describe('getAwsRegion', () => {
    it('should return configured region from database if present', async () => {
      query.mockResolvedValue({ rows: [{ value: 'us-west-2' }] });
      const region = await getAwsRegion();
      expect(region).toBe('us-west-2');
    });

    it('should return environment variable if no db config', async () => {
      query.mockResolvedValue({ rows: [] });
      process.env.AWS_REGION = 'us-east-1';
      const region = await getAwsRegion();
      expect(region).toBe('us-east-1');
    });

    it('should fallback to AWS_DEFAULT_REGION if no db or AWS_REGION', async () => {
      query.mockResolvedValue({ rows: [] });
      process.env.AWS_DEFAULT_REGION = 'eu-west-1';
      const region = await getAwsRegion();
      expect(region).toBe('eu-west-1');
    });
  });

  describe('getAwsConfig', () => {
    it('should return default config object with region', async () => {
      query.mockResolvedValue({ rows: [{ value: 'us-gov-west-1' }] });
      const config = await getAwsConfig();
      expect(config).toEqual({
        region: 'us-gov-west-1',
        credentials: undefined,
        hasExplicitCredentials: false,
      });
    });
  });
});
