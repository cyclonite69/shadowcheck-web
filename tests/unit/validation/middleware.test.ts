import {
  validateQuery,
  validateBody,
  validateParams,
  paginationMiddleware,
  bssidParamMiddleware,
  macParamMiddleware,
  coordinatesMiddleware,
  sortMiddleware,
  optional,
  createParameterRateLimit,
  sanitizeMiddleware,
} from '../../../server/src/validation/middleware';

// Mock the schemas module
jest.mock('../../../server/src/validation/schemas', () => ({
  validateNetworkIdentifier: jest.fn(),
  validateMACAddress: jest.fn(),
  validateCoordinates: jest.fn(),
  validateSort: jest.fn(),
  validateSortOrder: jest.fn(),
}));

const schemas = require('../../../server/src/validation/schemas');

describe('Validation Middleware', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      query: {},
      body: {},
      params: {},
      validated: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('validateQuery', () => {
    it('calls next if all validators pass', () => {
      const validator = jest.fn().mockReturnValue({ valid: true, value: 'valid' });
      const middleware = validateQuery({ param1: validator });
      req.query.param1 = 'input';

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.validated.param1).toBe('valid');
    });

    it('returns 400 if any validator fails', () => {
      const validator = jest.fn().mockReturnValue({ valid: false, error: 'invalid' });
      const middleware = validateQuery({ param1: validator });
      req.query.param1 = 'input';

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: [{ parameter: 'param1', error: 'invalid' }],
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('uses different return properties for validated value', () => {
      const vCleaned = jest.fn().mockReturnValue({ valid: true, cleaned: 'c' });
      const vValue = jest.fn().mockReturnValue({ valid: true, value: 'v' });
      const vNorm = jest.fn().mockReturnValue({ valid: true, normalized: 'n' });
      const vPage = jest.fn().mockReturnValue({ valid: true, page: 'p' });
      const vLimit = jest.fn().mockReturnValue({ valid: true, limit: 'l' });
      const vNone = jest.fn().mockReturnValue({ valid: true });

      req.query.cleaned = '1';
      req.query.value = '2';
      req.query.normalized = '3';
      req.query.page = '4';
      req.query.limit = '5';
      req.query.none = '6';

      const middleware = validateQuery({
        cleaned: vCleaned,
        value: vValue,
        normalized: vNorm,
        page: vPage,
        limit: vLimit,
        none: vNone,
      });

      middleware(req, res, next);

      expect(req.validated.cleaned).toBe('c');
      expect(req.validated.value).toBe('v');
      expect(req.validated.normalized).toBe('n');
      expect(req.validated.page).toBe('p');
      expect(req.validated.limit).toBe('l');
      expect(req.validated.none).toBe('6');
    });
  });

  describe('optional', () => {
    it('returns valid: true for empty values without calling validator', () => {
      const validator = jest.fn();
      const optValidator = optional(validator);

      expect(optValidator(undefined)).toEqual({ valid: true, value: undefined });
      expect(optValidator(null)).toEqual({ valid: true, value: undefined });
      expect(optValidator('')).toEqual({ valid: true, value: undefined });
      expect(validator).not.toHaveBeenCalled();
    });

    it('calls validator for non-empty values', () => {
      const validator = jest.fn().mockReturnValue({ valid: true, value: 'val' });
      const optValidator = optional(validator);

      expect(optValidator('some')).toEqual({ valid: true, value: 'val' });
      expect(validator).toHaveBeenCalledWith('some');
    });
  });

  describe('validateBody', () => {
    it('calls next if validation passes', () => {
      const validator = jest.fn().mockReturnValue({ valid: true, value: 'v' });
      const middleware = validateBody({ p: validator });
      req.body.p = 'in';
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.validated.p).toBe('v');
    });

    it('returns 400 if validation fails', () => {
      const validator = jest.fn().mockReturnValue({ valid: false, error: 'err' });
      const middleware = validateBody({ p: validator });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('uses different return properties for validated value in body', () => {
      const vCleaned = jest.fn().mockReturnValue({ valid: true, cleaned: 'c' });
      const vNorm = jest.fn().mockReturnValue({ valid: true, normalized: 'n' });
      req.body.cleaned = '1';
      req.body.norm = '2';

      const middleware = validateBody({ cleaned: vCleaned, norm: vNorm });
      middleware(req, res, next);
      expect(req.validated.cleaned).toBe('c');
      expect(req.validated.norm).toBe('n');
    });
  });

  describe('validateParams', () => {
    it('calls next if validation passes', () => {
      const validator = jest.fn().mockReturnValue({ valid: true, value: 'v' });
      const middleware = validateParams({ p: validator });
      req.params.p = 'in';
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.validated.p).toBe('v');
    });

    it('returns 400 if validation fails', () => {
      const validator = jest.fn().mockReturnValue({ valid: false, error: 'err' });
      const middleware = validateParams({ p: validator });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('uses different return properties for validated value in params', () => {
      const vCleaned = jest.fn().mockReturnValue({ valid: true, cleaned: 'c' });
      const vNorm = jest.fn().mockReturnValue({ valid: true, normalized: 'n' });
      req.params.cleaned = '1';
      req.params.norm = '2';

      const middleware = validateParams({ cleaned: vCleaned, norm: vNorm });
      middleware(req, res, next);
      expect(req.validated.cleaned).toBe('c');
      expect(req.validated.norm).toBe('n');
    });
  });

  describe('paginationMiddleware', () => {
    it('sets default pagination if not provided', () => {
      const middleware = paginationMiddleware();
      middleware(req, res, next);
      expect(req.pagination).toEqual({
        page: 1,
        limit: 50,
        offset: 0,
      });
      expect(next).toHaveBeenCalled();
    });

    it('validates and parses custom pagination', () => {
      const middleware = paginationMiddleware();
      req.query.page = '2';
      req.query.limit = '100';
      middleware(req, res, next);
      expect(req.pagination).toEqual({
        page: 2,
        limit: 100,
        offset: 100,
      });
    });

    it('returns 400 for invalid page', () => {
      const middleware = paginationMiddleware();
      req.query.page = 'abc';
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Page must be a positive integer' })
      );
    });

    it('returns 400 for non-positive page', () => {
      const middleware = paginationMiddleware();
      req.query.page = '0';
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 for invalid limit', () => {
      const middleware = paginationMiddleware();
      req.query.limit = 'abc';
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 for limit exceeding max', () => {
      const middleware = paginationMiddleware(100);
      req.query.limit = '101';
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Limit must be between 1 and 100' })
      );
    });

    it('returns 400 for non-positive limit', () => {
      const middleware = paginationMiddleware();
      req.query.limit = '0';
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('bssidParamMiddleware', () => {
    it('sanitizes and calls next if valid', () => {
      schemas.validateNetworkIdentifier.mockReturnValue({
        valid: true,
        cleaned: 'AA:BB:CC:DD:EE:FF',
      });
      req.params.bssid = 'aabbccddeeff';
      bssidParamMiddleware(req, res, next);
      expect(req.params.bssid).toBe('AA:BB:CC:DD:EE:FF');
      expect(next).toHaveBeenCalled();
    });

    it('returns 400 if invalid', () => {
      schemas.validateNetworkIdentifier.mockReturnValue({ valid: false, error: 'invalid bssid' });
      bssidParamMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('macParamMiddleware', () => {
    it('sanitizes and calls next if valid', () => {
      schemas.validateMACAddress.mockReturnValue({ valid: true, cleaned: 'AA:BB:CC:DD:EE:FF' });
      req.params.bssid = 'aabbccddeeff';
      macParamMiddleware(req, res, next);
      expect(req.params.bssid).toBe('AA:BB:CC:DD:EE:FF');
      expect(next).toHaveBeenCalled();
    });

    it('returns 400 if invalid', () => {
      schemas.validateMACAddress.mockReturnValue({ valid: false, error: 'invalid mac' });
      macParamMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('coordinatesMiddleware', () => {
    it('validates coordinates from body by default', () => {
      const middleware = coordinatesMiddleware();
      req.body.latitude = 10;
      req.body.longitude = 20;
      schemas.validateCoordinates.mockReturnValue({ valid: true, lat: 10, lon: 20 });

      middleware(req, res, next);

      expect(schemas.validateCoordinates).toHaveBeenCalledWith(10, 20);
      expect(req.validated.latitude).toBe(10);
      expect(req.validated.longitude).toBe(20);
      expect(next).toHaveBeenCalled();
    });

    it('validates coordinates from query if specified', () => {
      const middleware = coordinatesMiddleware('query');
      req.query.latitude = 15;
      req.query.longitude = 25;
      schemas.validateCoordinates.mockReturnValue({ valid: true, lat: 15, lon: 25 });

      middleware(req, res, next);

      expect(schemas.validateCoordinates).toHaveBeenCalledWith(15, 25);
      expect(req.validated.latitude).toBe(15);
      expect(next).toHaveBeenCalled();
    });

    it('returns 400 if coordinates are invalid', () => {
      const middleware = coordinatesMiddleware();
      schemas.validateCoordinates.mockReturnValue({ valid: false, error: 'invalid coords' });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('sortMiddleware', () => {
    const allowed = { name: 'db_name', date: 'db_date' };

    it('validates default sort and order', () => {
      const middleware = sortMiddleware(allowed);
      schemas.validateSort.mockReturnValue({ valid: true, column: 'name' });
      schemas.validateSortOrder.mockReturnValue({ valid: true, value: 'DESC' });

      middleware(req, res, next);

      expect(req.sorting).toEqual({ column: 'db_name', order: 'DESC' });
      expect(next).toHaveBeenCalled();
    });

    it('returns 400 for invalid sort column', () => {
      const middleware = sortMiddleware(allowed);
      schemas.validateSort.mockReturnValue({ valid: false, error: 'bad sort' });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 for invalid sort order', () => {
      const middleware = sortMiddleware(allowed);
      schemas.validateSort.mockReturnValue({ valid: true, column: 'name' });
      schemas.validateSortOrder.mockReturnValue({ valid: false, error: 'bad order' });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('createParameterRateLimit', () => {
    it('skips if parameter is missing', () => {
      const middleware = createParameterRateLimit('id', 2, 1000);
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows requests within limit', () => {
      const middleware = createParameterRateLimit('id', 2, 1000);
      req.params.id = 'user1';

      middleware(req, res, next);
      expect(next).toHaveBeenCalled();

      next.mockClear();
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('returns 429 if limit exceeded', () => {
      const middleware = createParameterRateLimit('id', 1, 1000);
      req.params.id = 'user1';

      middleware(req, res, next); // 1st request
      expect(next).toHaveBeenCalled();

      next.mockClear();
      middleware(req, res, next); // 2nd request
      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });

    it('gets param from query if not in params', () => {
      const middleware = createParameterRateLimit('id', 1, 1000);
      req.query.id = 'userQ';
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();

      next.mockClear();
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('resets after window expires', () => {
      jest.useFakeTimers();
      const middleware = createParameterRateLimit('id', 1, 1000);
      req.params.id = 'user1';

      middleware(req, res, next); // 1st request

      next.mockClear();
      jest.advanceTimersByTime(1001);

      middleware(req, res, next); // 2nd request after reset
      expect(next).toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('sanitizeMiddleware', () => {
    it('sanitizes query and body strings', () => {
      req.query.q = '  <script>alert(1)</script>  ';
      req.body.b = '<b>hello</b>';
      req.body.n = 123; // non-string

      sanitizeMiddleware(req, res, next);

      expect(req.query.q).toBe('scriptalert(1)/script');
      expect(req.body.b).toBe('bhello/b');
      expect(req.body.n).toBe(123);
      expect(next).toHaveBeenCalled();
    });

    it('handles missing body or non-object body', () => {
      delete req.body;
      sanitizeMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();

      req.body = 'not an object';
      sanitizeMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
