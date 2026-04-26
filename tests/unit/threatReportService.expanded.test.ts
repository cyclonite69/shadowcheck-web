import { getThreatReportData } from '../../server/src/services/threatReportService';
const { query } = require('../../server/src/config/database');
const observationService = require('../../server/src/services/observationService');

jest.mock('../../server/src/config/database');
jest.mock('../../server/src/services/observationService');

describe('ThreatReportService - Expanded Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles zero observations correctly without division by zero', async () => {
    query.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
    observationService.getHomeLocationForObservations.mockResolvedValueOnce(null);
    observationService.getObservationsByBSSID.mockResolvedValueOnce([]);

    const result = await getThreatReportData('B1');
    expect(result).not.toBeNull();
    const res = result!;

    expect(res.observations.behavioralContext.homeLikePct).toBe(0);
    expect(res.observations.behavioralContext.followEventPct).toBe(0);
    expect(res.observations.spanDays).toBe(0);
  });

  it('calculates single-observation report correctly', async () => {
    query.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
    observationService.getHomeLocationForObservations.mockResolvedValueOnce(null);
    observationService.getObservationsByBSSID.mockResolvedValueOnce([
      { time: 1672567200000, distance_from_home_km: 1.0 },
    ]);
    const result = await getThreatReportData('B1');
    expect(result).not.toBeNull();
    const res = result!;
    expect(res.observations.spanDays).toBe(0);
    expect(res.observations.uniqueDays).toBe(1);
  });

  it('verifies bucket boundary thresholds (exactly 0.1, 0.5, 2.0)', async () => {
    query.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
    observationService.getHomeLocationForObservations.mockResolvedValueOnce({ lat: 0, lon: 0 });
    observationService.getObservationsByBSSID.mockResolvedValueOnce([
      { distance_from_home_km: 0.099 }, // home
      { distance_from_home_km: 0.1 }, // near
      { distance_from_home_km: 0.499 }, // near
      { distance_from_home_km: 0.5 }, // neighborhood
      { distance_from_home_km: 1.99 }, // neighborhood
      { distance_from_home_km: 2.0 }, // away
    ]);

    const result = await getThreatReportData('B1');
    expect(result).not.toBeNull();
    const buckets = result!.observations.distanceBuckets;
    expect(buckets).toEqual({
      home: 1,
      near: 2,
      neighborhood: 2,
      away: 1,
      unknown: 0,
    });
  });
});
