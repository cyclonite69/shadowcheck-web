export {};

const mockQuery = jest.fn();

jest.mock('../../../server/src/config/database', () => ({
  query: mockQuery,
}));

describe('alprTileRepository', () => {
  let getAlprCameraTile: (z: number, x: number, y: number) => Promise<Buffer | null>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.mock('../../../server/src/config/database', () => ({ query: mockQuery }));
    ({ getAlprCameraTile } = require('../../../server/src/repositories/alprTileRepository'));
  });

  it('calls the tile function with parameterized XYZ coordinates', async () => {
    const tile = Buffer.from([0x1a, 0x00]);
    mockQuery.mockResolvedValue({ rows: [{ tile }] });

    await expect(getAlprCameraTile(4, 7, 9)).resolves.toBe(tile);
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT app.fn_get_alpr_camera_tile($1, $2, $3) AS tile',
      [4, 7, 9]
    );
  });

  it('returns null when the database has no tile data', async () => {
    mockQuery.mockResolvedValue({ rows: [{ tile: null }] });

    await expect(getAlprCameraTile(0, 0, 0)).resolves.toBeNull();
  });
});
