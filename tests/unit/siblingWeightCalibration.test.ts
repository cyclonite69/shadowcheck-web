import {
  calibrateSiblingWeights,
  parseCalibrationCsv,
  type CalibrationSample,
} from '../../scripts/forensic/siblingWeightCalibration';

const HEADER =
  'bssid1,bssid2,label,candidate_present,heuristic_confidence,distance_m,ssid_exact_match';

function makeDataset(): CalibrationSample[] {
  const samples: CalibrationSample[] = [];
  for (let index = 0; index < 80; index += 1) {
    const suffix = index.toString(16).padStart(2, '0').toUpperCase();
    const positive = index < 40;
    const bssid1 = positive ? `00:11:22:00:00:${suffix}` : `00:11:22:00:01:${suffix}`;
    const bssid2 = positive
      ? `00:11:22:00:00:${(index + 80).toString(16).padStart(2, '0').toUpperCase()}`
      : `AA:BB:CC:00:02:${suffix}`;
    samples.push({
      bssid1,
      bssid2,
      label: positive ? 1 : 0,
      candidate_present: 1,
      heuristic_confidence: positive ? 0.8 : 0.6,
      distance_m: positive ? 10 : 1200,
      ssid_exact_match: positive ? 1 : 0,
    });
  }
  return samples;
}

function makeCsvRows(samples: CalibrationSample[]): string {
  return samples
    .map(
      (sample) =>
        `${sample.bssid1},${sample.bssid2},${sample.label},${sample.candidate_present},${sample.heuristic_confidence},${sample.distance_m},${sample.ssid_exact_match}`
    )
    .join('\n');
}

describe('sibling weight calibration', () => {
  test('parses the read-only training export and nullable distances', () => {
    const csv = [HEADER, '00:11:22:00:00:01,00:11:22:00:00:02,1,1,0.8,,1'].join('\r\n');

    expect(parseCalibrationCsv(csv)).toEqual([
      {
        bssid1: '00:11:22:00:00:01',
        bssid2: '00:11:22:00:00:02',
        label: 1,
        candidate_present: 1,
        heuristic_confidence: 0.8,
        distance_m: null,
        ssid_exact_match: 1,
      },
    ]);
  });

  test('rejects duplicate pairs, reversed ordering, and malformed CSV', () => {
    const row = '00:11:22:00:00:01,00:11:22:00:00:02,1,1,0.8,5,1';
    expect(() => parseCalibrationCsv(`${HEADER}\n${row}\n${row}`)).toThrow(
      'duplicate labeled pair'
    );
    expect(() =>
      parseCalibrationCsv(`${HEADER}\n00:11:22:00:00:02,00:11:22:00:00:01,1,1,0.8,5,1`)
    ).toThrow('canonical ascending order');
    expect(() => parseCalibrationCsv(`${HEADER}\n"unterminated`)).toThrow(
      'unterminated quoted field'
    );
  });

  test('withholds weight recommendations when either manual-label class is too small', () => {
    const result = calibrateSiblingWeights(makeDataset().slice(0, 30));
    expect(result.status).toBe('insufficient_labels');
    expect(result.candidate).toBeNull();
  });

  test('uses a deterministic held-out set and suggests only reviewable weights', () => {
    const samples = makeDataset();
    const exportedCsv = `${HEADER}\n${makeCsvRows(samples)}`;
    const parsedSamples = parseCalibrationCsv(exportedCsv);
    const first = calibrateSiblingWeights(parsedSamples);
    const second = calibrateSiblingWeights(samples);

    expect(first).toEqual(second);
    expect(first.status).toBe('candidate_ready');
    expect(first.production_update).toBe(false);
    expect(first.features_excluded).toContain('rssi_correlation');
    expect(first.candidate?.eligible_for_manual_review).toBe(true);
    expect(first.candidate?.validation_metrics.precision).toBe(1);
    expect(first.candidate?.validation_metrics.recall).toBe(1);
    expect(Object.values(first.candidate!.weights).reduce((sum, weight) => sum + weight, 0)).toBe(
      1
    );
  });

  test('does not present weights as ready when held-out performance fails the review gate', () => {
    const samples = makeDataset().map((sample) => ({
      ...sample,
      heuristic_confidence: sample.label === 1 ? 1 : 0,
    }));

    const result = calibrateSiblingWeights(samples);
    expect(result.status).toBe('no_held_out_improvement');
    expect(result.candidate?.eligible_for_manual_review).toBe(false);
  });
});
