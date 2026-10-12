export {};

const mockQuery = jest.fn();

jest.mock('../../../server/src/config/database', () => ({
  query: mockQuery,
}));

describe('observationTileRepository', () => {
  let getObservationTile: (z: number, x: number, y: number) => Promise<Buffer | null>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.mock('../../../server/src/config/database', () => ({ query: mockQuery }));
    ({
      getObservationTile,
    } = require('../../../server/src/repositories/observationTileRepository'));
  });

  it('calls the observation tile function with parameterized XYZ coordinates', async () => {
    const tile = Buffer.from([0x1a, 0x00]);
    mockQuery.mockResolvedValue({ rows: [{ tile }] });

    await expect(getObservationTile(13, 1234, 2710)).resolves.toBe(tile);
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT app.fn_get_observation_tile($1, $2, $3) AS tile',
      [13, 1234, 2710]
    );
  });

  it.each([null, Buffer.alloc(0)])(
    'returns null when the database has no tile data',
    async (tile) => {
      mockQuery.mockResolvedValue({ rows: [{ tile }] });

      await expect(getObservationTile(0, 0, 0)).resolves.toBeNull();
    }
  );
});
