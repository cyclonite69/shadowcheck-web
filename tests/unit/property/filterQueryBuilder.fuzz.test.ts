import { UniversalFilterQueryBuilder } from '../../../server/src/services/filterQueryBuilder';
import fc from 'fast-check';

describe('UniversalFilterQueryBuilder Fuzz Tests', () => {
  const ssidArb = fc.string({ minLength: 1, maxLength: 32 });
  const bssidArb = fc.string({ minLength: 12, maxLength: 12 }).map((s: string) => {
    // Normalize to hex-like string for BSSID format testing
    const hex = s
      .split('')
      .map((c) => '0123456789abcdef'[c.charCodeAt(0) % 16])
      .join('');
    return hex.match(/.{2}/g)?.join(':') || hex;
  });
  const encryptionArb = fc.constantFrom('WPA2', 'WPA3', 'OPEN', 'WEP');
  const threatLevelArb = fc.constantFrom('low', 'medium', 'high');

  test('should generate valid parameterized SQL for random filters', () => {
    fc.assert(
      fc.property(
        ssidArb,
        bssidArb,
        encryptionArb,
        fc.boolean(), // negation
        (ssid, bssid, encryption, isNegated) => {
          const filter = {
            ssid,
            bssid,
            encryptionTypes: [encryption],
            negated: isNegated,
          } as any;
          const config = { ssid: true, bssid: true, encryptionTypes: true, negated: true } as any;
          const builder = new UniversalFilterQueryBuilder(filter, config);
          const result = builder.buildNetworkListQuery();

          expect(typeof result.sql).toBe('string');
          expect(result.sql.length).toBeGreaterThan(0);
          expect(result.sql).toContain('$');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle varying threat filters', () => {
    fc.assert(
      fc.property(
        threatLevelArb,
        fc.integer({ min: 0, max: 100 }),
        (threatCategory, threatScoreMin) => {
          const filter = {
            threatCategories: [threatCategory],
            threatScoreMin,
          } as any;
          const config = { threatCategories: true, threatScoreMin: true } as any;
          const builder = new UniversalFilterQueryBuilder(filter, config);
          const result = builder.buildNetworkListQuery();

          expect(result.sql).toContain('FROM');
          expect(result.params.length).toBeGreaterThan(0);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
