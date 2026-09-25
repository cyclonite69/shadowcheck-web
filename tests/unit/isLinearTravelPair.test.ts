export {};

/**
 * Unit tests for is_linear_travel_pair() SQL function logic.
 *
 * The function returns true when a consecutive observation pair is consistent
 * with a device simply driving past (not surveilling). Mirrors the SQL CASE logic
 * exactly so correctness can be verified without a database.
 */
function isLinearTravelPair(
  distanceM: number,
  timeDeltaS: number,
  thresholdM = 500,
  speedMinKmh = 5,
  speedMaxKmh = 80
): boolean {
  if (timeDeltaS <= 0) {
    return false;
  } // identical/reversed timestamps
  if (distanceM === 0) {
    return false;
  } // stationary point
  if (distanceM > thresholdM) {
    return false;
  } // outside gate window
  const speedKmh = distanceM / 1000 / (timeDeltaS / 3600);
  return speedKmh >= speedMinKmh && speedKmh <= speedMaxKmh;
}

describe('isLinearTravelPair', () => {
  describe('gated pairs (returns true)', () => {
    it('300m in 30s → ~36 km/h, within [5, 80]', () => {
      // 300m / 1000 = 0.3 km; 30s / 3600 = 0.00833h; speed = 0.3 / 0.00833 ≈ 36 km/h
      expect(isLinearTravelPair(300, 30)).toBe(true);
    });

    it('500m in 45s → ~40 km/h, exactly at threshold boundary', () => {
      expect(isLinearTravelPair(500, 45)).toBe(true);
    });
  });

  describe('non-gated pairs (returns false)', () => {
    it('300m in 28800s (8 hours) → ~0.0375 km/h, below speed_min', () => {
      // Parked device that was observed twice same location over 8 hours
      expect(isLinearTravelPair(300, 28800)).toBe(false);
    });

    it('600m apart → exceeds 500m distance threshold', () => {
      // Even at 36 km/h, the gate rejects because distance > threshold_m
      expect(isLinearTravelPair(600, 60)).toBe(false);
    });

    it('0m distance → stationary, not a drive-by', () => {
      expect(isLinearTravelPair(0, 30)).toBe(false);
    });

    it('time_delta_s = 0 → identical timestamps, skip speed calc', () => {
      expect(isLinearTravelPair(300, 0)).toBe(false);
    });

    it('negative time_delta_s → reversed timestamps', () => {
      expect(isLinearTravelPair(300, -10)).toBe(false);
    });

    it('300m in 3s → ~360 km/h, above speed_max', () => {
      // Implausibly fast — not a normal vehicle drive-by
      expect(isLinearTravelPair(300, 3)).toBe(false);
    });
  });

  describe('custom threshold overrides', () => {
    it('respects custom distance_threshold_m', () => {
      // 450m at 36 km/h would normally pass, but custom threshold of 400 rejects it
      expect(isLinearTravelPair(450, 45, 400)).toBe(false);
      expect(isLinearTravelPair(350, 45, 400)).toBe(true);
    });

    it('respects custom speed bounds', () => {
      // 300m in 30s = 36 km/h; tighten speed range to [40, 80] → fails
      expect(isLinearTravelPair(300, 30, 500, 40, 80)).toBe(false);
      // Widen lower bound to 30 → passes
      expect(isLinearTravelPair(300, 30, 500, 30, 80)).toBe(true);
    });
  });
});
