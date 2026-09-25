const networkTagsRouter = require('../../../../../../server/src/api/routes/v1/network-tags/index');

describe('Network Tags Index Router', () => {
  it('should be an express router', () => {
    expect(networkTagsRouter).toBeDefined();
    expect(typeof networkTagsRouter).toBe('function');
    expect(networkTagsRouter.name).toBe('router');
  });

  it('should have mounted the sub-routers', () => {
    expect(networkTagsRouter.stack).toBeDefined();
    expect(Array.isArray(networkTagsRouter.stack)).toBe(true);
    // There are 2 router.use calls in index.ts
    expect(networkTagsRouter.stack.length).toBeGreaterThanOrEqual(2);
  });
});
