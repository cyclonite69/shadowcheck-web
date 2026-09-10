/**
 * Stage 2 structural role lock for
 * client/src/components/geospatial/hooks/useObservationPointContextMenu.ts.
 *
 * The core-observation context-menu listener is intentionally separate from
 * WiGLE-layer interaction wiring. This test locks its source-layer identity,
 * paired rebind, and cleanup lifecycle without requiring Mapbox in JSDOM.
 */

export {};

import fs from 'fs';
import path from 'path';

describe('useObservationPointContextMenu hook structure — Stage 2 role lock', () => {
  const filePath = path.resolve(
    process.cwd(),
    'client/src/components/geospatial/hooks/useObservationPointContextMenu.ts'
  );
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(filePath, 'utf8');
  });

  test('exports the core-observation context-menu hook as its sole named export', () => {
    expect(source).toContain('export const useObservationPointContextMenu = ({');
    const exportLines = source.split('\n').filter((line) => line.startsWith('export '));
    expect(exportLines).toHaveLength(1);
  });

  test('binds and cleans up the observation-points context-menu handler', () => {
    const binding = "map.off('contextmenu', 'observation-points', handleContextMenu);";
    const registration = "map.on('contextmenu', 'observation-points', handleContextMenu);";

    expect(source).toContain(binding);
    expect(source).toContain(registration);
    expect(
      source.match(/map\.off\('contextmenu', 'observation-points', handleContextMenu\);/g)
    ).toHaveLength(3);
  });

  test('keeps the callback and network lookup current without WiGLE dependencies', () => {
    expect(source).toContain('const onOpenContextMenuRef = useRef(onOpenContextMenu);');
    expect(source).toContain('const networkLookupRef = useRef(networkLookup);');
    expect(source).toContain('onOpenContextMenuRef.current(mockEvent, network);');
    expect(source).not.toMatch(/wigle/i);
  });
});
