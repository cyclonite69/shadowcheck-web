/**
 * Characterization lock test for
 * client/src/components/geospatial/hooks/useCoreObservationLayers.ts
 *
 * Scope (Stage 1 — names and structure only):
 *   - Verifies the hook is exported and accepts the correct prop keys.
 *   - Verifies key internal functions exist by name.
 *   - Does NOT test runtime behavior or layer output (no existing behavioral
 *     test exists for this hook).
 *   - Does NOT verify function signatures or return types.
 *
 * The hook is a pure side-effect hook: it manages Mapbox observation sources
 * and layers via useEffect and returns nothing.
 *
 * AST function count: 19 (hook arrow + 2 useEffect callbacks + forEach/map/
 * reduce/filter inline arrows + named internals: formatTimeSince,
 * calculateJitterOffset, syncObservationSources, handleStyleLoad).
 *
 * Stage 1 Batch D — role lock only. Extraction deferred to Stage 2.
 */

export {};

import fs from 'fs';
import path from 'path';

describe('useCoreObservationLayers hook structure — Stage 1 role lock', () => {
  const filePath = path.resolve(
    process.cwd(),
    'client/src/components/geospatial/hooks/useCoreObservationLayers.ts'
  );
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(filePath, 'utf8');
  });

  test('exports useCoreObservationLayers as the sole named export', () => {
    expect(source).toContain('export const useCoreObservationLayers = (');
    // No other top-level exports — types are module-internal
    const exportLines = source.split('\n').filter((l) => l.startsWith('export '));
    expect(exportLines).toHaveLength(1);
  });

  test('accepts the expected CoreObservationLayerProps keys', () => {
    expect(source).toContain('mapReady');
    expect(source).toContain('mapRef');
    expect(source).toContain('mapboxRef');
    expect(source).toContain('mapStyle');
    expect(source).toContain('activeObservationSets');
    expect(source).toContain('networkLookup');
    expect(source).toContain('isViewportLocked');
  });

  test('contains the key named internal functions', () => {
    // Module-level helper (not exported)
    expect(source).toContain('const formatTimeSince =');
    // Inner function inside the main useEffect
    expect(source).toContain('const calculateJitterOffset =');
    expect(source).toContain('const syncObservationSources =');
    expect(source).toContain('const handleStyleLoad =');
  });

  test('depends on the expected utility imports', () => {
    expect(source).toContain('import { macColor, frequencyToChannel }');
    expect(source).toContain('import { buildObservationTooltipProps }');
    expect(source).toContain('import { fitBoundsWithZoomInset }');
  });
});
