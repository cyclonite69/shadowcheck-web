const NetworkRepository = require('../../../server/src/repositories/networkRepository');
const dbConfigNetwork = require('../../../server/src/config/database');

jest.mock('../../../server/src/config/database', () => ({
  query: jest.fn(),
}));

describe('NetworkRepository', () => {
  let repository: any;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new NetworkRepository();
  });

  it('should fetch all networks', async () => {
    (dbConfigNetwork.query as jest.Mock).mockResolvedValue({
      rows: [{ bssid: 'AA:BB:CC:DD:EE:FF' }],
    });

    const result = await repository.getAllNetworks();

    expect(dbConfigNetwork.query).toHaveBeenCalled();
    expect(result.length).toBe(1);
  });

  it('should handle errors in getAllNetworks', async () => {
    (dbConfigNetwork.query as jest.Mock).mockRejectedValue(new Error('db error'));

    const result = await repository.getAllNetworks();

    expect(result).toEqual([]);
  });

  it('should get threatened networks', async () => {
    (dbConfigNetwork.query as jest.Mock).mockResolvedValue({
      rows: [{ bssid: 'AA:BB:CC:DD:EE:FF' }],
    });

    const result = await repository.getThreatenedNetworks();

    expect(dbConfigNetwork.query).toHaveBeenCalled();
    expect(result.length).toBe(1);
  });
});
