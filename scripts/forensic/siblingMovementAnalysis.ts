import { z } from 'zod';
import { parseCsvRecords } from './csvRecords';

const CSV_HEADERS = [
  'bssid1',
  'bssid2',
  'rule',
  'confidence',
  'label',
  'device_id',
  'source_tag',
  'window_start',
  'observations_a',
  'latitude_a',
  'longitude_a',
  'mean_signal_a',
  'observations_b',
  'latitude_b',
  'longitude_b',
  'mean_signal_b',
] as const;
const RADIUS_THRESHOLDS_METERS = [50, 100, 150, 300] as const;
const STATIONARY_RADIUS_CUTOFF_METERS = 150;
const EARTH_RADIUS_METERS = 6_371_000;

const PairMetadataSchema = z.object({
  bssid1: z.string().regex(/^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/),
  bssid2: z.string().regex(/^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/),
  rule: z.string().min(1),
  confidence: z.number().min(0).max(2),
  label: z.enum(['sibling', 'not_sibling', 'unreviewed']),
});

const MovementWindowSchema = PairMetadataSchema.extend({
  device_id: z.string().min(1),
  source_tag: z.string().min(1),
  window_start: z.string().datetime({ offset: true }),
  observations_a: z.number().int().positive(),
  latitude_a: z.number().min(-90).max(90),
  longitude_a: z.number().min(-180).max(180),
  mean_signal_a: z.number().nullable(),
  observations_b: z.number().int().positive(),
  latitude_b: z.number().min(-90).max(90),
  longitude_b: z.number().min(-180).max(180),
  mean_signal_b: z.number().nullable(),
});

export type MovementWindow = z.infer<typeof MovementWindowSchema>;
type PairWithoutWindows = z.infer<typeof PairMetadataSchema> & {
  device_id: null;
  source_tag: null;
  window_start: null;
  observations_a: null;
  latitude_a: null;
  longitude_a: null;
  mean_signal_a: null;
  observations_b: null;
  latitude_b: null;
  longitude_b: null;
  mean_signal_b: null;
};
export type MovementExportRow = MovementWindow | PairWithoutWindows;

interface PairWindowMetrics {
  window_count: number;
  mean_centroid_separation_m: number;
  median_centroid_separation_m: number;
  within_radius_pct: Record<(typeof RADIUS_THRESHOLDS_METERS)[number], number>;
  first_to_last_shared_centroid_drift_m: number;
  max_drift_from_first_centroid_m: number;
  centroid_separation_within_150m: boolean;
  first_to_last_drift_within_150m: boolean;
  max_drift_within_150m: boolean;
}

export interface SiblingMovementSummary {
  bssid1: string;
  bssid2: string;
  rule: string;
  confidence: number;
  label: 'sibling' | 'not_sibling' | 'unreviewed';
  device_id: string | null;
  source_tag: string | null;
  metrics: PairWindowMetrics | null;
  interpretation: 'no_co_observations' | 'insufficient_windows' | 'co_observed_footprint';
  footprint_classification: 'insufficient_windows' | 'stationary_like' | 'mobile_like';
  transmitter_mobility: 'undetermined';
}

interface ParsedMovementWindow extends MovementWindow {
  timestamp: number;
  centroid_latitude: number;
  centroid_longitude: number;
  separation_m: number;
}

function parseNumber(value: string, field: string, rowNumber: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`CSV row ${rowNumber}: ${field} must be a finite number.`);
  }
  return number;
}

/** Parses the CSV emitted by export-sibling-movement-data.sql. */
export function parseMovementCsv(input: string): MovementExportRow[] {
  const [header, ...rows] = parseCsvRecords(input);
  if (!header) {
    throw new Error('Movement CSV is empty.');
  }

  const normalizedHeader = header.map((value) => value.trim().replace(/^\uFEFF/, ''));
  if (
    normalizedHeader.length !== CSV_HEADERS.length ||
    CSV_HEADERS.some((value, index) => normalizedHeader[index] !== value)
  ) {
    throw new Error(`Unexpected CSV header. Expected: ${CSV_HEADERS.join(',')}`);
  }

  return rows.map((row, index) => {
    const rowNumber = index + 2;
    if (row.length !== CSV_HEADERS.length) {
      throw new Error(`CSV row ${rowNumber}: expected ${CSV_HEADERS.length} columns.`);
    }
    const values = Object.fromEntries(CSV_HEADERS.map((key, column) => [key, row[column].trim()]));
    const metadata = {
      bssid1: values.bssid1,
      bssid2: values.bssid2,
      rule: values.rule,
      confidence: parseNumber(values.confidence, 'confidence', rowNumber),
      label: values.label,
    };

    if (values.window_start === '') {
      const emptyObservationFields = [
        'device_id',
        'source_tag',
        'observations_a',
        'latitude_a',
        'longitude_a',
        'mean_signal_a',
        'observations_b',
        'latitude_b',
        'longitude_b',
        'mean_signal_b',
      ];
      if (emptyObservationFields.some((field) => values[field] !== '')) {
        throw new Error(`CSV row ${rowNumber}: empty window must not contain observation data.`);
      }
      const pairWithoutWindows: PairWithoutWindows = {
        ...PairMetadataSchema.parse(metadata),
        device_id: null,
        source_tag: null,
        window_start: null,
        observations_a: null,
        latitude_a: null,
        longitude_a: null,
        mean_signal_a: null,
        observations_b: null,
        latitude_b: null,
        longitude_b: null,
        mean_signal_b: null,
      };
      return pairWithoutWindows;
    }

    return MovementWindowSchema.parse({
      ...metadata,
      device_id: values.device_id,
      source_tag: values.source_tag,
      window_start: values.window_start,
      observations_a: parseNumber(values.observations_a, 'observations_a', rowNumber),
      latitude_a: parseNumber(values.latitude_a, 'latitude_a', rowNumber),
      longitude_a: parseNumber(values.longitude_a, 'longitude_a', rowNumber),
      mean_signal_a:
        values.mean_signal_a === ''
          ? null
          : parseNumber(values.mean_signal_a, 'mean_signal_a', rowNumber),
      observations_b: parseNumber(values.observations_b, 'observations_b', rowNumber),
      latitude_b: parseNumber(values.latitude_b, 'latitude_b', rowNumber),
      longitude_b: parseNumber(values.longitude_b, 'longitude_b', rowNumber),
      mean_signal_b:
        values.mean_signal_b === ''
          ? null
          : parseNumber(values.mean_signal_b, 'mean_signal_b', rowNumber),
    });
  });
}

function distanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number
): number {
  const radians = (degrees: number): number => (degrees * Math.PI) / 180;
  const deltaLatitude = radians(latitudeB - latitudeA);
  const deltaLongitude = radians(longitudeB - longitudeA);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function midpoint(valueA: number, valueB: number): number {
  return (valueA + valueB) / 2;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function summarizeTrack(windows: MovementWindow[]): SiblingMovementSummary {
  const parsedWindows: ParsedMovementWindow[] = windows
    .map((window) => ({
      ...window,
      timestamp: Date.parse(window.window_start),
      centroid_latitude: midpoint(window.latitude_a, window.latitude_b),
      centroid_longitude: midpoint(window.longitude_a, window.longitude_b),
      separation_m: distanceMeters(
        window.latitude_a,
        window.longitude_a,
        window.latitude_b,
        window.longitude_b
      ),
    }))
    .sort((left, right) => left.timestamp - right.timestamp);
  const separations = parsedWindows.map((window) => window.separation_m);
  const first = parsedWindows[0];
  const last = parsedWindows[parsedWindows.length - 1];
  const meanLatitudeA =
    parsedWindows.reduce((sum, window) => sum + window.latitude_a, 0) / parsedWindows.length;
  const meanLongitudeA =
    parsedWindows.reduce((sum, window) => sum + window.longitude_a, 0) / parsedWindows.length;
  const meanLatitudeB =
    parsedWindows.reduce((sum, window) => sum + window.latitude_b, 0) / parsedWindows.length;
  const meanLongitudeB =
    parsedWindows.reduce((sum, window) => sum + window.longitude_b, 0) / parsedWindows.length;
  const drift = distanceMeters(
    first.centroid_latitude,
    first.centroid_longitude,
    last.centroid_latitude,
    last.centroid_longitude
  );
  const maxSpan = Math.max(
    ...parsedWindows.map((window) =>
      distanceMeters(
        first.centroid_latitude,
        first.centroid_longitude,
        window.centroid_latitude,
        window.centroid_longitude
      )
    )
  );
  const thresholds = Object.fromEntries(
    RADIUS_THRESHOLDS_METERS.map((radius) => [
      radius,
      (100 * separations.filter((separation) => separation <= radius).length) / separations.length,
    ])
  ) as PairWindowMetrics['within_radius_pct'];

  const meanCentroidSeparation = distanceMeters(
    meanLatitudeA,
    meanLongitudeA,
    meanLatitudeB,
    meanLongitudeB
  );
  return {
    bssid1: first.bssid1,
    bssid2: first.bssid2,
    rule: first.rule,
    confidence: first.confidence,
    label: first.label,
    device_id: first.device_id,
    source_tag: first.source_tag,
    metrics: {
      window_count: parsedWindows.length,
      mean_centroid_separation_m: meanCentroidSeparation,
      median_centroid_separation_m: median(separations),
      within_radius_pct: thresholds,
      first_to_last_shared_centroid_drift_m: drift,
      max_drift_from_first_centroid_m: maxSpan,
      centroid_separation_within_150m: meanCentroidSeparation <= STATIONARY_RADIUS_CUTOFF_METERS,
      first_to_last_drift_within_150m: drift <= STATIONARY_RADIUS_CUTOFF_METERS,
      max_drift_within_150m: maxSpan <= STATIONARY_RADIUS_CUTOFF_METERS,
    },
    interpretation: parsedWindows.length < 2 ? 'insufficient_windows' : 'co_observed_footprint',
    footprint_classification:
      parsedWindows.length < 2
        ? 'insufficient_windows'
        : maxSpan <= STATIONARY_RADIUS_CUTOFF_METERS
          ? 'stationary_like'
          : 'mobile_like',
    transmitter_mobility: 'undetermined',
  };
}

/** Summarizes paired scanner-observation footprints without asserting transmitter mobility. */
export function analyzeSiblingMovement(rows: MovementExportRow[]): SiblingMovementSummary[] {
  const grouped = new Map<string, MovementWindow[]>();
  const pairMetadata = new Map<string, z.infer<typeof PairMetadataSchema>>();
  for (const row of rows) {
    if (row.bssid1 >= row.bssid2) {
      throw new Error(`Pair must be in canonical order: ${row.bssid1}|${row.bssid2}`);
    }
    const pairKey = [row.bssid1, row.bssid2].join('|');
    const existing = pairMetadata.get(pairKey);
    if (existing && (existing.rule !== row.rule || existing.label !== row.label)) {
      throw new Error(`Inconsistent pair metadata for ${pairKey}.`);
    }
    pairMetadata.set(pairKey, PairMetadataSchema.parse(row));

    if (row.window_start !== null) {
      const key = [pairKey, row.device_id, row.source_tag].join('|');
      const track = grouped.get(key) ?? [];
      track.push(row);
      grouped.set(key, track);
    }
  }

  const summaries = [...grouped.values()].map(summarizeTrack);
  const observedPairs = new Set(summaries.map((summary) => `${summary.bssid1}|${summary.bssid2}`));
  for (const [pairKey, metadata] of pairMetadata) {
    if (!observedPairs.has(pairKey)) {
      summaries.push({
        ...metadata,
        device_id: null,
        source_tag: null,
        metrics: null,
        interpretation: 'no_co_observations',
        footprint_classification: 'insufficient_windows',
        transmitter_mobility: 'undetermined',
      });
    }
  }

  return summaries.sort(
    (left, right) =>
      left.bssid1.localeCompare(right.bssid1) ||
      left.bssid2.localeCompare(right.bssid2) ||
      (left.device_id ?? '').localeCompare(right.device_id ?? '') ||
      (left.source_tag ?? '').localeCompare(right.source_tag ?? '')
  );
}
