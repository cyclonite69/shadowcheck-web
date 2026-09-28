import { overpassPoi } from '../../../../server/src/services/geocoding/providers';

describe('overpassPoi kill switch', () => {
  const originalEnabled = process.env.GEOCODING_OVERPASS_ENABLED;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalEnabled === undefined) {
      delete process.env.GEOCODING_OVERPASS_ENABLED;
    } else {
      process.env.GEOCODING_OVERPASS_ENABLED = originalEnabled;
    }
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['false', 'false'],
    ['numeric truthy', '1'],
  ])('throws and does not fetch when the switch is %s', async (_label, value) => {
    if (value === undefined) {
      delete process.env.GEOCODING_OVERPASS_ENABLED;
    } else {
      process.env.GEOCODING_OVERPASS_ENABLED = value;
    }

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ elements: [] }),
    } as Response);

    await expect(overpassPoi(1.23, 4.56)).rejects.toThrow('provider_disabled:overpass');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the existing request shape when explicitly enabled', async () => {
    process.env.GEOCODING_OVERPASS_ENABLED = 'true';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ elements: [] }),
    } as Response);

    await expect(overpassPoi(1.23, 4.56)).resolves.toMatchObject({ ok: false });

    const expectedQuery =
      '[out:json];(node(around:75,1.23,4.56)[name];way(around:75,1.23,4.56)[name];);out body 1;';
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(expectedQuery)}`
    );
  });
});
