jest.mock('../../client/src/api/networkApi', () => ({
  networkApi: {
    getNetworkTags: jest.fn(),
    getNetworkNotes: jest.fn(),
  },
}));

import { calculateContextMenuPlacement } from '../../client/src/components/geospatial/contextMenuUtils';

describe('calculateContextMenuPlacement', () => {
  const originalWindow = (global as any).window;

  beforeEach(() => {
    (global as any).window = {
      innerHeight: 800,
      innerWidth: 1200,
    };
  });

  afterAll(() => {
    (global as any).window = originalWindow;
  });

  it('clamps the menu to the top padding when opening above near the viewport edge', () => {
    const placement = calculateContextMenuPlacement(
      { clientX: 300, clientY: 120 } as any,
      200,
      440,
      10
    );

    expect(placement.y).toBeGreaterThanOrEqual(10);
  });

  it('keeps the menu fully within the viewport height when opening near the bottom', () => {
    const placement = calculateContextMenuPlacement(
      { clientX: 300, clientY: 780 } as any,
      200,
      440,
      10
    );

    expect(placement.y).toBe(340);
    expect(placement.position).toBe('above');
  });
});
