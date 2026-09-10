/**
 * Structural lock supplement for
 * client/src/components/geospatial/hooks/useMapLayers.ts
 *
 * The existing behavioral test (tests/unit/useMapLayers.test.ts) verifies
 * that addBaseSourcesAndLayers correctly registers sources and layers on a
 * mock Mapbox map. That test is preserved and untouched.
 *
 * This supplement locks what the behavioral test does not:
 *   - The hook's return surface (both exported callbacks)
 *   - The non-exported module-level helper (getNumericProperty)
 *   - The utility imports the hook depends on
 *
 * Scope (Stage 1 — names and structure only):
 *   - Does NOT verify function signatures, parameter types, or behavior.
 *   - Does NOT duplicate the behavioral coverage in useMapLayers.test.ts.
 *
 * Public contract:
 *   useMapLayers() — no props, returns { addBaseSourcesAndLayers, attachHoverHandlers }
 *
 * AST function count: 7 (hook arrow + addBaseSourcesAndLayers useCallback +
 * attachHoverHandlers useCallback + handleMouseEnter + handleMouseLeave +
 * getNumericProperty + one inline for-loop body arrow).
 *
 * Stage 1 Batch D — role lock only. Extraction deferred to Stage 2.
 */

export {};

import fs from 'fs';
import path from 'path';

describe('useMapLayers hook structure — Stage 1 role lock supplement', () => {
  const filePath = path.resolve(
    process.cwd(),
    'client/src/components/geospatial/hooks/useMapLayers.ts'
  );
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(filePath, 'utf8');
  });

  test('exports useMapLayers as the sole named export', () => {
    expect(source).toContain('export const useMapLayers = () => {');
    const exportLines = source.split('\n').filter((l) => l.startsWith('export '));
    expect(exportLines).toHaveLength(1);
  });

  test('hook returns both expected named callbacks', () => {
    // The return statement is the public contract — both names must survive extraction
    expect(source).toContain('return { addBaseSourcesAndLayers, attachHoverHandlers }');
  });

  test('defines addBaseSourcesAndLayers and attachHoverHandlers via useCallback', () => {
    expect(source).toContain('const addBaseSourcesAndLayers = useCallback(');
    expect(source).toContain('const attachHoverHandlers = useCallback(');
  });

  test('contains the non-exported module-level helper getNumericProperty', () => {
    expect(source).toContain('const getNumericProperty =');
  });

  test('imports the expected utilities from mapHelpers', () => {
    expect(source).toContain('calculateSignalRange');
    expect(source).toContain('createCirclePolygon');
    expect(source).toContain('macColor');
    expect(source).toContain('ensureHomeLocationLayers');
    expect(source).toContain("from '../../../utils/mapHelpers'");
  });
});
