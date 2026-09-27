import {
  validateAndNormalizeBbox,
  validateBboxCoordinates,
  BboxValidationError,
  MAX_BBOX_AREA_DEG2,
  MAX_LAT_SPAN_DEG,
  MAX_LON_SPAN_DEG,
} from '../../../src/alpr/bboxValidation';

describe('bboxValidation', () => {
  describe('validateAndNormalizeBbox', () => {
    it('accepts valid Genesee County MI bbox and normalizes to Bbox object', () => {
      const result = validateAndNormalizeBbox([-83.95, 42.75, -83.4, 43.25]);
      expect(result).toEqual({
        west: -83.95,
        south: 42.75,
        east: -83.4,
        north: 43.25,
      });

      const latSpan = result.north - result.south;
      const lonSpan = result.east - result.west;
      const area = latSpan * lonSpan;
      expect(area).toBeCloseTo(0.275, 4);
      expect(area).toBeLessThan(MAX_BBOX_AREA_DEG2);
    });

    it('accepts valid object format', () => {
      const result = validateAndNormalizeBbox({
        west: -83.95,
        south: 42.75,
        east: -83.4,
        north: 43.25,
      });
      expect(result).toEqual({
        west: -83.95,
        south: 42.75,
        east: -83.4,
        north: 43.25,
      });
    });

    it('accepts valid comma-separated string format', () => {
      const result = validateAndNormalizeBbox('-83.95, 42.75, -83.40, 43.25');
      expect(result).toEqual({
        west: -83.95,
        south: 42.75,
        east: -83.4,
        north: 43.25,
      });
    });

    it('accepts largest predefined metro region (Bay Area)', () => {
      const result = validateAndNormalizeBbox([-123.0, 37.1, -121.5, 38.3]);
      expect(result).toEqual({
        west: -123.0,
        south: 37.1,
        east: -121.5,
        north: 38.3,
      });
      const area = (38.3 - 37.1) * (-121.5 - -123.0);
      expect(area).toBeCloseTo(1.8, 3);
      expect(area).toBeLessThanOrEqual(MAX_BBOX_AREA_DEG2);
    });

    it('rejects null or undefined', () => {
      expect(() => validateAndNormalizeBbox(null)).toThrow(BboxValidationError);
      expect(() => validateAndNormalizeBbox(undefined)).toThrow(BboxValidationError);
    });

    it('rejects arrays with length !== 4', () => {
      expect(() => validateAndNormalizeBbox([-83.95, 42.75, -83.4])).toThrow(
        'Bounding box array must contain exactly 4 coordinates'
      );
      expect(() => validateAndNormalizeBbox([-83.95, 42.75, -83.4, 43.25, 10])).toThrow(
        'Bounding box array must contain exactly 4 coordinates'
      );
    });

    it('rejects non-finite coordinates (NaN)', () => {
      expect(() => validateAndNormalizeBbox([NaN, 42.75, -83.4, 43.25])).toThrow(
        "Bounding box coordinate 'west' must be a finite number"
      );
      expect(() => validateAndNormalizeBbox([-83.95, 'not-a-number', -83.4, 43.25])).toThrow(
        "Bounding box coordinate 'south' must be a finite number"
      );
    });

    it('rejects non-finite coordinates (Infinity and -Infinity)', () => {
      expect(() => validateAndNormalizeBbox([Infinity, 42.75, -83.4, 43.25])).toThrow(
        "Bounding box coordinate 'west' must be a finite number"
      );
      expect(() => validateAndNormalizeBbox([-83.95, -Infinity, -83.4, 43.25])).toThrow(
        "Bounding box coordinate 'south' must be a finite number"
      );
      expect(() => validateAndNormalizeBbox([-83.95, 42.75, Infinity, 43.25])).toThrow(
        "Bounding box coordinate 'east' must be a finite number"
      );
      expect(() => validateAndNormalizeBbox([-83.95, 42.75, -83.4, -Infinity])).toThrow(
        "Bounding box coordinate 'north' must be a finite number"
      );
    });

    it('rejects latitude outside [-90, 90]', () => {
      expect(() => validateAndNormalizeBbox([-83.95, -95, -83.4, 43.25])).toThrow(
        'South latitude must be between -90 and 90 degrees'
      );
      expect(() => validateAndNormalizeBbox([-83.95, 42.75, -83.4, 95])).toThrow(
        'North latitude must be between -90 and 90 degrees'
      );
    });

    it('rejects longitude outside [-180, 180]', () => {
      expect(() => validateAndNormalizeBbox([-185, 42.75, -83.4, 43.25])).toThrow(
        'West longitude must be between -180 and 180 degrees'
      );
      expect(() => validateAndNormalizeBbox([-83.95, 42.75, 185, 43.25])).toThrow(
        'East longitude must be between -180 and 180 degrees'
      );
    });

    it('rejects degenerate bounding boxes (south === north)', () => {
      expect(() => validateAndNormalizeBbox([-83.95, 42.75, -83.4, 42.75])).toThrow(
        'Degenerate bounding box: south and north latitude are identical'
      );
    });

    it('rejects degenerate bounding boxes (west === east)', () => {
      expect(() => validateAndNormalizeBbox([-83.95, 42.75, -83.95, 43.25])).toThrow(
        'Degenerate bounding box: west and east longitude are identical'
      );
    });

    it('rejects inverted bounding boxes (south > north)', () => {
      expect(() => validateAndNormalizeBbox([-83.95, 43.25, -83.4, 42.75])).toThrow(
        'South latitude (43.25) must be strictly less than north latitude (42.75)'
      );
    });

    it('rejects inverted bounding boxes (west > east)', () => {
      expect(() => validateAndNormalizeBbox([-83.4, 42.75, -83.95, 43.25])).toThrow(
        'West longitude (-83.4) must be strictly less than east longitude (-83.95)'
      );
    });

    it('rejects bounding boxes exceeding max area ceiling (2.25 deg²)', () => {
      // 1.6 lon (<= 1.8) * 1.5 lat (<= 1.5) = 2.4 deg² > 2.25 deg²
      expect(() => validateAndNormalizeBbox([-84.6, 41.0, -83.0, 42.5])).toThrow(
        /Bounding box area .* exceeds maximum allowed ceiling of 2.25 deg²/
      );
    });

    it('rejects latitude span exceeding max limit (1.5 deg)', () => {
      // deltaLon = 0.5, deltaLat = 1.6 -> area = 0.8 < 2.25, but deltaLat > 1.5
      expect(() => validateAndNormalizeBbox([-83.9, 41.0, -83.4, 42.6])).toThrow(
        `Latitude span (1.6000°) exceeds maximum allowed span of ${MAX_LAT_SPAN_DEG}°`
      );
    });

    it('rejects longitude span exceeding max limit (1.8 deg)', () => {
      // deltaLon = 2.0, deltaLat = 0.5 -> area = 1.0 < 2.25, but deltaLon > 1.8
      expect(() => validateAndNormalizeBbox([-85.0, 42.0, -83.0, 42.5])).toThrow(
        `Longitude span (2.0000°) exceeds maximum allowed span of ${MAX_LON_SPAN_DEG}°`
      );
    });
  });

  describe('validateBboxCoordinates', () => {
    it('passes on valid finite Bbox object', () => {
      expect(() =>
        validateBboxCoordinates({
          west: -83.95,
          south: 42.75,
          east: -83.4,
          north: 43.25,
        })
      ).not.toThrow();
    });

    it('throws on non-object', () => {
      expect(() => validateBboxCoordinates(null)).toThrow(BboxValidationError);
      expect(() => validateBboxCoordinates('invalid')).toThrow(BboxValidationError);
    });

    it('throws on non-finite coordinates', () => {
      expect(() =>
        validateBboxCoordinates({
          west: NaN,
          south: 42.75,
          east: -83.4,
          north: 43.25,
        })
      ).toThrow("Bounding box coordinate 'west' must be a finite number");

      expect(() =>
        validateBboxCoordinates({
          west: -83.95,
          south: Infinity,
          east: -83.4,
          north: 43.25,
        })
      ).toThrow("Bounding box coordinate 'south' must be a finite number");
    });
  });
});
