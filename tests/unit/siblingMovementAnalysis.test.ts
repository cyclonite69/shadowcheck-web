import {
  analyzeSiblingMovement,
  parseMovementCsv,
  type MovementWindow,
} from '../../scripts/forensic/siblingMovementAnalysis';

const HEADER =
  'bssid1,bssid2,rule,confidence,label,device_id,source_tag,window_start,observations_a,latitude_a,longitude_a,mean_signal_a,observations_b,latitude_b,longitude_b,mean_signal_b';

function makeWindow(
  windowStart: string,
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
  overrides: Partial<MovementWindow> = {}
): MovementWindow {
  return {
    bssid1: '00:11:22:00:00:01',
    bssid2: '00:11:22:00:00:02',
    rule: 'Mist Systems VAP (Class A)',
    confidence: 0.95,
    label: 'unreviewed',
    device_id: 'scanner-1',
    source_tag: 'field-device',
    window_start: windowStart,
    observations_a: 1,
    latitude_a: latitudeA,
    longitude_a: longitudeA,
    mean_signal_a: -50,
    observations_b: 1,
    latitude_b: latitudeB,
    longitude_b: longitudeB,
    mean_signal_b: -55,
    ...overrides,
  };
}

function toCsv(windows: MovementWindow[]): string {
  const rows = windows.map((window) =>
    [
      window.bssid1,
      window.bssid2,
      window.rule,
      window.confidence,
      window.label,
      window.device_id,
      window.source_tag,
      window.window_start,
      window.observations_a,
      window.latitude_a,
      window.longitude_a,
      window.mean_signal_a,
      window.observations_b,
      window.latitude_b,
      window.longitude_b,
      window.mean_signal_b,
    ].join(',')
  );
  return [HEADER, ...rows].join('\n');
}

describe('sibling movement observation analysis', () => {
  test('parses the read-only export and preserves quoted CSV values', () => {
    const csv = `${HEADER}\n${[
      '00:11:22:00:00:01',
      '00:11:22:00:00:02',
      '"Custom, matched rule"',
      '0.95',
      'unreviewed',
      'scanner-1',
      'field-device',
      '2026-01-01T00:00:00Z',
      '1',
      '42',
      '-83',
      '-50',
      '1',
      '42',
      '-83',
      '-55',
    ].join(',')}`;

    expect(parseMovementCsv(csv)[0].rule).toBe('Custom, matched rule');
  });

  test('reports radius sensitivity and shared scanner-footprint drift without labeling transmitter mobility', () => {
    const windows = [
      makeWindow('2026-01-01T00:10:00Z', 42.002, -83, 42.004, -83),
      makeWindow('2026-01-01T00:05:00Z', 42, -83, 42.001, -83),
      makeWindow('2026-01-01T00:00:00Z', 42, -83, 42, -83),
    ];

    const [summary] = analyzeSiblingMovement(windows);
    const metrics = summary.metrics;
    expect(metrics).not.toBeNull();
    if (!metrics) {
      throw new Error('Expected movement metrics for a pair with matched observations.');
    }

    expect(metrics.window_count).toBe(3);
    expect(metrics.within_radius_pct[50]).toBeCloseTo(100 / 3, 5);
    expect(metrics.within_radius_pct[100]).toBeCloseTo(100 / 3, 5);
    expect(metrics.within_radius_pct[150]).toBeCloseTo((2 * 100) / 3, 5);
    expect(metrics.within_radius_pct[300]).toBe(100);
    expect(metrics.mean_centroid_separation_m).toBeGreaterThan(100);
    expect(metrics.first_to_last_shared_centroid_drift_m).toBeGreaterThan(300);
    expect(metrics.centroid_separation_within_150m).toBe(true);
    expect(metrics.max_drift_within_150m).toBe(false);
    expect(summary.interpretation).toBe('co_observed_footprint');
    expect(summary.footprint_classification).toBe('mobile_like');
    expect(summary.transmitter_mobility).toBe('undetermined');
  });

  test('labels a compact shared footprint stationary-like when max drift is within 150 m', () => {
    const windows = [
      makeWindow('2026-01-01T00:00:00Z', 42, -83, 42, -83),
      makeWindow('2026-01-01T00:05:00Z', 42.0005, -83, 42.0005, -83),
    ];

    const [summary] = analyzeSiblingMovement(windows);
    expect(summary.metrics?.max_drift_within_150m).toBe(true);
    expect(summary.footprint_classification).toBe('stationary_like');
    expect(summary.transmitter_mobility).toBe('undetermined');
  });

  test('keeps unreviewed pairs and independent scanner/source tracks separate', () => {
    const windows = [
      makeWindow('2026-01-01T00:00:00Z', 42, -83, 42, -83),
      makeWindow('2026-01-01T00:00:00Z', 42, -83, 42, -83, {
        device_id: 'scanner-2',
        source_tag: 'other-device',
      }),
    ];

    const summaries = analyzeSiblingMovement(windows);
    expect(summaries).toHaveLength(2);
    expect(summaries.map((summary) => summary.label)).toEqual(['unreviewed', 'unreviewed']);
    expect(summaries.every((summary) => summary.interpretation === 'insufficient_windows')).toBe(
      true
    );
    expect(
      summaries.every((summary) => summary.footprint_classification === 'insufficient_windows')
    ).toBe(true);
    expect(summaries.every((summary) => summary.transmitter_mobility === 'undetermined')).toBe(
      true
    );
  });

  test('reports existing pairs with no matched scanner/time observations', () => {
    const csv = `${HEADER}\n${[
      '00:11:22:00:00:01',
      '00:11:22:00:00:02',
      'same_oui_proximity',
      '0.8',
      'not_sibling',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ].join(',')}`;

    const [summary] = analyzeSiblingMovement(parseMovementCsv(csv));
    expect(summary.label).toBe('not_sibling');
    expect(summary.metrics).toBeNull();
    expect(summary.interpretation).toBe('no_co_observations');
    expect(summary.footprint_classification).toBe('insufficient_windows');
    expect(summary.transmitter_mobility).toBe('undetermined');
  });

  test('rejects reversed BSSID order and invalid coordinates in the export', () => {
    const reversed = makeWindow('2026-01-01T00:00:00Z', 42, -83, 42, -83, {
      bssid1: '00:11:22:00:00:02',
      bssid2: '00:11:22:00:00:01',
    });
    expect(() => analyzeSiblingMovement([reversed])).toThrow('canonical order');

    const invalidCsv = toCsv([makeWindow('2026-01-01T00:00:00Z', 95, -83, 42, -83)]);
    expect(() => parseMovementCsv(invalidCsv)).toThrow();
  });
});
