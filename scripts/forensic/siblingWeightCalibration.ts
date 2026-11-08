import { z } from 'zod';
import { parseCsvRecords } from './csvRecords';

const BSSID_PATTERN = /^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/;
const CSV_HEADERS = [
  'bssid1',
  'bssid2',
  'label',
  'candidate_present',
  'heuristic_confidence',
  'distance_m',
  'ssid_exact_match',
] as const;
const MIN_SAMPLES_PER_CLASS = 40;
const HOLDOUT_FRACTION = 0.25;
const PRODUCTION_CONFIDENCE_THRESHOLD = 0.9;
const MIN_REVIEW_PRECISION = 0.9;

const CalibrationSampleSchema = z.object({
  bssid1: z.string().regex(BSSID_PATTERN),
  bssid2: z.string().regex(BSSID_PATTERN),
  label: z.union([z.literal(0), z.literal(1)]),
  candidate_present: z.union([z.literal(0), z.literal(1)]),
  heuristic_confidence: z.number().min(0).max(2).nullable(),
  distance_m: z.number().min(0).nullable(),
  ssid_exact_match: z.union([z.literal(0), z.literal(1)]),
});

export type CalibrationSample = z.infer<typeof CalibrationSampleSchema>;

export interface WeightMetrics {
  true_positive: number;
  false_positive: number;
  true_negative: number;
  false_negative: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface CalibrationResult {
  sample_count: number;
  training_count: number;
  validation_count: number;
  positive_count: number;
  negative_count: number;
  features_used: FeatureName[];
  features_excluded: ['rssi_correlation'];
  production_update: false;
  baseline_validation: WeightMetrics | null;
  candidate: {
    weights: {
      oui_match: number;
      mac_similarity: number;
      spatial_proximity: number;
      ssid_exact_match: number;
    };
    threshold: number;
    training_metrics: WeightMetrics;
    validation_metrics: WeightMetrics;
    eligible_for_manual_review: boolean;
  } | null;
  status: 'insufficient_labels' | 'candidate_ready' | 'no_held_out_improvement';
}

const FEATURE_NAMES = [
  'oui_match',
  'mac_similarity',
  'spatial_proximity',
  'ssid_exact_match',
] as const;

type FeatureName = (typeof FEATURE_NAMES)[number];
type FeatureVector = Record<FeatureName, number | null>;

function parseInteger(value: string, field: string, rowNumber: number): number {
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`CSV row ${rowNumber}: ${field} must be an integer.`);
  }
  return Number(value);
}

function parseOptionalNumber(value: string, field: string, rowNumber: number): number | null {
  if (value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`CSV row ${rowNumber}: ${field} must be a finite number or empty.`);
  }
  return parsed;
}

/** Parse the read-only export from export-sibling-training-data.sql. */
export function parseCalibrationCsv(input: string): CalibrationSample[] {
  const [header, ...rows] = parseCsvRecords(input);
  if (!header) {
    throw new Error('Calibration CSV is empty.');
  }

  const normalizedHeader = header.map((value) => value.trim().replace(/^\uFEFF/, ''));
  if (
    normalizedHeader.length !== CSV_HEADERS.length ||
    CSV_HEADERS.some((value, index) => normalizedHeader[index] !== value)
  ) {
    throw new Error(`Unexpected CSV header. Expected: ${CSV_HEADERS.join(',')}`);
  }

  const seenPairs = new Set<string>();
  return rows.map((row, index) => {
    const rowNumber = index + 2;
    if (row.length !== CSV_HEADERS.length) {
      throw new Error(`CSV row ${rowNumber}: expected ${CSV_HEADERS.length} columns.`);
    }

    const values = Object.fromEntries(CSV_HEADERS.map((key, column) => [key, row[column].trim()]));
    const sample = CalibrationSampleSchema.parse({
      bssid1: values.bssid1,
      bssid2: values.bssid2,
      label: parseInteger(values.label, 'label', rowNumber),
      candidate_present: parseInteger(values.candidate_present, 'candidate_present', rowNumber),
      heuristic_confidence: parseOptionalNumber(
        values.heuristic_confidence,
        'heuristic_confidence',
        rowNumber
      ),
      distance_m: parseOptionalNumber(values.distance_m, 'distance_m', rowNumber),
      ssid_exact_match: parseInteger(values.ssid_exact_match, 'ssid_exact_match', rowNumber),
    });

    if (sample.bssid1 >= sample.bssid2) {
      throw new Error(`CSV row ${rowNumber}: BSSIDs must be in canonical ascending order.`);
    }
    const pairKey = `${sample.bssid1}|${sample.bssid2}`;
    if (seenPairs.has(pairKey)) {
      throw new Error(`CSV row ${rowNumber}: duplicate labeled pair ${pairKey}.`);
    }
    seenPairs.add(pairKey);
    return sample;
  });
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function splitSamples(samples: CalibrationSample[]): {
  training: CalibrationSample[];
  validation: CalibrationSample[];
} {
  const training: CalibrationSample[] = [];
  const validation: CalibrationSample[] = [];

  for (const label of [0, 1] as const) {
    const group = samples
      .filter((sample) => sample.label === label)
      .sort((left, right) => {
        const leftKey = `${left.bssid1}|${left.bssid2}`;
        const rightKey = `${right.bssid1}|${right.bssid2}`;
        return stableHash(leftKey) - stableHash(rightKey) || leftKey.localeCompare(rightKey);
      });
    const holdoutCount = Math.max(1, Math.ceil(group.length * HOLDOUT_FRACTION));
    validation.push(...group.slice(0, holdoutCount));
    training.push(...group.slice(holdoutCount));
  }

  return { training, validation };
}

function getFeatures(sample: CalibrationSample): FeatureVector {
  const octetsA = sample.bssid1.split(':');
  const octetsB = sample.bssid2.split(':');
  const matchingOctets = octetsA.filter((octet, index) => octet === octetsB[index]).length;

  return {
    oui_match: octetsA.slice(0, 3).join(':') === octetsB.slice(0, 3).join(':') ? 1 : 0,
    mac_similarity: matchingOctets / 6,
    spatial_proximity:
      sample.distance_m === null ? null : Math.max(0, 1 - sample.distance_m / 1500),
    ssid_exact_match: sample.ssid_exact_match,
  };
}

function scoreSample(sample: CalibrationSample, weights: Record<FeatureName, number>): number {
  const features = getFeatures(sample);
  let weightedSum = 0;
  let availableWeight = 0;

  for (const name of FEATURE_NAMES) {
    const value = features[name];
    if (value !== null) {
      weightedSum += weights[name] * value;
      availableWeight += weights[name];
    }
  }
  return availableWeight === 0 ? 0 : weightedSum / availableWeight;
}

function calculateMetrics(
  samples: CalibrationSample[],
  predict: (sample: CalibrationSample) => boolean
): WeightMetrics {
  let true_positive = 0;
  let false_positive = 0;
  let true_negative = 0;
  let false_negative = 0;

  for (const sample of samples) {
    const predicted = predict(sample);
    if (predicted && sample.label === 1) {
      true_positive += 1;
    } else if (predicted) {
      false_positive += 1;
    } else if (sample.label === 0) {
      true_negative += 1;
    } else {
      false_negative += 1;
    }
  }

  const precision =
    true_positive + false_positive === 0 ? 0 : true_positive / (true_positive + false_positive);
  const recall =
    true_positive + false_negative === 0 ? 0 : true_positive / (true_positive + false_negative);

  return {
    true_positive,
    false_positive,
    true_negative,
    false_negative,
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
  };
}

function* weightCandidates(): Generator<Record<FeatureName, number>> {
  for (let oui = 0; oui <= 10; oui += 1) {
    for (let mac = 0; mac <= 10 - oui; mac += 1) {
      for (let spatial = 0; spatial <= 10 - oui - mac; spatial += 1) {
        const ssid = 10 - oui - mac - spatial;
        yield {
          oui_match: oui / 10,
          mac_similarity: mac / 10,
          spatial_proximity: spatial / 10,
          ssid_exact_match: ssid / 10,
        };
      }
    }
  }
}

function compareCandidates(
  left: {
    weights: Record<FeatureName, number>;
    threshold: number;
    metrics: WeightMetrics;
  },
  right: {
    weights: Record<FeatureName, number>;
    threshold: number;
    metrics: WeightMetrics;
  }
): number {
  if (left.metrics.f1 !== right.metrics.f1) {
    return right.metrics.f1 - left.metrics.f1;
  }
  if (left.metrics.precision !== right.metrics.precision) {
    return right.metrics.precision - left.metrics.precision;
  }
  const leftActiveWeights = FEATURE_NAMES.filter((name) => left.weights[name] > 0).length;
  const rightActiveWeights = FEATURE_NAMES.filter((name) => right.weights[name] > 0).length;
  if (leftActiveWeights !== rightActiveWeights) {
    return leftActiveWeights - rightActiveWeights;
  }
  return right.threshold - left.threshold;
}

function countLabels(samples: CalibrationSample[], label: 0 | 1): number {
  return samples.filter((sample) => sample.label === label).length;
}

/** Suggests weights from manual labels; it never changes production configuration or data. */
export function calibrateSiblingWeights(samples: CalibrationSample[]): CalibrationResult {
  const positives = countLabels(samples, 1);
  const negatives = countLabels(samples, 0);
  const baseResult: CalibrationResult = {
    sample_count: samples.length,
    training_count: 0,
    validation_count: 0,
    positive_count: positives,
    negative_count: negatives,
    features_used: [...FEATURE_NAMES],
    features_excluded: ['rssi_correlation'],
    production_update: false,
    baseline_validation: null,
    candidate: null,
    status: 'insufficient_labels',
  };

  if (positives < MIN_SAMPLES_PER_CLASS || negatives < MIN_SAMPLES_PER_CLASS) {
    return baseResult;
  }

  const { training, validation } = splitSamples(samples);
  const baseline = calculateMetrics(
    validation,
    (sample) =>
      sample.candidate_present === 1 &&
      sample.heuristic_confidence !== null &&
      sample.heuristic_confidence >= PRODUCTION_CONFIDENCE_THRESHOLD
  );

  let best:
    | {
        weights: Record<FeatureName, number>;
        threshold: number;
        metrics: WeightMetrics;
      }
    | undefined;

  for (const weights of weightCandidates()) {
    for (let thresholdStep = 50; thresholdStep <= 95; thresholdStep += 5) {
      const threshold = thresholdStep / 100;
      const candidate = {
        weights,
        threshold,
        metrics: calculateMetrics(training, (sample) => scoreSample(sample, weights) >= threshold),
      };
      if (!best || compareCandidates(candidate, best) < 0) {
        best = candidate;
      }
    }
  }

  if (!best) {
    return { ...baseResult, training_count: training.length, validation_count: validation.length };
  }

  const validationMetrics = calculateMetrics(
    validation,
    (sample) => scoreSample(sample, best!.weights) >= best!.threshold
  );
  const eligible =
    validationMetrics.precision >= MIN_REVIEW_PRECISION &&
    validationMetrics.precision >= baseline.precision &&
    validationMetrics.recall >= baseline.recall &&
    (validationMetrics.precision > baseline.precision ||
      validationMetrics.recall > baseline.recall);

  return {
    ...baseResult,
    training_count: training.length,
    validation_count: validation.length,
    baseline_validation: baseline,
    candidate: {
      weights: best.weights,
      threshold: best.threshold,
      training_metrics: best.metrics,
      validation_metrics: validationMetrics,
      eligible_for_manual_review: eligible,
    },
    status: eligible ? 'candidate_ready' : 'no_held_out_improvement',
  };
}
