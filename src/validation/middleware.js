/**
 * Validation Middleware
 * Express middleware factories for common validation patterns
 */

const schemas = require('./schemas');

/**
 * Creates middleware to validate query parameters
 * @param {object} validators - Object mapping param names to validator functions
 * @returns {function} Express middleware
 */
function validateQuery(validators) {
  return (req, res, next) => {
    const errors = [];

    Object.entries(validators).forEach(([param, validator]) => {
      const result = validator(req.query[param]);
      if (!result.valid) {
        errors.push({
          parameter: param,
          error: result.error,
        });
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    // Attach validated values to request for use in route handler
    req.validated = {};
    Object.entries(validators).forEach(([param, validator]) => {
      const result = validator(req.query[param]);
      if (result.valid) {
        // Use the most specific returned value
        req.validated[param] =
          result.cleaned ||
          result.value ||
          result.normalized ||
          result.page ||
          result.limit ||
          req.query[param];
      }
    });

    next();
  };
}

/**
 * Wraps a validator to allow empty values
 * @param {function} validator - Validator function
 * @returns {function} Wrapped validator that accepts undefined/null/empty string
 */
function optional(validator) {
  return (value) => {
    if (value === undefined || value === null || value === '') {
      return { valid: true, value: undefined };
    }
    return validator(value);
  };
}

/**
 * Creates middleware to validate body parameters
 * @param {object} validators - Object mapping param names to validator functions
 * @returns {function} Express middleware
 */
function validateBody(validators) {
  return (req, res, next) => {
    const errors = [];

    Object.entries(validators).forEach(([param, validator]) => {
      const result = validator(req.body[param]);
      if (!result.valid) {
        errors.push({
          parameter: param,
          error: result.error,
        });
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    // Attach validated values to request for use in route handler
    req.validated = {};
    Object.entries(validators).forEach(([param, validator]) => {
      const result = validator(req.body[param]);
      if (result.valid) {
        req.validated[param] =
          result.cleaned || result.value || result.normalized || req.body[param];
      }
    });

    next();
  };
}

/**
 * Creates middleware to validate path parameters
 * @param {object} validators - Object mapping param names to validator functions
 * @returns {function} Express middleware
 */
function validateParams(validators) {
  return (req, res, next) => {
    const errors = [];

    Object.entries(validators).forEach(([param, validator]) => {
      const result = validator(req.params[param]);
      if (!result.valid) {
        errors.push({
          parameter: param,
          error: result.error,
        });
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    // Attach validated values to request for use in route handler
    req.validated = {};
    Object.entries(validators).forEach(([param, validator]) => {
      const result = validator(req.params[param]);
      if (result.valid) {
        req.validated[param] =
          result.cleaned || result.value || result.normalized || req.params[param];
      }
    });

    next();
  };
}

/**
 * Pagination validator middleware
 * Validates and normalizes page/limit query parameters
 */
function paginationMiddleware(maxLimit = 5000) {
  return (req, res, next) => {
    const pageRaw = req.query.page;
    const limitRaw = req.query.limit;
    const page = pageRaw === undefined ? 1 : parseInt(pageRaw, 10);
    const limit = limitRaw === undefined ? 50 : parseInt(limitRaw, 10);

    if (pageRaw !== undefined && Number.isNaN(page)) {
      return res.status(400).json({
        ok: false,
        error: 'Page must be a positive integer',
      });
    }

    if (limitRaw !== undefined && Number.isNaN(limit)) {
      return res.status(400).json({
        ok: false,
        error: 'Limit must be a positive integer',
      });
    }

    if (page <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'Page must be a positive integer',
      });
    }

    if (limit <= 0 || limit > maxLimit) {
      return res.status(400).json({
        ok: false,
        error: `Limit must be between 1 and ${maxLimit}`,
      });
    }

    req.pagination = {
      page,
      limit,
      offset: (page - 1) * limit,
    };

    next();
  };
}

/**
 * BSSID validation middleware
 * Validates and sanitizes BSSID from path parameter
 */
function bssidParamMiddleware(req, res, next) {
  const { bssid } = req.params;
  const validation = schemas.validateBSSID(bssid);

  if (!validation.valid) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid BSSID parameter',
      details: validation.error,
    });
  }

  req.params.bssid = validation.cleaned;
  next();
}

/**
 * Coordinates validation middleware
 * Validates latitude/longitude from body or query
 */
function coordinatesMiddleware(source = 'body') {
  return (req, res, next) => {
    const source_obj = source === 'body' ? req.body : req.query;
    const validation = schemas.validateCoordinates(source_obj.latitude, source_obj.longitude);

    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid coordinates',
        details: validation.error,
      });
    }

    req.validated = req.validated || {};
    req.validated.latitude = validation.lat;
    req.validated.longitude = validation.lon;

    next();
  };
}

/**
 * Sort parameter validation middleware
 * Validates sort column and order
 */
function sortMiddleware(allowedColumns) {
  return (req, res, next) => {
    const sort = req.query.sort || 'lastSeen';
    const order = req.query.order || 'DESC';

    const sortValidation = schemas.validateSort(sort, allowedColumns);
    if (!sortValidation.valid) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid sort parameter',
        details: sortValidation.error,
      });
    }

    const orderValidation = schemas.validateSortOrder(order);
    if (!orderValidation.valid) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid sort order',
        details: orderValidation.error,
      });
    }

    req.sorting = {
      column: allowedColumns[sortValidation.column],
      order: orderValidation.value,
    };

    next();
  };
}

/**
 * Rate limiting per parameter (e.g., per BSSID)
 * Prevents abuse of specific resources
 */
function createParameterRateLimit(paramName, maxRequests, windowMs) {
  const limits = new Map();

  return (req, res, next) => {
    const param = req.params[paramName] || req.query[paramName];

    if (!param) {
      return next();
    }

    const key = `${paramName}:${param}`;
    const now = Date.now();

    if (!limits.has(key)) {
      limits.set(key, { requests: [], resetTime: now + windowMs });
    }

    const record = limits.get(key);

    // Reset if window expired
    if (now > record.resetTime) {
      record.requests = [];
      record.resetTime = now + windowMs;
    }

    record.requests.push(now);

    // Check if exceeded limit
    if (record.requests.length > maxRequests) {
      return res.status(429).json({
        ok: false,
        error: `Rate limit exceeded for ${paramName}`,
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    next();
  };
}

/**
 * Input sanitization middleware
 * Removes dangerous characters from common parameters
 */
function sanitizeMiddleware(req, res, next) {
  // Sanitize query parameters
  Object.keys(req.query).forEach((key) => {
    if (typeof req.query[key] === 'string') {
      // Remove potentially dangerous characters but preserve URL-safe ones
      req.query[key] = req.query[key]
        .replace(/[<>]/g, '') // Remove angle brackets
        .trim(); // Remove leading/trailing whitespace
    }
  });

  // Sanitize body parameters
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].replace(/[<>]/g, '').trim();
      }
    });
  }

  next();
}

module.exports = {
  validateQuery,
  validateBody,
  validateParams,
  paginationMiddleware,
  bssidParamMiddleware,
  coordinatesMiddleware,
  sortMiddleware,
  optional,
  createParameterRateLimit,
  sanitizeMiddleware,
};
