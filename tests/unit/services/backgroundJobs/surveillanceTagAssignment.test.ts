export {};

// Tests that runSurveillanceScanJob writes the correct tag JSON for each device type.
// The CASE expression in the INSERT SQL determines which tags array each device gets.

const mockAdminQuery = jest.fn();
const mockGetEnrichedCandidates = jest.fn();
const mockBulkUpsertDetections = jest.fn();
const mockScoreSurveillanceCandidates = jest.fn();

jest.mock('../../../../server/src/services/adminDbService', () => ({
  adminQuery: mockAdminQuery,
}));
jest.mock('../../../../server/src/repositories/surveillanceDetectionRepository', () => ({
  getEnrichedCandidates: mockGetEnrichedCandidates,
  bulkUpsertDetections: mockBulkUpsertDetections,
}));
jest.mock('../../../../server/src/services/backgroundJobs/surveillanceScoring', () => ({
  scoreSurveillanceCandidates: mockScoreSurveillanceCandidates,
}));

const {
  runSurveillanceScanJob,
} = require('../../../../server/src/services/backgroundJobs/runners');

beforeEach(() => jest.clearAllMocks());

function makeScored(device_type: string) {
  return [
    {
      bssid: 'AA:BB:CC:DD:EE:01',
      device_type,
      confidence: 0.9,
      threat_score: 85,
      detection_method: 'oui_match',
      matched_signals: {},
      false_positive: false,
      fp_reason: null,
    },
  ];
}

async function getTagSql(): Promise<string> {
  const calls = mockAdminQuery.mock.calls.filter(
    (c: any[]) => typeof c[0] === 'string' && c[0].includes('network_tags')
  );
  expect(calls.length).toBeGreaterThan(0);
  return calls[0][0] as string;
}

describe('runSurveillanceScanJob — tag CASE assignment', () => {
  beforeEach(() => {
    mockGetEnrichedCandidates.mockResolvedValue([{}]);
    mockBulkUpsertDetections.mockResolvedValue(1);
    mockAdminQuery.mockResolvedValue({ rowCount: 1 });
  });

  const flockTypes = ['FLOCK_SAFETY_CAMERA', 'RAVEN_GUNSHOT_DETECTOR', 'FS_EXT_BATTERY'];
  for (const dt of flockTypes) {
    test(`${dt} → tags include "flock"`, async () => {
      mockScoreSurveillanceCandidates.mockReturnValue(makeScored(dt));
      await runSurveillanceScanJob();
      const sql = await getTagSql();
      expect(sql).toContain('"flock"');
      expect(sql).toContain('"surveillance"');
    });
  }

  const bwcTypes = [
    'AXON_BODY_CAMERA',
    'MOTOROLA_BWC',
    'AXON_SIGNAL_PERIPHERAL',
    'DEI_BWC',
    'BT_IMAGING_DEVICE',
  ];
  for (const dt of bwcTypes) {
    test(`${dt} → tags include "bwc"`, async () => {
      mockScoreSurveillanceCandidates.mockReturnValue(makeScored(dt));
      await runSurveillanceScanJob();
      const sql = await getTagSql();
      expect(sql).toContain('"bwc"');
      expect(sql).toContain('"surveillance"');
    });
  }

  test('SHOTSPOTTER_SENSOR → tags include "shotspotter"', async () => {
    mockScoreSurveillanceCandidates.mockReturnValue(makeScored('SHOTSPOTTER_SENSOR'));
    await runSurveillanceScanJob();
    const sql = await getTagSql();
    expect(sql).toContain('"shotspotter"');
    expect(sql).toContain('"surveillance"');
  });

  test('DASHCAM → tags include "dashcam" without "bwc"', async () => {
    mockScoreSurveillanceCandidates.mockReturnValue(makeScored('DASHCAM'));
    await runSurveillanceScanJob();
    const sql = await getTagSql();
    expect(sql).toContain('["surveillance","dashcam"]');
    expect(sql).toMatch(/WHEN dt = 'DASHCAM' THEN '\["surveillance","dashcam"\]'/);
  });

  test('RESIDENTIAL_CAMERA → tags include "residential_cam" without "bwc"', async () => {
    mockScoreSurveillanceCandidates.mockReturnValue(makeScored('RESIDENTIAL_CAMERA'));
    await runSurveillanceScanJob();
    const sql = await getTagSql();
    expect(sql).toContain('["surveillance","residential_cam"]');
    expect(sql).toMatch(
      /WHEN dt = 'RESIDENTIAL_CAMERA' THEN '\["surveillance","residential_cam"\]'/
    );
  });

  test('SQL CASE covers all three branches (flock, bwc, shotspotter)', async () => {
    mockScoreSurveillanceCandidates.mockReturnValue(makeScored('FLOCK_SAFETY_CAMERA'));
    await runSurveillanceScanJob();
    const sql = await getTagSql();
    expect(sql).toContain('FLOCK_SAFETY_CAMERA');
    expect(sql).toContain('AXON_BODY_CAMERA');
    expect(sql).toContain('DEI_BWC');
    expect(sql).toContain('BT_IMAGING_DEVICE');
    expect(sql).toContain('SHOTSPOTTER_SENSOR');
  });
});
