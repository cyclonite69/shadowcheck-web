import {
  shouldClearActiveJobId,
  validateClientBbox,
} from '../../../client/src/components/admin/tabs/alpr/ALPRSyncManagerTab';

describe('shouldClearActiveJobId', () => {
  it('keeps the tracked job while dispatched or running (fast-fail race)', () => {
    expect(shouldClearActiveJobId('dispatched')).toBe(false);
    expect(shouldClearActiveJobId('running')).toBe(false);
  });

  it('clears only on terminal completed/failed', () => {
    expect(shouldClearActiveJobId('completed')).toBe(true);
    expect(shouldClearActiveJobId('failed')).toBe(true);
  });
});

describe('validateClientBbox', () => {
  it('validates Genesee County MI custom bbox coordinates', () => {
    const res = validateClientBbox({
      west: '-83.95',
      south: '42.75',
      east: '-83.40',
      north: '43.25',
    });
    expect(res.valid).toBe(true);
    expect(res.bbox).toEqual([-83.95, 42.75, -83.4, 43.25]);
  });

  it('rejects when any coordinate is missing or empty', () => {
    const res = validateClientBbox({
      west: '',
      south: '42.75',
      east: '-83.40',
      north: '43.25',
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('All 4 coordinates');
  });

  it('rejects non-finite coordinate strings', () => {
    const res = validateClientBbox({
      west: 'not-a-number',
      south: '42.75',
      east: '-83.40',
      north: '43.25',
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('West longitude must be a valid finite number');
  });

  it('rejects degenerate bounding boxes', () => {
    const res = validateClientBbox({
      west: '-83.95',
      south: '42.75',
      east: '-83.95',
      north: '43.25',
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Degenerate bounding box');
  });

  it('rejects inverted bounding boxes', () => {
    const res = validateClientBbox({
      west: '-83.95',
      south: '43.25',
      east: '-83.40',
      north: '42.75',
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('South latitude must be strictly less than North latitude');
  });

  it('rejects out of bounds latitude', () => {
    const res = validateClientBbox({
      west: '-83.95',
      south: '-95',
      east: '-83.40',
      north: '43.25',
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('South latitude must be between -90 and 90 degrees');
  });

  it('rejects areas exceeding 2.25 deg²', () => {
    const res = validateClientBbox({
      west: '-84.6',
      south: '41.0',
      east: '-83.0',
      north: '42.5',
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('exceeds maximum allowed ceiling of 2.25 deg²');
  });

  it('rejects latitude spans exceeding 1.5 deg', () => {
    const res = validateClientBbox({
      west: '-83.9',
      south: '41.0',
      east: '-83.4',
      north: '42.6',
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('exceeds maximum allowed span of 1.5°');
  });

  it('rejects longitude spans exceeding 1.8 deg', () => {
    const res = validateClientBbox({
      west: '-85.0',
      south: '42.0',
      east: '-83.0',
      north: '42.5',
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('exceeds maximum allowed span of 1.8°');
  });
});
