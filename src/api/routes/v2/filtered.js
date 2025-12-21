/**
 * Universal Filtered Networks API (v2)
 * Single source of truth for list, map, analytics, and observation queries.
 */

const express = require('express');
const router = express.Router();
const {
  UniversalFilterQueryBuilder,
  validateFilterPayload,
} = require('../../../services/filterQueryBuilder');
const { query } = require('../../../config/database');

const parseJsonParam = (value, fallback, name) => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch (err) {
    throw new Error(`Invalid JSON for ${name}`);
  }
};

const normalizeThreatTransparency = (threat) => {
  const threatObj = threat && typeof threat === 'object' ? threat : {};
  const flags = Array.isArray(threatObj.flags) ? threatObj.flags : [];
  const signals = Array.isArray(threatObj.signals) ? threatObj.signals : [];

  let reasons = flags.length > 0 ? flags : signals.map((s) => s.code).filter(Boolean);

  const evidence = signals.map((signal) => {
    const rule = signal.code || signal.rule || 'UNKNOWN';
    const observedValue =
      signal && signal.evidence && typeof signal.evidence === 'object'
        ? Object.keys(signal.evidence).length === 1
          ? signal.evidence[Object.keys(signal.evidence)[0]]
          : JSON.stringify(signal.evidence)
        : (signal.evidence ?? null);

    let threshold = null;
    if (rule === 'EXCESSIVE_MOVEMENT') {
      threshold = 0.2;
    }
    if (rule === 'SPEED_PATTERN') {
      threshold = 20;
    }
    if (rule === 'TEMPORAL_PATTERN') {
      threshold = 2;
    }
    if (rule === 'HIGH_OBSERVATION_COUNT') {
      threshold = 20;
    }
    if (rule === 'HOME_AND_AWAY') {
      threshold = 'home & away';
    }

    return { rule, observedValue, threshold };
  });

  const score = Number(threatObj.score || 0);
  const level = String(threatObj.level || 'NONE').toUpperCase();
  const flagged = score > 0 || level !== 'NONE';

  if (flagged && reasons.length === 0) {
    reasons = ['MISSING_THREAT_REASONS'];
  }

  return {
    threatReasons: reasons,
    threatEvidence: evidence,
    transparencyError: flagged && reasons.length === 0,
  };
};

const buildOrderBy = (sort, order) => {
  const sortColumns = String(sort || 'last_seen')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  const sortOrders = String(order || 'desc')
    .split(',')
    .map((v) => v.trim().toLowerCase());

  const map = {
    observed_at: 'l.observed_at',
    last_observed_at: 'r.last_observed_at',
    first_observed_at: 'r.first_observed_at',
    last_seen: 'ne.last_seen',
    first_seen: 'ne.first_seen',
    ssid: 'ne.ssid',
    bssid: 'ne.bssid',
    signal: 'l.level',
    observations: 'r.observation_count',
    threat: "(ne.threat->>'score')::numeric",
    threat_score: "(ne.threat->>'score')::numeric",
    security: 'ne.security',
    type: 'ne.type',
    distance_from_home_km: 'ne.distance_from_home_km',
    stationary_confidence: 's.stationary_confidence',
    frequency: 'ne.frequency',
    channel: 'ne.frequency',
  };

  const clauses = sortColumns.map((col, idx) => {
    const mapped = map[col] || map.last_seen;
    const dir = sortOrders[idx] === 'asc' ? 'ASC' : 'DESC';
    return `${mapped} ${dir} NULLS LAST`;
  });

  return clauses.length > 0 ? clauses.join(', ') : `${map.last_seen} DESC`;
};

const assertHomeExistsIfNeeded = async (enabled, res) => {
  if (!enabled.distanceFromHomeMin && !enabled.distanceFromHomeMax) {
    return true;
  }
  const home = await query("SELECT 1 FROM app.location_markers WHERE marker_type = 'home' LIMIT 1");
  if (home.rowCount === 0) {
    res.status(400).json({
      ok: false,
      error: 'Home location is required for distance filters.',
    });
    return false;
  }
  return true;
};

// GET /api/v2/networks/filtered
router.get('/', async (req, res, next) => {
  try {
    let filters;
    let enabled;
    try {
      filters = parseJsonParam(req.query.filters, {}, 'filters');
      enabled = parseJsonParam(req.query.enabled, {}, 'enabled');
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
    const { errors } = validateFilterPayload(filters, enabled);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    if (!(await assertHomeExistsIfNeeded(enabled, res))) {
      return;
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 5000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const orderBy = buildOrderBy(req.query.sort, req.query.order);

    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const { sql, params, appliedFilters, ignoredFilters, warnings } = builder.buildNetworkListQuery(
      {
        limit,
        offset,
        orderBy,
      }
    );

    const result = await query(sql, params);
    const rows = result.rows || [];

    const enriched = rows.map((row) => {
      const transparency = normalizeThreatTransparency(row.threat);
      return {
        ...row,
        threatReasons: transparency.threatReasons,
        threatEvidence: transparency.threatEvidence,
        threatTransparencyError: transparency.transparencyError,
      };
    });

    const countBuilder = new UniversalFilterQueryBuilder(filters, enabled);
    const countQuery = countBuilder.buildNetworkCountQuery();
    const countResult = await query(countQuery.sql, countQuery.params);
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    const enabledCount = Object.values(enabled).filter(Boolean).length;
    const threatIssues = enriched.filter((r) => r.threatTransparencyError).length;

    res.json({
      ok: true,
      data: enriched,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      filterTransparency: {
        appliedFilters,
        ignoredFilters,
        warnings,
        filterCount: appliedFilters.length,
        enabledCount,
        validation: {
          threatsWithoutReasons: threatIssues,
          totalThreats: enriched.filter(
            (r) => r.threat && r.threat.level && r.threat.level !== 'NONE'
          ).length,
        },
      },
      forensicIntegrity: {
        queryTime: new Date().toISOString(),
        resultCount: enriched.length,
        noImplicitFiltering: enabledCount === appliedFilters.length,
        explicitFiltersOnly: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v2/networks/filtered/geospatial
router.get('/geospatial', async (req, res, next) => {
  try {
    let filters;
    let enabled;
    try {
      filters = parseJsonParam(req.query.filters, {}, 'filters');
      enabled = parseJsonParam(req.query.enabled, {}, 'enabled');
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
    const { errors } = validateFilterPayload(filters, enabled);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    if (!(await assertHomeExistsIfNeeded(enabled, res))) {
      return;
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 5000, 500000);
    const selectedBssids = parseJsonParam(req.query.bssids, [], 'bssids');

    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const { sql, params, appliedFilters, ignoredFilters, warnings } = builder.buildGeospatialQuery({
      limit,
      selectedBssids,
    });

    const result = await query(sql, params);
    const features = (result.rows || []).map((row) => {
      const transparency = normalizeThreatTransparency(row.threat);
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [row.lon, row.lat],
        },
        properties: {
          bssid: row.bssid,
          ssid: row.ssid,
          signal: row.level,
          accuracy: row.accuracy,
          altitude: row.altitude,
          time: row.time,
          number: row.obs_number,
          radio_frequency: row.radio_frequency,
          radio_capabilities: row.radio_capabilities,
          radio_type: row.radio_type,
          threat: row.threat,
          threatReasons: transparency.threatReasons,
          threatEvidence: transparency.threatEvidence,
          threatTransparencyError: transparency.transparencyError,
        },
      };
    });

    res.json({
      ok: true,
      type: 'FeatureCollection',
      features,
      filterTransparency: {
        appliedFilters,
        ignoredFilters,
        warnings,
      },
      meta: {
        queryTime: Date.now(),
        resultCount: features.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v2/networks/filtered/observations
router.get('/observations', async (req, res, next) => {
  try {
    let filters;
    let enabled;
    try {
      filters = parseJsonParam(req.query.filters, {}, 'filters');
      enabled = parseJsonParam(req.query.enabled, {}, 'enabled');
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
    const { errors } = validateFilterPayload(filters, enabled);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    if (!(await assertHomeExistsIfNeeded(enabled, res))) {
      return;
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 500000, 1000000);
    const selectedBssids = parseJsonParam(req.query.bssids, [], 'bssids');

    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const { sql, params } = builder.buildGeospatialQuery({ limit, selectedBssids });
    const result = await query(sql, params);

    res.json({
      ok: true,
      data: result.rows || [],
      meta: {
        queryTime: Date.now(),
        resultCount: result.rowCount || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v2/networks/filtered/analytics
router.get('/analytics', async (req, res, next) => {
  try {
    let filters;
    let enabled;
    try {
      filters = parseJsonParam(req.query.filters, {}, 'filters');
      enabled = parseJsonParam(req.query.enabled, {}, 'enabled');
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
    const { errors } = validateFilterPayload(filters, enabled);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const queries = builder.buildAnalyticsQueries();

    const [
      networkTypes,
      signalStrength,
      security,
      threatDistribution,
      temporalActivity,
      radioTypeOverTime,
      threatTrends,
      topNetworks,
    ] = await Promise.all([
      query(queries.networkTypes.sql, queries.networkTypes.params),
      query(queries.signalStrength.sql, queries.signalStrength.params),
      query(queries.security.sql, queries.security.params),
      query(queries.threatDistribution.sql, queries.threatDistribution.params),
      query(queries.temporalActivity.sql, queries.temporalActivity.params),
      query(queries.radioTypeOverTime.sql, queries.radioTypeOverTime.params),
      query(queries.threatTrends.sql, queries.threatTrends.params),
      query(queries.topNetworks.sql, queries.topNetworks.params),
    ]);

    res.json({
      ok: true,
      data: {
        networkTypes: networkTypes.rows,
        signalStrength: signalStrength.rows,
        security: security.rows,
        threatDistribution: threatDistribution.rows,
        temporalActivity: temporalActivity.rows,
        radioTypeOverTime: radioTypeOverTime.rows,
        threatTrends: threatTrends.rows,
        topNetworks: topNetworks.rows,
      },
      meta: {
        queryTime: Date.now(),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
