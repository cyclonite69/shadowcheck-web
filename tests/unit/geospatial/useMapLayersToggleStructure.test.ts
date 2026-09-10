/**
 * Stage 1 structural role lock for
 * client/src/components/geospatial/hooks/useMapLayersToggle.ts.
 *
 * Source and consumer inspection found no direct focused behavioral test for
 * this Mapbox-bound hook. The existing useGeospatialExplorerState structural
 * test verifies that it remains composed into the explorer state hook, but it
 * does not preserve this hook's own public return surface.
 *
 * Scope: public export and returned values only. Private helpers, imports,
 * parameters, and implementation choices deliberately remain unconstrained
 * for Stage 2 extraction.
 */

export {};

import fs from 'fs';
import path from 'path';

describe('useMapLayersToggle hook structure — Stage 1 role lock', () => {
  const filePath = path.resolve(
    process.cwd(),
    'client/src/components/geospatial/hooks/useMapLayersToggle.ts'
  );
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(filePath, 'utf8');
  });

  test('exports useMapLayersToggle as the sole named export', () => {
    expect(source).toContain('export const useMapLayersToggle = ({');
    const exportLines = source.split('\n').filter((line) => line.startsWith('export '));
    expect(exportLines).toHaveLength(1);
  });

  test('returns the complete public map-layer control surface', () => {
    expect(source).toContain(
      'return { toggle3DBuildings, toggleTerrain, add3DBuildings, addTerrain, is3DBuildingsAvailable }'
    );
  });
});
