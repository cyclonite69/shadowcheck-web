export {};

import {
  applyLocationFilters,
  applySecurityAndRadioFilters,
  applyTextAndRangeFilters,
} from '../../server/src/services/networking/filterBuilders';
import { createNetworkQueryState } from '../../server/src/services/networking/queryState';

describe('network filter builders coverage expansion', () => {
  describe('applyLocationFilters', () => {
    it('handles weighted_centroid mode', () => {
      const state = createNetworkQueryState([], []);
      applyLocationFilters(state, {
        locationMode: 'weighted_centroid',
        bboxMinLat: null,
        bboxMaxLat: null,
        bboxMinLng: null,
        bboxMaxLng: null,
        radiusCenterLat: null,
        radiusCenterLng: null,
        radiusMeters: null,
      });
      expect(state.joins[0]).toContain('weighted_lat AS lat');
    });

    it('handles triangulated mode', () => {
      const state = createNetworkQueryState([], []);
      applyLocationFilters(state, {
        locationMode: 'triangulated',
        bboxMinLat: null,
        bboxMaxLat: null,
        bboxMinLng: null,
        bboxMaxLng: null,
        radiusCenterLat: null,
        radiusCenterLng: null,
        radiusMeters: null,
      });
      expect(state.joins[0]).toContain('triangulated_lat AS lat');
    });

    it('handles latest_observation mode with bbox', () => {
      const state = createNetworkQueryState([], []);
      applyLocationFilters(state, {
        locationMode: 'latest_observation',
        bboxMinLat: 1,
        bboxMaxLat: 2,
        bboxMinLng: 3,
        bboxMaxLng: 4,
        radiusCenterLat: null,
        radiusCenterLng: null,
        radiusMeters: null,
      });
      expect(state.conditions[0]).toContain('ne.lat BETWEEN');
      expect(state.conditions[1]).toContain('ne.lon BETWEEN');
      expect(state.joins.length).toBe(0);
    });

    it('skips location filters when params are null', () => {
      const state = createNetworkQueryState([], []);
      applyLocationFilters(state, {
        locationMode: 'latest_observation',
        bboxMinLat: null,
        bboxMaxLat: 2,
        bboxMinLng: 3,
        bboxMaxLng: 4,
        radiusCenterLat: 5,
        radiusCenterLng: null,
        radiusMeters: 7,
      });
      expect(state.conditions.length).toBe(0);
      expect(state.joins.length).toBe(0);
    });
  });

  describe('applySecurityAndRadioFilters', () => {
    it('handles empty or missing filters', () => {
      const state = createNetworkQueryState([], []);
      applySecurityAndRadioFilters(
        state,
        {
          radioTypes: [],
          encryptionTypes: [],
          authMethods: [],
          insecureFlags: [],
          securityFlags: [],
        },
        { typeExpr: 'type_expr' }
      );
      expect(state.conditions.length).toBe(0);
      expect(state.appliedFilters.length).toBe(0);
    });

    it('handles null filters (if passed despite types)', () => {
      const state = createNetworkQueryState([], []);
      // @ts-ignore
      applySecurityAndRadioFilters(
        state,
        {
          radioTypes: null,
          encryptionTypes: null,
          authMethods: null,
          insecureFlags: null,
          securityFlags: null,
        },
        { typeExpr: 'type_expr' }
      );
      expect(state.conditions.length).toBe(0);
    });

    it('handles empty arrays for filters', () => {
      const state = createNetworkQueryState([], []);
      applySecurityAndRadioFilters(
        state,
        {
          radioTypes: [],
          encryptionTypes: [],
          authMethods: [],
          insecureFlags: [],
          securityFlags: [],
        },
        { typeExpr: 'type_expr' }
      );
      expect(state.conditions.length).toBe(0);
    });

    it('handles various encryption types to trigger more branches in expressions', () => {
      const state = createNetworkQueryState([], []);
      applySecurityAndRadioFilters(
        state,
        {
          radioTypes: ['WIFI'],
          encryptionTypes: ['OPEN', 'WEP', 'WPA', 'WPA2', 'WPA3', 'OWE', 'SAE', 'UNKNOWN'],
          authMethods: ['NONE', 'PSK'],
          insecureFlags: ['WEP'],
          securityFlags: ['WPS'],
        },
        { typeExpr: 'type_expr' }
      );

      expect(state.appliedFilters.length).toBe(5);
      // Verify multiple encryption branches were hit
      const encCondition = state.conditions.find((c) => c.includes('ne.security'));
      expect(encCondition).toContain('ne.security IS NULL'); // OPEN
      expect(encCondition).toContain('ILIKE $'); // WEP, WPA, etc.
      expect(encCondition).toContain('~* $'); // OWE, SAE
    });
  });

  describe('applyTextAndRangeFilters', () => {
    it('handles all range filter combinations (min only, max only, both)', () => {
      const state = createNetworkQueryState([], []);
      applyTextAndRangeFilters(
        state,
        {
          ssidPattern: null,
          bssidList: null,
          threatLevel: null,
          threatCategories: null,
          threatScoreMin: 50,
          threatScoreMax: null,
          lastSeen: null,
          distanceFromHomeKm: null,
          distanceFromHomeMinKm: null,
          distanceFromHomeMaxKm: 10,
          minSignal: null,
          maxSignal: -30,
          minObsCount: 5,
          maxObsCount: null,
          manufacturer: null,
          quickSearchPattern: null,
        },
        {
          threatLevelExpr: 'tl',
          threatScoreExpr: 'ts',
          distanceExpr: 'de',
        }
      );

      expect(state.conditions).toContain('ts >= $1');
      expect(state.conditions).toContain('(de) <= $2');
      expect(state.conditions).toContain('ne.signal <= $3');
      expect(state.conditions).toContain('ne.observations >= $4');

      const threatScoreFilter = state.appliedFilters.find((f) => f.column === 'threatScore');
      expect(threatScoreFilter?.range).toEqual([50, 100]);

      const distanceFilter = state.appliedFilters.find((f) => f.column === 'distanceFromHome');
      expect(distanceFilter?.range).toEqual([0, 10]);

      const rssiFilter = state.appliedFilters.find((f) => f.column === 'rssi');
      expect(rssiFilter?.range).toEqual([-100, -30]);

      const obsCountFilter = state.appliedFilters.find((f) => f.column === 'obsCount');
      expect(obsCountFilter?.range).toEqual([5, 1000000]);
    });

    it('handles distanceFromHomeKm specifically', () => {
      const state = createNetworkQueryState([], []);
      applyTextAndRangeFilters(
        state,
        {
          ssidPattern: null,
          bssidList: null,
          threatLevel: null,
          threatCategories: null,
          threatScoreMin: null,
          threatScoreMax: null,
          lastSeen: null,
          distanceFromHomeKm: 5,
          distanceFromHomeMinKm: null,
          distanceFromHomeMaxKm: null,
          minSignal: null,
          maxSignal: null,
          minObsCount: null,
          maxObsCount: null,
          manufacturer: null,
          quickSearchPattern: null,
        },
        {
          threatLevelExpr: 'tl',
          threatScoreExpr: 'ts',
          distanceExpr: 'de',
        }
      );

      expect(state.conditions).toContain('(de) <= $1');
      const distanceFilter = state.appliedFilters.find((f) => f.column === 'distanceFromHome');
      expect(distanceFilter?.range).toEqual([0, 5]);
    });

    it('handles quickSearchPattern and manufacturer', () => {
      const state = createNetworkQueryState([], []);
      applyTextAndRangeFilters(
        state,
        {
          ssidPattern: null,
          bssidList: null,
          threatLevel: null,
          threatCategories: null,
          threatScoreMin: null,
          threatScoreMax: null,
          lastSeen: null,
          distanceFromHomeKm: null,
          distanceFromHomeMinKm: null,
          distanceFromHomeMaxKm: null,
          minSignal: null,
          maxSignal: null,
          minObsCount: null,
          maxObsCount: null,
          manufacturer: 'Apple',
          quickSearchPattern: 'Office',
        },
        {
          threatLevelExpr: 'tl',
          threatScoreExpr: 'ts',
          distanceExpr: 'de',
        }
      );

      expect(state.conditions.some((c) => c.includes('OR ne.bssid ILIKE'))).toBe(true);
      expect(state.conditions).toContain('ne.manufacturer ILIKE $2');
      expect(state.params).toContain('%Office%');
      expect(state.params).toContain('%Apple%');
    });

    it('handles threatLevel and threatCategories', () => {
      const state = createNetworkQueryState([], []);
      applyTextAndRangeFilters(
        state,
        {
          ssidPattern: null,
          bssidList: null,
          threatLevel: 'LOW',
          threatCategories: ['LOW', 'MED'],
          threatScoreMin: null,
          threatScoreMax: null,
          lastSeen: null,
          distanceFromHomeKm: null,
          distanceFromHomeMinKm: null,
          distanceFromHomeMaxKm: null,
          minSignal: null,
          maxSignal: null,
          minObsCount: null,
          maxObsCount: null,
          manufacturer: null,
          quickSearchPattern: null,
        },
        {
          threatLevelExpr: 'tl',
          threatScoreExpr: 'ts',
          distanceExpr: 'de',
        }
      );

      expect(state.conditions).toContain('(tl) = $1');
      expect(state.conditions).toContain('(tl) = ANY($2::text[])');
    });

    it('skips text and range filters when params are empty or null', () => {
      const state = createNetworkQueryState([], []);
      applyTextAndRangeFilters(
        state,
        {
          ssidPattern: null,
          bssidList: [],
          threatLevel: null,
          threatCategories: [],
          threatScoreMin: null,
          threatScoreMax: null,
          lastSeen: null,
          distanceFromHomeKm: null,
          distanceFromHomeMinKm: null,
          distanceFromHomeMaxKm: null,
          minSignal: null,
          maxSignal: null,
          minObsCount: null,
          maxObsCount: null,
          manufacturer: null,
          quickSearchPattern: null,
        },
        {
          threatLevelExpr: 'tl',
          threatScoreExpr: 'ts',
          distanceExpr: 'de',
        }
      );
      expect(state.conditions.length).toBe(0);
      expect(state.appliedFilters.length).toBe(0);
    });
  });
});
