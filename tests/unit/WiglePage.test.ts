import fs from 'fs';
import path from 'path';

describe('WiglePage component structure', () => {
  const filePath = path.resolve(process.cwd(), 'client/src/components/WiglePage.tsx');
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(filePath, 'utf8');
  });

  test('imports all required sub-components and hooks', () => {
    // Component imports
    expect(source).toContain("import { AppHeader } from './AppHeader'");
    expect(source).toContain("import { WigleControlPanel } from './WigleControlPanel'");
    expect(source).toContain("import { FilterPanelContainer } from './FilterPanelContainer'");
    expect(source).toContain("import { WigleMap } from './WigleMap'");

    // Hook imports
    const expectedHooks = [
      'usePageFilters',
      'useFilterURLSync',
      'useAdaptedFilters',
      'useAgencyOffices',
      'useFederalCourthouses',
      'useDeflockCameras',
      'useAlprCameras',
      'useShotspotterZones',
      'useShotspotterSensors',
      'useWigleLayers',
      'useWigleData',
      'useWigleClusterLayers',
      'useWigleKmlData',
      'useWigleFieldData',
      'useWigleMapInit',
      'useWigleDataSync',
      'useWigleAutoFetch',
      'useWigleMapFeatures',
      'useWigleResize',
      'useHomeLocationLayer',
    ];

    expectedHooks.forEach((hookName) => {
      expect(source).toContain(hookName);
    });

    // Helper/API imports
    expect(source).toContain("import { locationApi } from '../api/locationApi'");
    expect(source).toContain('rowsToGeoJSON');
    expect(source).toContain('kmlRowsToGeoJSON');
  });

  test('declares all expected local states', () => {
    expect(source).toContain('useState<number | null>(DEFAULT_LIMIT)');
    expect(source).toContain('useState(false)'); // for mapReady
    expect(source).toContain("useState<'idle' | 'ok' | 'error'>('idle')"); // for tokenStatus
    expect(source).toContain('useState({ width: 0, height: 0 })'); // for mapSize
    expect(source).toContain('useState(false)'); // for tilesReady
    expect(source).toContain('useState(false)'); // for showFilters
    expect(source).toContain('useState(5)'); // for pointSize
    expect(source).toContain('useState<string | null>(null)'); // for mapError / setError
    expect(source).toContain('useState(false)'); // for showMenu
    expect(source).toContain('useState(true)'); // for clusteringEnabled
  });

  test('wires components correctly in the render JSX block', () => {
    // Child components markup check
    expect(source).toContain('<AppHeader');
    expect(source).toContain('<WigleControlPanel');
    expect(source).toContain('<FilterPanelContainer');
    expect(source).toContain('<WigleMap');

    // Props checks
    expect(source).toContain('layers={layers}');
    expect(source).toContain('onToggleLayer={toggleLayer}');
    expect(source).toContain('mapReady={mapReady}');
    expect(source).toContain('adaptedFilters={adaptedFilters}');
  });
});
