const stateMap: Record<number, any> = {};
let stateCallIndex = 0;

jest.mock('react', () => ({
  useState: (initial: any) => {
    const key = stateCallIndex++;
    if (!(key in stateMap)) {
      stateMap[key] = initial;
    }
    const setter = (val: any) => {
      stateMap[key] = typeof val === 'function' ? val(stateMap[key]) : val;
    };
    return [stateMap[key], setter];
  },
}));

import { useExplorerPanels } from '../../../client/src/components/geospatial/hooks/useExplorerPanels';

describe('useExplorerPanels hook', () => {
  beforeEach(() => {
    stateCallIndex = 0;
    for (const key of Object.keys(stateMap)) {
      delete stateMap[Number(key)];
    }
  });

  it('initializes with all panels closed, including ALPR cameras', () => {
    const result = useExplorerPanels();

    expect(result.filtersOpen).toBe(false);
    expect(result.showColumnSelector).toBe(false);
    expect(result.showAgenciesPanel).toBe(false);
    expect(result.showCourthousesPanel).toBe(false);
    expect(result.showAlprCameras).toBe(false);
  });

  it('toggles showAlprCameras on and off', () => {
    const result1 = useExplorerPanels();
    expect(result1.showAlprCameras).toBe(false);

    result1.toggleAlprCameras();

    stateCallIndex = 0;
    const result2 = useExplorerPanels();
    expect(result2.showAlprCameras).toBe(true);

    result2.toggleAlprCameras();

    stateCallIndex = 0;
    const result3 = useExplorerPanels();
    expect(result3.showAlprCameras).toBe(false);
  });
});
