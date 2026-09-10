/**
 * Structural lock supplement for
 * client/src/components/geospatial/hooks/useSiblingLinks.ts.
 *
 * The existing behavioral suite (tests/unit/useSiblingLinks.test.ts) covers
 * sibling graph loading, fallback calls, search grouping, and hydration
 * diagnostics. It does not assert the hook's returned public surface.
 *
 * Scope: public export and returned values only. Inputs, imports, graph
 * helpers, effects, and implementation choices remain unconstrained for
 * Stage 2 extraction.
 */

export {};

import fs from 'fs';
import path from 'path';

describe('useSiblingLinks hook structure — Stage 1 role lock supplement', () => {
  const filePath = path.resolve(
    process.cwd(),
    'client/src/components/geospatial/hooks/useSiblingLinks.ts'
  );
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(filePath, 'utf8');
  });

  test('exports useSiblingLinks as the sole named export', () => {
    expect(source).toContain('export const useSiblingLinks = ({');
    const exportLines = source.split('\n').filter((line) => line.startsWith('export '));
    expect(exportLines).toHaveLength(1);
  });

  test('returns the complete public sibling-link surface', () => {
    const returnStart = source.indexOf('  return {\n    linkedSiblingBssids,');
    const returnEnd = source.indexOf('\n  };', returnStart);
    expect(returnStart).toBeGreaterThanOrEqual(0);
    expect(returnEnd).toBeGreaterThan(returnStart);
    const returnBlock = source.slice(returnStart, returnEnd);
    const expectedReturnKeys = [
      'linkedSiblingBssids',
      'visibleSiblingGroupMap',
      'setLinkedSiblingBssids',
      'missingSiblingNetworks',
      'hydrationFailedBssids',
      'nonRenderableBssids',
      'missingDbBssids',
      'siblingHydrating',
    ];

    expectedReturnKeys.forEach((key) => {
      expect(returnBlock).toMatch(new RegExp(`\\n    ${key}\\s*[:,}]`));
    });
  });
});
