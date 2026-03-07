import { buildFilteredRequestParams } from '../filteredRequestParams';

describe('buildFilteredRequestParams', () => {
  const payload = {
    filters: { ssid: 'undertaker', threatCategories: ['high'] } as any,
    enabled: { ssid: true, threatCategories: true },
  };

  it('always includes base filter payload, limit, and offset', () => {
    const params = buildFilteredRequestParams({
      payload,
      limit: 500,
      offset: 0,
    });

    expect(params.get('filters')).toBe(JSON.stringify(payload.filters));
    expect(params.get('enabled')).toBe(JSON.stringify(payload.enabled));
    expect(params.get('limit')).toBe('500');
    expect(params.get('offset')).toBe('0');
  });

  it('serializes includeTotal as 1/0 when provided', () => {
    const withTotal = buildFilteredRequestParams({
      payload,
      limit: 100,
      offset: 25,
      includeTotal: true,
    });
    const withoutTotal = buildFilteredRequestParams({
      payload,
      limit: 100,
      offset: 25,
      includeTotal: false,
    });

    expect(withTotal.get('includeTotal')).toBe('1');
    expect(withoutTotal.get('includeTotal')).toBe('0');
  });

  it('includes sort/order/orderBy when provided', () => {
    const params = buildFilteredRequestParams({
      payload,
      limit: 200,
      offset: 10,
      sort: 'last_seen,threat_score',
      order: 'DESC,ASC',
      orderBy: 'last_seen DESC',
    });

    expect(params.get('sort')).toBe('last_seen,threat_score');
    expect(params.get('order')).toBe('DESC,ASC');
    expect(params.get('orderBy')).toBe('last_seen DESC');
  });

  it('includes pageType, planCheck, and selected bssids when provided', () => {
    const params = buildFilteredRequestParams({
      payload,
      limit: 250,
      offset: 50,
      pageType: 'wigle',
      planCheck: true,
      selectedBssids: ['AA:BB:CC:DD:EE:FF', '11:22:33:44:55:66'],
    });

    expect(params.get('pageType')).toBe('wigle');
    expect(params.get('planCheck')).toBe('1');
    expect(params.get('bssids')).toBe('["AA:BB:CC:DD:EE:FF","11:22:33:44:55:66"]');
  });

  it('omits optional params when not provided', () => {
    const params = buildFilteredRequestParams({
      payload,
      limit: 50,
      offset: 5,
    });

    expect(params.has('includeTotal')).toBe(false);
    expect(params.has('sort')).toBe(false);
    expect(params.has('order')).toBe(false);
    expect(params.has('orderBy')).toBe(false);
    expect(params.has('pageType')).toBe(false);
    expect(params.has('planCheck')).toBe(false);
    expect(params.has('bssids')).toBe(false);
  });
});
