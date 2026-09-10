/**
 * Stage 1 structural role lock for
 * client/src/components/geospatial/hooks/useMapStyleControls.ts.
 *
 * This Mapbox/browser-bound hook has no direct focused behavioral suite. The
 * existing useGeospatialExplorerState structural test preserves its consumer
 * composition and propagation of changeMapStyle, but not the hook's own
 * public return surface.
 *
 * Scope: public export and returned value only. Private helpers, imports,
 * parameters, and implementation choices deliberately remain unconstrained
 * for Stage 2 extraction.
 */

export {};

import fs from 'fs';
import path from 'path';

describe('useMapStyleControls hook structure — Stage 1 role lock', () => {
  const filePath = path.resolve(
    process.cwd(),
    'client/src/components/geospatial/hooks/useMapStyleControls.ts'
  );
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(filePath, 'utf8');
  });

  test('exports useMapStyleControls as the sole named export', () => {
    expect(source).toContain('export const useMapStyleControls = ({');
    const exportLines = source.split('\n').filter((line) => line.startsWith('export '));
    expect(exportLines).toHaveLength(1);
  });

  test('returns changeMapStyle as its public control surface', () => {
    expect(source).toContain('return { changeMapStyle }');
  });
});
