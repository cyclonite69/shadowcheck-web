export {};

import { FilterBuildContext } from '../../server/src/services/filterQueryBuilder/FilterBuildContext';
import { buildNetworkWhere } from '../../server/src/services/filterQueryBuilder/networkWhereBuilder';
import { buildFastPathSupplementalPredicates } from '../../server/src/services/filterQueryBuilder/modules/networkFastPathSupplementalPredicates';

// ── networkWhereBuilder ───────────────────────────────────────────────────────

describe('buildNetworkWhere — surveillance sub-filters', () => {
  test('flock filter generates EXISTS subquery against surveillance_detections with flock device types', () => {
    const ctx = new FilterBuildContext({ flock: true }, { flock: true });
    const where = buildNetworkWhere(ctx);
    const clause = where.find(
      (w) => w.includes('surveillance_detections') && w.includes('FLOCK_SAFETY_CAMERA')
    );
    expect(clause).toBeDefined();
    expect(clause).toContain('EXISTS');
    expect(clause).toContain('sd.bssid = ne.bssid');
    expect(clause).toContain('RAVEN_GUNSHOT_DETECTOR');
    expect(clause).toContain('FS_EXT_BATTERY');
    expect(ctx.getAppliedFilters().map((f) => f.field)).toContain('flock');
  });

  test('bwc filter generates EXISTS subquery against surveillance_detections with bwc device types', () => {
    const ctx = new FilterBuildContext({ bwc: true }, { bwc: true });
    const where = buildNetworkWhere(ctx);
    const clause = where.find(
      (w) => w.includes('surveillance_detections') && w.includes('AXON_BODY_CAMERA')
    );
    expect(clause).toBeDefined();
    expect(clause).toContain('EXISTS');
    expect(clause).toContain('sd.bssid = ne.bssid');
    expect(clause).toContain('MOTOROLA_BWC');
    expect(clause).toContain('AXON_SIGNAL_PERIPHERAL');
    expect(clause).toContain('DEI_BWC');
    expect(clause).toContain('BT_IMAGING_DEVICE');
    expect(ctx.getAppliedFilters().map((f) => f.field)).toContain('bwc');
  });

  test('shotspotter filter generates EXISTS subquery against surveillance_detections with SHOTSPOTTER_SENSOR', () => {
    const ctx = new FilterBuildContext({ shotspotter: true }, { shotspotter: true });
    const where = buildNetworkWhere(ctx);
    const clause = where.find(
      (w) => w.includes('surveillance_detections') && w.includes('SHOTSPOTTER_SENSOR')
    );
    expect(clause).toBeDefined();
    expect(clause).toContain('EXISTS');
    expect(clause).toContain('sd.bssid = ne.bssid');
    expect(ctx.getAppliedFilters().map((f) => f.field)).toContain('shotspotter');
  });

  test('umbrella surveillance filter generates EXISTS subquery against surveillance_detections (no device_type filter)', () => {
    const ctx = new FilterBuildContext({ surveillance: true }, { surveillance: true });
    const where = buildNetworkWhere(ctx);
    const clause = where.find(
      (w) => w.includes('surveillance_detections') && !w.includes('device_type')
    );
    expect(clause).toBeDefined();
    expect(clause).toContain('EXISTS');
    expect(clause).toContain('sd.bssid = ne.bssid');
    expect(ctx.getAppliedFilters().map((f) => f.field)).toContain('surveillance');
  });

  test('flock filter does not query network_tags', () => {
    const ctx = new FilterBuildContext({ flock: true }, { flock: true });
    const where = buildNetworkWhere(ctx);
    expect(where.some((w) => w.includes('network_tags'))).toBe(false);
  });

  test('bwc filter does not query network_tags', () => {
    const ctx = new FilterBuildContext({ bwc: true }, { bwc: true });
    const where = buildNetworkWhere(ctx);
    expect(where.some((w) => w.includes('network_tags'))).toBe(false);
  });

  test('bwc filter excludes false-positive detections', () => {
    const ctx = new FilterBuildContext({ bwc: true }, { bwc: true });
    const where = buildNetworkWhere(ctx);
    const clause = where.find((w) => w.includes('surveillance_detections'));
    expect(clause).toContain('sd.false_positive = FALSE');
  });

  test.each([
    ['dashcam', 'DASHCAM'],
    ['residential_cam', 'RESIDENTIAL_CAMERA'],
  ])(
    '%s filter targets only its device type and excludes false positives',
    (filter, deviceType) => {
      const ctx = new FilterBuildContext({ [filter]: true }, { [filter]: true });
      const where = buildNetworkWhere(ctx);
      const clause = where.find((w) => w.includes('surveillance_detections'));
      expect(clause).toContain(`sd.device_type IN ('${deviceType}')`);
      expect(clause).toContain('sd.false_positive = FALSE');
      expect(ctx.getAppliedFilters().map((f) => f.field)).toContain(filter);
    }
  );

  test('shotspotter filter does not query network_tags', () => {
    const ctx = new FilterBuildContext({ shotspotter: true }, { shotspotter: true });
    const where = buildNetworkWhere(ctx);
    expect(where.some((w) => w.includes('network_tags'))).toBe(false);
  });

  test('flock filter disabled when enabled flag is false', () => {
    const ctx = new FilterBuildContext({ flock: true }, { flock: false });
    const where = buildNetworkWhere(ctx);
    expect(where.some((w) => w.includes('FLOCK_SAFETY_CAMERA'))).toBe(false);
  });

  test('flock and bwc can be combined', () => {
    const ctx = new FilterBuildContext({ flock: true, bwc: true }, { flock: true, bwc: true });
    const where = buildNetworkWhere(ctx);
    expect(where.some((w) => w.includes('FLOCK_SAFETY_CAMERA'))).toBe(true);
    expect(where.some((w) => w.includes('AXON_BODY_CAMERA'))).toBe(true);
    const fields = ctx.getAppliedFilters().map((f) => f.field);
    expect(fields).toContain('flock');
    expect(fields).toContain('bwc');
  });
});

// ── networkFastPathSupplementalPredicates ─────────────────────────────────────

describe('buildFastPathSupplementalPredicates — surveillance sub-filters', () => {
  test('flock filter generates EXISTS subquery against surveillance_detections with flock device types', () => {
    const ctx = new FilterBuildContext({ flock: true }, { flock: true });
    const where = buildFastPathSupplementalPredicates(ctx, {});
    const clause = where.find(
      (w) => w.includes('surveillance_detections') && w.includes('FLOCK_SAFETY_CAMERA')
    );
    expect(clause).toBeDefined();
    expect(clause).toContain('EXISTS');
    expect(clause).toContain('sd.bssid = ne.bssid');
    expect(clause).toContain('RAVEN_GUNSHOT_DETECTOR');
    expect(clause).toContain('FS_EXT_BATTERY');
    expect(ctx.getAppliedFilters().map((f) => f.field)).toContain('flock');
  });

  test('bwc filter generates EXISTS subquery against surveillance_detections with bwc device types', () => {
    const ctx = new FilterBuildContext({ bwc: true }, { bwc: true });
    const where = buildFastPathSupplementalPredicates(ctx, {});
    const clause = where.find(
      (w) => w.includes('surveillance_detections') && w.includes('AXON_BODY_CAMERA')
    );
    expect(clause).toBeDefined();
    expect(clause).toContain('EXISTS');
    expect(clause).toContain('sd.bssid = ne.bssid');
    expect(clause).toContain('MOTOROLA_BWC');
    expect(clause).toContain('DEI_BWC');
    expect(clause).toContain('BT_IMAGING_DEVICE');
    expect(ctx.getAppliedFilters().map((f) => f.field)).toContain('bwc');
  });

  test.each([
    ['dashcam', 'DASHCAM'],
    ['residential_cam', 'RESIDENTIAL_CAMERA'],
  ])('fast path %s filter targets only its device type', (filter, deviceType) => {
    const ctx = new FilterBuildContext({ [filter]: true }, { [filter]: true });
    const where = buildFastPathSupplementalPredicates(ctx, {});
    const clause = where.find((w) => w.includes('surveillance_detections'));
    expect(clause).toContain(`sd.device_type IN ('${deviceType}')`);
    expect(clause).toContain('sd.false_positive = FALSE');
    expect(ctx.getAppliedFilters().map((f) => f.field)).toContain(filter);
  });

  test('shotspotter filter generates EXISTS subquery against surveillance_detections with SHOTSPOTTER_SENSOR', () => {
    const ctx = new FilterBuildContext({ shotspotter: true }, { shotspotter: true });
    const where = buildFastPathSupplementalPredicates(ctx, {});
    const clause = where.find(
      (w) => w.includes('surveillance_detections') && w.includes('SHOTSPOTTER_SENSOR')
    );
    expect(clause).toBeDefined();
    expect(clause).toContain('EXISTS');
    expect(clause).toContain('sd.bssid = ne.bssid');
    expect(ctx.getAppliedFilters().map((f) => f.field)).toContain('shotspotter');
  });

  test('umbrella surveillance filter generates EXISTS subquery against surveillance_detections (no device_type filter)', () => {
    const ctx = new FilterBuildContext({ surveillance: true }, { surveillance: true });
    const where = buildFastPathSupplementalPredicates(ctx, {});
    const clause = where.find(
      (w) => w.includes('surveillance_detections') && !w.includes('device_type')
    );
    expect(clause).toBeDefined();
    expect(clause).toContain('EXISTS');
    expect(clause).toContain('sd.bssid = ne.bssid');
    expect(ctx.getAppliedFilters().map((f) => f.field)).toContain('surveillance');
  });

  test('flock filter does not query network_tags', () => {
    const ctx = new FilterBuildContext({ flock: true }, { flock: true });
    const where = buildFastPathSupplementalPredicates(ctx, {});
    expect(where.some((w) => w.includes('network_tags'))).toBe(false);
  });

  test('flock filter disabled when enabled flag is false', () => {
    const ctx = new FilterBuildContext({ flock: true }, { flock: false });
    const where = buildFastPathSupplementalPredicates(ctx, {});
    expect(where.some((w) => w.includes('FLOCK_SAFETY_CAMERA'))).toBe(false);
  });
});
