export {};

const threatReportService = require('../../server/src/services/threatReportService') as any;
const { query } = require('../../server/src/config/database') as any;
const observationService = require('../../server/src/services/observationService') as any;

jest.mock('../../server/src/config/database');
jest.mock('../../server/src/services/observationService');
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => {
    return {
      on: jest.fn().mockImplementation(function (this: any, event: string, cb: any) {
        if (event === 'data') {
          cb(Buffer.from('pdf data'));
        }
        if (event === 'end') {
          cb();
        }
        return this;
      }),
      fontSize: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      moveDown: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };
  });
});

describe('ThreatReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getThreatReportData', () => {
    it('should return null if network not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await threatReportService.getThreatReportData('AA:BB:CC:DD:EE:FF');

      expect(result).toBeNull();
    });

    it('should return structured report data', async () => {
      const mockNetwork = {
        bssid: 'AA:BB:CC:DD:EE:FF',
        ssid: 'Test SSID',
        manufacturer: 'Test Man',
        type: 'W',
        encryption: 'WPA2',
        frequency: 2412,
        observations: 10,
        max_distance_meters: 5000,
        last_seen: '2023-01-01T12:00:00Z',
        first_seen: '2023-01-01T10:00:00Z',
        rule_based_score: 50,
        final_threat_score: 55,
        final_threat_level: 'MED',
        rule_based_flags: { suspicious: true },
        is_ignored: false,
        threat_tag: 'test-tag',
      };

      query.mockResolvedValueOnce({ rows: [mockNetwork] });
      observationService.getHomeLocationForObservations.mockResolvedValueOnce({
        lat: 45,
        lon: -75,
      });

      const mockObservations = [
        {
          time: 1672567200000,
          lat: 45.0001,
          lon: -75.0001,
          distance_from_home_km: 0.05,
          signal: -50,
        }, // Home
        { time: 1672567300000, lat: 45.004, lon: -75.004, distance_from_home_km: 0.4, signal: -60 }, // Near
        { time: 1672567400000, lat: 45.01, lon: -75.01, distance_from_home_km: 1.5, signal: -70 }, // Neighborhood
        { time: 1672567500000, lat: 45.05, lon: -75.05, distance_from_home_km: 5.0, signal: -80 }, // Away
      ];
      observationService.getObservationsByBSSID.mockResolvedValueOnce(mockObservations);

      const result = await threatReportService.getThreatReportData('AA:BB:CC:DD:EE:FF');

      expect(result).not.toBeNull();
      expect(result.network.bssid).toBe('AA:BB:CC:DD:EE:FF');
      expect(result.threat.finalThreatLevel).toBe('MED');
      expect(result.observations.count).toBe(4);
      expect(result.observations.distanceBuckets).toEqual({
        home: 1,
        near: 1,
        neighborhood: 1,
        away: 1,
        unknown: 0,
      });
      expect(result.observations.behavioralContext.homeLikeCount).toBe(2); // home + near
      expect(result.observations.behavioralContext.homeLikePct).toBe(50);
      expect(result.observations.behavioralContext.followEventCount).toBe(2); // >= 0.5km
      expect(result.observations.behavioralContext.followEventPct).toBe(50);
    });

    it('should handle observations with missing distance data', async () => {
      query.mockResolvedValueOnce({ rows: [{ bssid: 'B1' }] });
      observationService.getHomeLocationForObservations.mockResolvedValueOnce(null);
      observationService.getObservationsByBSSID.mockResolvedValueOnce([
        { time: 1672567200000, distance_from_home_km: null },
      ]);

      const result = await threatReportService.getThreatReportData('B1');
      expect(result.observations.distanceBuckets.unknown).toBe(1);
    });
  });

  describe('renderers', () => {
    const mockReport = {
      generatedAt: '2023-01-01 12:00:00 UTC',
      network: {
        bssid: 'AA:BB:CC:DD:EE:FF',
        ssid: 'Test SSID',
        manufacturer: 'Test Man',
        type: 'W',
        encryption: 'WPA2',
        isIgnored: false,
        threatTag: 'test-tag',
      },
      threat: {
        finalThreatLevel: 'HIGH',
        finalThreatScore: 80,
        ruleBasedScore: 75,
      },
      observations: {
        count: 10,
        uniqueDays: 2,
        spanDays: 1,
        firstSeen: '2023-01-01 10:00:00 UTC',
        lastSeen: '2023-01-01 12:00:00 UTC',
        distanceBuckets: { home: 5, near: 3, neighborhood: 1, away: 1, unknown: 0 },
        behavioralContext: {
          homeLikeCount: 8,
          homeLikePct: 80,
          followEventCount: 2,
          followEventPct: 20,
        },
        awayLocations: [
          { lat: 45.1, lon: -75.1, time: 1672567500000, distanceKm: 10, signal: -85 },
        ],
      },
    };

    it('should render markdown', () => {
      const md = threatReportService.renderMarkdown(mockReport);
      expect(md).toContain('# Threat Report: AA:BB:CC:DD:EE:FF');
      expect(md).toContain('## Network');
      expect(md).toContain('## Scoring');
      expect(md).toContain('10.00 km');
    });

    it('should render HTML', () => {
      const html = threatReportService.renderHtml(mockReport);
      expect(html).toContain('<h1>Threat Report</h1>');
      expect(html).toContain('AA:BB:CC:DD:EE:FF');
      expect(html).toContain('Test SSID');
      expect(html).toContain('10.00');
    });

    it('should render PDF buffer', async () => {
      const buffer = await threatReportService.renderPdfBuffer(mockReport);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.toString()).toBe('pdf data');
    });
  });
});
