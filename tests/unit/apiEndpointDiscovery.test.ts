describe('API endpoint discovery', () => {
  it('can load API test endpoints configuration', () => {
    const { API_ENDPOINTS } = require('../../client/src/config/apiTestEndpoints');
    expect(API_ENDPOINTS).toBeDefined();
    expect(Array.isArray(API_ENDPOINTS)).toBe(true);
    expect(API_ENDPOINTS.length).toBeGreaterThan(0);
  });

  it('every endpoint has required fields', () => {
    const { API_ENDPOINTS } = require('../../client/src/config/apiTestEndpoints');
    API_ENDPOINTS.forEach((endpoint: any) => {
      expect(endpoint.category).toBeDefined();
      expect(endpoint.label).toBeDefined();
      expect(endpoint.method).toBeDefined();
      expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).toContain(endpoint.method);
      expect(endpoint.path).toBeDefined();
      expect(endpoint.path).toMatch(/^\//);
    });
  });

  it('endpoints are grouped by valid categories', () => {
    const { API_ENDPOINTS } = require('../../client/src/config/apiTestEndpoints');
    const categories = new Set(API_ENDPOINTS.map((e: any) => e.category));
    expect(categories.size).toBeGreaterThan(0);
    categories.forEach((cat: unknown) => {
      expect(typeof cat).toBe('string');
      if (typeof cat === 'string') {
        expect(cat.trim().length).toBeGreaterThan(0);
      }
    });
  });

  it('paths are unique within their HTTP method', () => {
    const { API_ENDPOINTS } = require('../../client/src/config/apiTestEndpoints');
    const pathsByMethod = new Map<string, Set<string>>();

    API_ENDPOINTS.forEach((endpoint: any) => {
      const _key = `${endpoint.method}:${endpoint.path}`;
      if (!pathsByMethod.has(endpoint.method)) {
        pathsByMethod.set(endpoint.method, new Set());
      }
      const set = pathsByMethod.get(endpoint.method)!;
      expect(set.has(endpoint.path)).toBe(false);
      set.add(endpoint.path);
    });
  });
});
