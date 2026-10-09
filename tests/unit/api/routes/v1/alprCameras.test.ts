import express from 'express';
import request from 'supertest';

const mockGetAlprCamerasGeoJSON = jest.fn();

jest.mock('../../../../../server/src/config/container', () => ({
  alprService: {
    getAlprCamerasGeoJSON: mockGetAlprCamerasGeoJSON,
  },
}));

const app = express();
app.use('/', require('../../../../../server/src/api/routes/v1/alprCameras').default);

describe('GET /api/v1/surveillance/alpr-cameras', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAlprCamerasGeoJSON.mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    });
  });

  it('passes a validated bbox through to the service', async () => {
    const response = await request(app).get('/?bbox=-74.05,40.65,-73.85,40.85');

    expect(response.status).toBe(200);
    expect(mockGetAlprCamerasGeoJSON).toHaveBeenCalledWith([-74.05, 40.65, -73.85, 40.85]);
  });

  it('rejects malformed or out-of-range bounding boxes', async () => {
    const malformed = await request(app).get('/?bbox=-74,40,west,41');
    const outOfRange = await request(app).get('/?bbox=-190,40,-73,41');

    expect(malformed.status).toBe(400);
    expect(outOfRange.status).toBe(400);
    expect(mockGetAlprCamerasGeoJSON).not.toHaveBeenCalled();
  });

  it('preserves the unfiltered response when bbox is omitted', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(mockGetAlprCamerasGeoJSON).toHaveBeenCalledWith(undefined);
  });
});
