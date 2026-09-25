import wigleRouter from '../../../../../../server/src/api/routes/v1/wigle/index';

describe('WiGLE Routes Main Router', () => {
  it('should be an express router', () => {
    expect(wigleRouter).toBeDefined();
    // In express, routers are functions with a 'use' method.
    expect(typeof wigleRouter).toBe('function');
    expect(wigleRouter.name).toBe('router');
  });

  it('should have mounted the sub-routers', () => {
    // The router's stack should contain layers for each mounted sub-router.
    expect(wigleRouter.stack).toBeDefined();
    expect(Array.isArray(wigleRouter.stack)).toBe(true);
    // Since there are 9 router.use calls in index.ts, the stack should have at least 9 layers.
    expect(wigleRouter.stack.length).toBeGreaterThanOrEqual(9);
  });
});
