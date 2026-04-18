const { getHomeLocation } = require('../../../../server/src/services/networking/homeLocation');
const { query } = require('../../../../server/src/config/database');
const logger = require('../../../../server/src/logging/logger');

jest.mock('../../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../../../server/src/logging/logger', () => ({
  warn: jest.fn(),
}));

describe('networking homeLocation service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return lat and lon when home location exists', async () => {
    query.mockResolvedValueOnce({
      rows: [{ latitude: '37.7749', longitude: '-122.4194' }],
    });

    const result = await getHomeLocation();

    expect(result).toEqual({ lat: 37.7749, lon: -122.4194 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE marker_type = 'home'"));
  });

  it('should return null when no home location is found', async () => {
    query.mockResolvedValueOnce({
      rows: [],
    });

    const result = await getHomeLocation();

    expect(result).toBeNull();
  });

  it('should return null when latitude or longitude is null', async () => {
    query.mockResolvedValueOnce({
      rows: [{ latitude: null, longitude: '-122.4194' }],
    });

    const result = await getHomeLocation();
    expect(result).toBeNull();

    query.mockResolvedValueOnce({
      rows: [{ latitude: '37.7749', longitude: null }],
    });

    const result2 = await getHomeLocation();
    expect(result2).toBeNull();
  });

  it('should log warning and return null when query fails', async () => {
    const error = new Error('DB Error');
    query.mockRejectedValueOnce(error);

    const result = await getHomeLocation();

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith('Could not fetch home location:', 'DB Error');
  });
});
