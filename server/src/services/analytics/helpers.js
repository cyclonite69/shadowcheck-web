/**
 * Analytics Helpers Module
 * Utility functions for analytics normalization, formatting, and validation
 */

/**
 * Normalizes analytics result counts to numbers.
 * @param rows - Database rows with count as string
 * @returns Array with count parsed to number
 */
function normalizeAnalyticsResult(rows) {
  return rows.map((row) => ({
    ...row,
    count: row.count ? parseInt(row.count) : 0,
  }));
}

/**
 * Formats analytics data for API response.
 * @param data - Raw analytics data
 * @returns Formatted data with ISO timestamps
 */
function formatAnalyticsData(data) {
  return {
    ...data,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Validates analytics parameters.
 * @param params - Parameters to validate
 * @returns { valid: boolean, error?: string }
 */
function validateAnalyticsParams(params) {
  if (
    params.limit !== undefined &&
    (isNaN(params.limit) || params.limit < 1 || params.limit > 10000)
  ) {
    return { valid: false, error: 'Limit must be between 1 and 10000' };
  }

  const validRanges = ['24h', '7d', '30d', '90d', 'all'];
  if (params.range && !validRanges.includes(params.range)) {
    return { valid: false, error: `Range must be one of: ${validRanges.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Applies filters to analytics query.
 * @param baseQuery - Base SQL query
 * @param filters - Filter conditions
 * @returns Query with WHERE clause appended
 */
function applyFiltersToAnalytics(baseQuery, filters) {
  if (filters.length === 0) {
    return { query: baseQuery, params: [] };
  }

  const whereClause = filters.map((f) => f.condition).join(' AND ');
  const params = filters.map((f) => f.param);

  return {
    query: `${baseQuery} WHERE ${whereClause}`,
    params,
  };
}

/**
 * Calculates aggregates from analytics data.
 * @param data - Array of data points
 * @param field - Field to aggregate
 * @param operation - Aggregation operation (sum, avg, min, max)
 * @returns Aggregated value
 */
function calculateAggregates(data, field, operation) {
  if (data.length === 0) {
    return 0;
  }

  const values = data.map((item) => {
    const val = item[field];
    return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
  });

  switch (operation) {
    case 'sum':
      return values.reduce((acc, val) => acc + val, 0);
    case 'avg':
      return values.reduce((acc, val) => acc + val, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return 0;
  }
}

/**
 * Converts timestamp range to milliseconds.
 * @param range - Time range string
 * @returns Milliseconds timestamp
 */
function rangeToMilliseconds(range) {
  const now = Date.now();
  const ranges = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    all: 365 * 24 * 60 * 60 * 1000,
  };
  return now - (ranges[range] || ranges['30d']);
}

module.exports = {
  normalizeAnalyticsResult,
  formatAnalyticsData,
  validateAnalyticsParams,
  applyFiltersToAnalytics,
  calculateAggregates,
  rangeToMilliseconds,
};
