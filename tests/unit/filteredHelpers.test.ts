import {
  parseAndValidateFilters,
  isParseValidatedFiltersError,
} from '../../server/src/api/routes/v2/filteredHelpers';

describe('parseAndValidateFilters', () => {
  test('returns 400 when filters JSON is invalid', () => {
    const req: any = { query: { filters: '{bad-json', enabled: '{}' } };
    const validate = jest.fn();

    const result = parseAndValidateFilters(req, validate);

    expect(isParseValidatedFiltersError(result)).toBe(true);
    if (!isParseValidatedFiltersError(result)) return;
    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
    expect(result.body.error).toContain('Invalid JSON for filters');
    expect(validate).not.toHaveBeenCalled();
  });

  test('returns 400 when payload validation fails', () => {
    const req: any = { query: { filters: '{"ssid":"abc"}', enabled: '{"ssid":true}' } };
    const validate = jest.fn().mockReturnValue({ errors: ['bad filter'] });

    const result = parseAndValidateFilters(req, validate);

    expect(validate).toHaveBeenCalledWith({ ssid: 'abc' }, { ssid: true });
    expect(isParseValidatedFiltersError(result)).toBe(true);
    if (!isParseValidatedFiltersError(result)) return;
    expect(result.status).toBe(400);
    expect(result.body.errors).toEqual(['bad filter']);
  });

  test('returns parsed payload when valid', () => {
    const req: any = { query: { filters: '{"ssid":"abc"}', enabled: '{"ssid":true}' } };
    const validate = jest.fn().mockReturnValue({ errors: [] });

    const result = parseAndValidateFilters(req, validate);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filters).toEqual({ ssid: 'abc' });
    expect(result.enabled).toEqual({ ssid: true });
  });
});
