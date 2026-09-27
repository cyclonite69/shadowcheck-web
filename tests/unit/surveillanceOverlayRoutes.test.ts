export {};

const services = {
  deflock: jest.fn(),
  alpr: jest.fn(),
  courthouse: jest.fn(),
  sensors: jest.fn(),
  zones: jest.fn(),
};

jest.mock('../../server/src/config/container', () => ({
  deflockService: { getDeflockCamerasGeoJSON: services.deflock },
  alprService: { getAlprCamerasGeoJSON: services.alpr },
  courthouseService: { getFederalCourthousesGeoJSON: services.courthouse },
  shotspotterSensorsService: { getShotspotterSensorsGeoJSON: services.sensors },
}));

jest.mock('../../server/src/repositories/shotspotterRepository', () => ({
  fetchShotSpotterZonesGeoJSON: services.zones,
}));

const routeCases = [
  {
    name: 'DeFlock cameras',
    module: '../../server/src/api/routes/v1/deflockCameras',
    service: services.deflock,
    error: 'Failed to fetch DeFlock camera locations',
  },
  {
    name: 'ALPR cameras',
    module: '../../server/src/api/routes/v1/alprCameras',
    service: services.alpr,
    error: 'Failed to fetch ALPR camera locations',
  },
  {
    name: 'federal courthouses',
    module: '../../server/src/api/routes/v1/federalCourthouses',
    service: services.courthouse,
    error: 'Failed to fetch federal courthouses',
  },
  {
    name: 'ShotSpotter sensors',
    module: '../../server/src/api/routes/v1/shotspotterSensors',
    service: services.sensors,
    error: 'Failed to fetch ShotSpotter sensor locations',
  },
  {
    name: 'ShotSpotter zones',
    module: '../../server/src/api/routes/v1/shotspotterZones',
    service: services.zones,
    error: 'Failed to fetch ShotSpotter deployment zones',
  },
];

function getHandler(modulePath: string) {
  const router = require(modulePath).default;
  return router.stack[0].route.stack[0].handle;
}

function createRes() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  };
}

describe.each(routeCases)('$name route', ({ module, service, error }) => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the service GeoJSON payload', async () => {
    const geojson = { type: 'FeatureCollection', features: [{ id: 'one' }] };
    service.mockResolvedValueOnce(geojson);
    const res = createRes();

    await getHandler(module)({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(geojson);
  });

  it('returns a stable 500 response when the service fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service.mockRejectedValueOnce(new Error('unavailable'));
    const res = createRes();

    await getHandler(module)({}, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ ok: false, error });
    expect(console.error).toHaveBeenCalled();
  });
});
