/**
 * Stage 1 structural role lock for
 * client/src/components/geospatial/hooks/useNetworkContextMenu.ts.
 *
 * This stateful API/UI hook has no direct focused behavioral suite. The
 * existing useGeospatialOverlayOrchestration test preserves composition via
 * contextMenuState, but not this hook's complete public return surface.
 *
 * Scope: public export and returned values only. Inputs, imports, private
 * helpers, and implementation choices deliberately remain unconstrained for
 * Stage 2 extraction.
 */

export {};

import fs from 'fs';
import path from 'path';

describe('useNetworkContextMenu hook structure — Stage 1 role lock', () => {
  const filePath = path.resolve(
    process.cwd(),
    'client/src/components/geospatial/hooks/useNetworkContextMenu.ts'
  );
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(filePath, 'utf8');
  });

  test('exports useNetworkContextMenu as the sole named export', () => {
    expect(source).toContain('export const useNetworkContextMenu = ({');
    const exportLines = source.split('\n').filter((line) => line.startsWith('export '));
    expect(exportLines).toHaveLength(1);
  });

  test('returns the complete public context-menu control surface', () => {
    const returnStart = source.indexOf('  return {\n    contextMenu,');
    const returnEnd = source.indexOf('\n  };', returnStart);
    expect(returnStart).toBeGreaterThanOrEqual(0);
    expect(returnEnd).toBeGreaterThan(returnStart);
    const returnBlock = source.slice(returnStart, returnEnd);
    const expectedReturnKeys = [
      'contextMenu',
      'tagLoading',
      'contextMenuRef',
      'handleTagAction',
      'closeContextMenu',
      'openContextMenu',
      'handleGenerateThreatReportPdf',
      'wigleLookupDialog',
      'setWigleLookupDialog',
      'closeWigleLookupDialog',
      'handleWigleLookup',
      'wigleObservations',
      'loadWigleObservations',
      'loadBatchWigleObservations',
      'clearWigleObservations',
    ];

    expectedReturnKeys.forEach((key) => {
      expect(returnBlock).toMatch(new RegExp(`\\n    ${key}\\s*[:,}]`));
    });
  });
});
