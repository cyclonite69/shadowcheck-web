/**
 * Universal Filter Query Builder
 * Forensically correct, parameterized SQL with explicit enable flags.
 */

const NOISE_FLOOR_DBM = -95;
const MAX_GPS_ACCURACY_METERS = 1000;

const FILTER_KEYS = [
  'ssid',
  'bssid',
  'manufacturer',
  'networkId',
  'radioTypes',
  'frequencyBands',
  'channelMin',
  'channelMax',
  'rssiMin',
  'rssiMax',
  'encryptionTypes',
  'authMethods',
  'insecureFlags',
  'securityFlags',
  'timeframe',
  'temporalScope',
  'observationCountMin',
  'observationCountMax',
  'gpsAccuracyMax',
  'excludeInvalidCoords',
  'distanceFromHomeMin',
  'distanceFromHomeMax',
  'boundingBox',
  'radiusFilter',
  'threatScoreMin',
  'threatScoreMax',
  'threatCategories',
  'stationaryConfidenceMin',
  'stationaryConfidenceMax',
];

const DEFAULT_ENABLED = FILTER_KEYS.reduce((acc, key) => {
  acc[key] = false;
  return acc;
}, {});

const RELATIVE_WINDOWS = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  all: null,
};

const OBS_TYPE_EXPR = (alias = 'o') => `
  COALESCE(${alias}.radio_type, CASE
    WHEN ${alias}.radio_frequency BETWEEN 2412 AND 2484 THEN 'W'
    WHEN ${alias}.radio_frequency BETWEEN 5000 AND 5900 THEN 'W'
    WHEN ${alias}.radio_frequency BETWEEN 5925 AND 7125 THEN 'W'
    WHEN UPPER(COALESCE(${alias}.radio_capabilities, '')) ~ '(WPA|WEP|WPS|RSN|ESS|CCMP|TKIP)' THEN 'W'
    WHEN UPPER(COALESCE(${alias}.radio_capabilities, '')) ~ '(BLE|BTLE|BLUETOOTH.?LOW.?ENERGY)' THEN 'E'
    WHEN UPPER(COALESCE(${alias}.radio_capabilities, '')) ~ '(BLUETOOTH)' THEN 'B'
    WHEN UPPER(COALESCE(${alias}.radio_capabilities, '')) ~ '(LTE|4G|EARFCN|5G|NR|3GPP)' THEN 'L'
    ELSE '?'
  END)
`;

const SECURITY_EXPR = (alias = 'o') => `
  CASE
    WHEN COALESCE(${alias}.radio_capabilities, '') = '' THEN 'OPEN'
    WHEN UPPER(${alias}.radio_capabilities) ~ '(WPA3|SAE)' THEN
      CASE
        WHEN UPPER(${alias}.radio_capabilities) ~ '(EAP|MGT|ENT)' THEN 'WPA3-E'
        ELSE 'WPA3-P'
      END
    WHEN UPPER(${alias}.radio_capabilities) ~ '(WPA2|RSN)' THEN
      CASE
        WHEN UPPER(${alias}.radio_capabilities) ~ '(EAP|MGT|ENT)' THEN 'WPA2-E'
        ELSE 'WPA2-P'
      END
    WHEN UPPER(${alias}.radio_capabilities) LIKE '%WPA%' THEN 'WPA'
    WHEN UPPER(${alias}.radio_capabilities) LIKE '%WEP%' THEN 'WEP'
    WHEN UPPER(${alias}.radio_capabilities) LIKE '%WPS%'
      AND UPPER(${alias}.radio_capabilities) NOT LIKE '%WPA%' THEN 'WPS'
    ELSE 'Unknown'
  END
`;

const AUTH_EXPR = (alias = 'o') => `
  CASE
    WHEN UPPER(${alias}.radio_capabilities) ~ '(EAP|MGT|ENT)' THEN 'Enterprise'
    WHEN UPPER(${alias}.radio_capabilities) ~ '(SAE)' THEN 'SAE'
    WHEN UPPER(${alias}.radio_capabilities) ~ '(OWE)' THEN 'OWE'
    WHEN UPPER(${alias}.radio_capabilities) ~ '(PSK)' THEN 'PSK'
    WHEN COALESCE(${alias}.radio_capabilities, '') = '' THEN 'None'
    ELSE 'Unknown'
  END
`;

const WIFI_CHANNEL_EXPR = (alias = 'o') => `
  CASE
    WHEN ${alias}.radio_frequency BETWEEN 2412 AND 2484 THEN
      CASE
        WHEN ${alias}.radio_frequency = 2484 THEN 14
        ELSE FLOOR((${alias}.radio_frequency - 2412) / 5) + 1
      END
    WHEN ${alias}.radio_frequency BETWEEN 5000 AND 5900 THEN FLOOR((${alias}.radio_frequency - 5000) / 5)
    WHEN ${alias}.radio_frequency BETWEEN 5925 AND 7125 THEN FLOOR((${alias}.radio_frequency - 5925) / 5)
    ELSE NULL
  END
`;

const normalizeEnabled = (enabled) => {
  if (!enabled || typeof enabled !== 'object') {
    return { ...DEFAULT_ENABLED };
  }
  const normalized = { ...DEFAULT_ENABLED };
  FILTER_KEYS.forEach((key) => {
    normalized[key] = Boolean(enabled[key]);
  });
  return normalized;
};

const normalizeFilters = (filters) => (filters && typeof filters === 'object' ? filters : {});

const isOui = (value) => /^[0-9A-F]{6}$/.test(value || '');

const coerceOui = (value) =>
  String(value || '')
    .replace(/[^0-9A-Fa-f]/g, '')
    .toUpperCase();

const validateFilterPayload = (filters, enabled) => {
  const errors = [];
  const normalized = normalizeFilters(filters);
  const flags = normalizeEnabled(enabled);

  if (flags.rssiMin && normalized.rssiMin < NOISE_FLOOR_DBM) {
    errors.push(`RSSI minimum below noise floor (${NOISE_FLOOR_DBM} dBm).`);
  }
  if (flags.rssiMax && normalized.rssiMax > 0) {
    errors.push('RSSI maximum above 0 dBm.');
  }
  if (flags.rssiMin && flags.rssiMax && normalized.rssiMin > normalized.rssiMax) {
    errors.push('RSSI minimum greater than maximum.');
  }
  if (flags.gpsAccuracyMax && normalized.gpsAccuracyMax > MAX_GPS_ACCURACY_METERS) {
    errors.push('GPS accuracy limit too high (>1000m).');
  }
  if (flags.threatScoreMin && (normalized.threatScoreMin < 0 || normalized.threatScoreMin > 100)) {
    errors.push('Threat score minimum out of range (0-100).');
  }
  if (flags.threatScoreMax && (normalized.threatScoreMax < 0 || normalized.threatScoreMax > 100)) {
    errors.push('Threat score maximum out of range (0-100).');
  }
  if (
    flags.stationaryConfidenceMin &&
    (normalized.stationaryConfidenceMin < 0 || normalized.stationaryConfidenceMin > 1)
  ) {
    errors.push('Stationary confidence minimum out of range (0.0-1.0).');
  }
  if (
    flags.stationaryConfidenceMax &&
    (normalized.stationaryConfidenceMax < 0 || normalized.stationaryConfidenceMax > 1)
  ) {
    errors.push('Stationary confidence maximum out of range (0.0-1.0).');
  }
  return { errors, filters: normalized, enabled: flags };
};

class UniversalFilterQueryBuilder {
  constructor(filters, enabled) {
    const { filters: normalized, enabled: flags } = validateFilterPayload(filters, enabled);
    this.filters = normalized;
    this.enabled = flags;
    this.params = [];
    this.paramIndex = 1;
    this.appliedFilters = [];
    this.ignoredFilters = [];
    this.warnings = [];
    this.obsJoins = new Set();
    this.requiresHome = false;
  }

  addParam(value) {
    this.params.push(value);
    const index = this.paramIndex;
    this.paramIndex += 1;
    return `$${index}`;
  }

  addApplied(type, field, value) {
    this.appliedFilters.push({ type, field, value });
  }

  addIgnored(type, field, reason) {
    this.ignoredFilters.push({ type, field, reason });
  }

  buildObservationFilters() {
    const where = [];
    const f = this.filters;
    const e = this.enabled;

    if (e.excludeInvalidCoords) {
      where.push(
        'o.lat IS NOT NULL',
        'o.lon IS NOT NULL',
        'o.lat BETWEEN -90 AND 90',
        'o.lon BETWEEN -180 AND 180'
      );
      this.addApplied('quality', 'excludeInvalidCoords', true);
    }

    if (e.gpsAccuracyMax && f.gpsAccuracyMax !== undefined) {
      where.push(`o.accuracy IS NOT NULL AND o.accuracy <= ${this.addParam(f.gpsAccuracyMax)}`);
      this.addApplied('quality', 'gpsAccuracyMax', f.gpsAccuracyMax);
    }

    if (e.ssid && f.ssid) {
      where.push(`o.ssid ILIKE ${this.addParam(`%${f.ssid}%`)}`);
      this.addApplied('identity', 'ssid', f.ssid);
    }

    if (e.bssid && f.bssid) {
      const value = String(f.bssid).toUpperCase();
      if (value.length === 17) {
        where.push(`o.bssid = ${this.addParam(value)}`);
      } else {
        where.push(`o.bssid LIKE ${this.addParam(`${value}%`)}`);
      }
      this.addApplied('identity', 'bssid', f.bssid);
    }

    if (e.manufacturer && f.manufacturer) {
      const cleaned = coerceOui(f.manufacturer);
      this.obsJoins.add('JOIN public.access_points ap ON ap.bssid = o.bssid');
      this.obsJoins.add(
        "LEFT JOIN app.radio_manufacturers rm ON UPPER(REPLACE(SUBSTRING(ap.bssid, 1, 8), ':', '')) = rm.prefix_24bit"
      );
      if (isOui(cleaned)) {
        where.push(`rm.prefix_24bit = ${this.addParam(cleaned)}`);
        this.addApplied('identity', 'manufacturerOui', cleaned);
      } else {
        where.push(`rm.organization_name ILIKE ${this.addParam(`%${f.manufacturer}%`)}`);
        this.addApplied('identity', 'manufacturer', f.manufacturer);
      }
    }

    if (e.networkId && f.networkId) {
      this.obsJoins.add('JOIN app.networks an ON an.bssid = o.bssid');
      where.push(`an.unified_id = ${this.addParam(f.networkId)}`);
      this.addApplied('identity', 'networkId', f.networkId);
    }

    if (e.radioTypes && Array.isArray(f.radioTypes) && f.radioTypes.length > 0) {
      where.push(`${OBS_TYPE_EXPR('o')} = ANY(${this.addParam(f.radioTypes)})`);
      this.addApplied('radio', 'radioTypes', f.radioTypes);
    }

    if (e.frequencyBands && Array.isArray(f.frequencyBands) && f.frequencyBands.length > 0) {
      const bandConditions = f.frequencyBands.map((band) => {
        if (band === '2.4GHz') {
          return '(o.radio_frequency BETWEEN 2412 AND 2484)';
        }
        if (band === '5GHz') {
          return '(o.radio_frequency BETWEEN 5000 AND 5900)';
        }
        if (band === '6GHz') {
          return '(o.radio_frequency BETWEEN 5925 AND 7125)';
        }
        if (band === 'BLE') {
          return `${OBS_TYPE_EXPR('o')} = 'E'`;
        }
        if (band === 'Cellular') {
          return `${OBS_TYPE_EXPR('o')} IN ('L', 'G', 'N')`;
        }
        return null;
      });
      const clauses = bandConditions.filter(Boolean);
      if (clauses.length > 0) {
        where.push(`(${clauses.join(' OR ')})`);
        this.addApplied('radio', 'frequencyBands', f.frequencyBands);
      }
    }

    if (e.channelMin && f.channelMin !== undefined) {
      where.push(`${WIFI_CHANNEL_EXPR('o')} >= ${this.addParam(f.channelMin)}`);
      this.addApplied('radio', 'channelMin', f.channelMin);
    }

    if (e.channelMax && f.channelMax !== undefined) {
      where.push(`${WIFI_CHANNEL_EXPR('o')} <= ${this.addParam(f.channelMax)}`);
      this.addApplied('radio', 'channelMax', f.channelMax);
    }

    if (e.rssiMin && f.rssiMin !== undefined) {
      where.push('o.level IS NOT NULL');
      where.push(`o.level >= ${this.addParam(NOISE_FLOOR_DBM)}`);
      where.push(`o.level >= ${this.addParam(f.rssiMin)}`);
      this.addApplied('radio', 'rssiMin', f.rssiMin);
    }

    if (e.rssiMax && f.rssiMax !== undefined) {
      where.push('o.level IS NOT NULL');
      where.push(`o.level >= ${this.addParam(NOISE_FLOOR_DBM)}`);
      where.push(`o.level <= ${this.addParam(f.rssiMax)}`);
      this.addApplied('radio', 'rssiMax', f.rssiMax);
    }

    if (e.encryptionTypes && Array.isArray(f.encryptionTypes) && f.encryptionTypes.length > 0) {
      where.push(`${SECURITY_EXPR('o')} = ANY(${this.addParam(f.encryptionTypes)})`);
      this.addApplied('security', 'encryptionTypes', f.encryptionTypes);
    }

    if (e.authMethods && Array.isArray(f.authMethods) && f.authMethods.length > 0) {
      where.push(`${AUTH_EXPR('o')} = ANY(${this.addParam(f.authMethods)})`);
      this.addApplied('security', 'authMethods', f.authMethods);
    }

    if (e.insecureFlags && Array.isArray(f.insecureFlags) && f.insecureFlags.length > 0) {
      const insecureClauses = [];
      if (f.insecureFlags.includes('open')) {
        insecureClauses.push(`${SECURITY_EXPR('o')} = 'OPEN'`);
      }
      if (f.insecureFlags.includes('wep')) {
        insecureClauses.push(`${SECURITY_EXPR('o')} = 'WEP'`);
      }
      if (f.insecureFlags.includes('wps')) {
        insecureClauses.push("UPPER(o.radio_capabilities) LIKE '%WPS%'");
      }
      if (f.insecureFlags.includes('deprecated')) {
        insecureClauses.push(`${SECURITY_EXPR('o')} IN ('WEP', 'WPS')`);
      }
      if (insecureClauses.length > 0) {
        where.push(`(${insecureClauses.join(' OR ')})`);
        this.addApplied('security', 'insecureFlags', f.insecureFlags);
      }
    }

    if (e.securityFlags && Array.isArray(f.securityFlags) && f.securityFlags.length > 0) {
      const flagClauses = [];
      if (f.securityFlags.includes('insecure')) {
        flagClauses.push(`${SECURITY_EXPR('o')} IN ('OPEN', 'WEP', 'WPS')`);
      }
      if (f.securityFlags.includes('deprecated')) {
        flagClauses.push(`${SECURITY_EXPR('o')} = 'WEP'`);
      }
      if (f.securityFlags.includes('enterprise')) {
        flagClauses.push(`${SECURITY_EXPR('o')} IN ('WPA2-E', 'WPA3-E')`);
      }
      if (f.securityFlags.includes('personal')) {
        flagClauses.push(`${SECURITY_EXPR('o')} IN ('WPA', 'WPA2-P', 'WPA3-P')`);
      }
      if (f.securityFlags.includes('unknown')) {
        flagClauses.push(`${SECURITY_EXPR('o')} = 'Unknown'`);
      }
      if (flagClauses.length > 0) {
        where.push(`(${flagClauses.join(' OR ')})`);
        this.addApplied('security', 'securityFlags', f.securityFlags);
      }
    }

    if (e.timeframe && f.timeframe) {
      const scope = f.temporalScope || 'observation_time';
      if (scope === 'network_lifetime') {
        this.obsJoins.add('JOIN public.access_points ap ON ap.bssid = o.bssid');
      }
      if (scope === 'threat_window') {
        this.warnings.push(
          'Threat window scope mapped to observation_time (no threat timestamps).'
        );
      }
      if (f.timeframe.type === 'absolute') {
        if (f.timeframe.startTimestamp) {
          const target = scope === 'network_lifetime' ? 'ap.first_seen' : 'o.time';
          where.push(`${target} >= ${this.addParam(f.timeframe.startTimestamp)}`);
        }
        if (f.timeframe.endTimestamp) {
          const target = scope === 'network_lifetime' ? 'ap.last_seen' : 'o.time';
          where.push(`${target} <= ${this.addParam(f.timeframe.endTimestamp)}`);
        }
      } else {
        const window = RELATIVE_WINDOWS[f.timeframe.relativeWindow || '30d'];
        if (window) {
          const target = scope === 'network_lifetime' ? 'ap.last_seen' : 'o.time';
          where.push(`${target} >= NOW() - ${this.addParam(window)}::interval`);
        }
      }
      this.addApplied('temporal', 'timeframe', f.timeframe);
      this.addApplied('temporal', 'temporalScope', f.temporalScope || 'observation_time');
    }

    if (e.boundingBox && f.boundingBox) {
      where.push(`o.lat <= ${this.addParam(f.boundingBox.north)}`);
      where.push(`o.lat >= ${this.addParam(f.boundingBox.south)}`);
      where.push(`o.lon <= ${this.addParam(f.boundingBox.east)}`);
      where.push(`o.lon >= ${this.addParam(f.boundingBox.west)}`);
      this.addApplied('spatial', 'boundingBox', f.boundingBox);
    }

    if (e.radiusFilter && f.radiusFilter) {
      where.push(
        `ST_DWithin(
          ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${this.addParam(f.radiusFilter.longitude)}, ${this.addParam(
            f.radiusFilter.latitude
          )}), 4326)::geography,
          ${this.addParam(f.radiusFilter.radiusMeters)}
        )`
      );
      this.addApplied('spatial', 'radiusFilter', f.radiusFilter);
    }

    if (e.distanceFromHomeMin || e.distanceFromHomeMax) {
      this.requiresHome = true;
      const distanceExpr = `ST_Distance(
        home.home_point,
        COALESCE(o.geom, ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geometry)::geography
      )`;
      if (e.distanceFromHomeMin && f.distanceFromHomeMin !== undefined) {
        where.push(`${distanceExpr} >= ${this.addParam(f.distanceFromHomeMin)}`);
        this.addApplied('spatial', 'distanceFromHomeMin', f.distanceFromHomeMin);
      }
      if (e.distanceFromHomeMax && f.distanceFromHomeMax !== undefined) {
        where.push(`${distanceExpr} <= ${this.addParam(f.distanceFromHomeMax)}`);
        this.addApplied('spatial', 'distanceFromHomeMax', f.distanceFromHomeMax);
      }
    }

    if (e.ssid && !f.ssid) {
      this.addIgnored('identity', 'ssid', 'enabled_without_value');
    }
    if (e.bssid && !f.bssid) {
      this.addIgnored('identity', 'bssid', 'enabled_without_value');
    }
    if (e.manufacturer && !f.manufacturer) {
      this.addIgnored('identity', 'manufacturer', 'enabled_without_value');
    }
    if (e.networkId && !f.networkId) {
      this.addIgnored('identity', 'networkId', 'enabled_without_value');
    }
    if (e.radioTypes && (!Array.isArray(f.radioTypes) || f.radioTypes.length === 0)) {
      this.addIgnored('radio', 'radioTypes', 'enabled_without_value');
    }
    if (e.frequencyBands && (!Array.isArray(f.frequencyBands) || f.frequencyBands.length === 0)) {
      this.addIgnored('radio', 'frequencyBands', 'enabled_without_value');
    }
    if (e.channelMin && f.channelMin === undefined) {
      this.addIgnored('radio', 'channelMin', 'enabled_without_value');
    }
    if (e.channelMax && f.channelMax === undefined) {
      this.addIgnored('radio', 'channelMax', 'enabled_without_value');
    }
    if (e.rssiMin && f.rssiMin === undefined) {
      this.addIgnored('radio', 'rssiMin', 'enabled_without_value');
    }
    if (e.rssiMax && f.rssiMax === undefined) {
      this.addIgnored('radio', 'rssiMax', 'enabled_without_value');
    }
    if (
      e.encryptionTypes &&
      (!Array.isArray(f.encryptionTypes) || f.encryptionTypes.length === 0)
    ) {
      this.addIgnored('security', 'encryptionTypes', 'enabled_without_value');
    }
    if (e.authMethods && (!Array.isArray(f.authMethods) || f.authMethods.length === 0)) {
      this.addIgnored('security', 'authMethods', 'enabled_without_value');
    }
    if (e.insecureFlags && (!Array.isArray(f.insecureFlags) || f.insecureFlags.length === 0)) {
      this.addIgnored('security', 'insecureFlags', 'enabled_without_value');
    }
    if (e.securityFlags && (!Array.isArray(f.securityFlags) || f.securityFlags.length === 0)) {
      this.addIgnored('security', 'securityFlags', 'enabled_without_value');
    }
    if (e.timeframe && !f.timeframe) {
      this.addIgnored('temporal', 'timeframe', 'enabled_without_value');
    }
    if (e.boundingBox && !f.boundingBox) {
      this.addIgnored('spatial', 'boundingBox', 'enabled_without_value');
    }
    if (e.radiusFilter && !f.radiusFilter) {
      this.addIgnored('spatial', 'radiusFilter', 'enabled_without_value');
    }
    if (e.distanceFromHomeMin && f.distanceFromHomeMin === undefined) {
      this.addIgnored('spatial', 'distanceFromHomeMin', 'enabled_without_value');
    }
    if (e.distanceFromHomeMax && f.distanceFromHomeMax === undefined) {
      this.addIgnored('spatial', 'distanceFromHomeMax', 'enabled_without_value');
    }
    if (e.observationCountMin && f.observationCountMin === undefined) {
      this.addIgnored('quality', 'observationCountMin', 'enabled_without_value');
    }
    if (e.observationCountMax && f.observationCountMax === undefined) {
      this.addIgnored('quality', 'observationCountMax', 'enabled_without_value');
    }

    return { where, joins: Array.from(this.obsJoins) };
  }

  buildFilteredObservationsCte() {
    const { where, joins } = this.buildObservationFilters();
    const whereClause = where.length > 0 ? where.join(' AND ') : '1=1';
    const homeCte = this.requiresHome
      ? `home AS (
        SELECT
          ST_SetSRID(location::geometry, 4326)::geography AS home_point
        FROM app.location_markers
        WHERE marker_type = 'home'
        LIMIT 1
      )`
      : '';

    const homeJoin = this.requiresHome ? 'CROSS JOIN home' : '';
    const cte = `
    WITH ${homeCte ? `${homeCte},` : ''} filtered_obs AS (
      SELECT
        o.bssid,
        o.ssid,
        o.lat,
        o.lon,
        o.level,
        o.accuracy,
        o.time,
        o.radio_type,
        o.radio_frequency,
        o.radio_capabilities,
        o.geom,
        o.altitude
      FROM public.observations o
      ${homeJoin}
      ${joins.join('\n')}
      WHERE ${whereClause}
    )
    `;

    return { cte, params: this.params };
  }

  buildNetworkListQuery({ limit = 500, offset = 0, orderBy = 'last_observed_at DESC' } = {}) {
    const { cte, params } = this.buildFilteredObservationsCte();
    const networkWhere = this.buildNetworkWhere();

    const whereClause = networkWhere.length > 0 ? `WHERE ${networkWhere.join(' AND ')}` : '';

    const sql = `
      ${cte}
      , obs_rollup AS (
        SELECT
          bssid,
          COUNT(*) AS observation_count,
          MIN(time) AS first_observed_at,
          MAX(time) AS last_observed_at,
          COUNT(DISTINCT DATE(time)) AS unique_days,
          COUNT(DISTINCT ST_SnapToGrid(geom, 0.001)) AS unique_locations,
          AVG(level) AS avg_signal,
          MIN(level) AS min_signal,
          MAX(level) AS max_signal
        FROM filtered_obs
        GROUP BY bssid
      ),
      obs_latest AS (
        SELECT DISTINCT ON (bssid)
          bssid,
          ssid,
          lat,
          lon,
          level,
          accuracy,
          time AS observed_at,
          radio_frequency,
          radio_capabilities,
          radio_type,
          geom,
          altitude
        FROM filtered_obs
        ORDER BY bssid, time DESC
      ),
      obs_centroids AS (
        SELECT
          bssid,
          ST_Centroid(ST_Collect(geom::geometry)) AS centroid,
          MIN(time) AS first_time,
          MAX(time) AS last_time,
          COUNT(*) AS obs_count
        FROM filtered_obs
        WHERE geom IS NOT NULL
        GROUP BY bssid
      ),
      -- Stationary confidence derives from spatial variance, temporal spread, and observation density.
      obs_spatial AS (
        SELECT
          c.bssid,
          CASE
            WHEN c.obs_count < 2 THEN NULL
            ELSE ROUND(
              LEAST(1, GREATEST(0,
                (
                  (1 - LEAST(MAX(ST_Distance(o.geom::geography, c.centroid::geography)) / 500.0, 1)) * 0.5 +
                  (1 - LEAST(EXTRACT(EPOCH FROM (c.last_time - c.first_time)) / 3600 / 168, 1)) * 0.3 +
                  LEAST(c.obs_count / 50.0, 1) * 0.2
                )
              ))::numeric,
              3
            )
          END AS stationary_confidence
        FROM filtered_obs o
        JOIN obs_centroids c ON c.bssid = o.bssid
        WHERE o.geom IS NOT NULL
        GROUP BY c.bssid, c.centroid, c.first_time, c.last_time, c.obs_count
      )
      SELECT
        ne.bssid,
        ne.ssid,
        ne.type,
        ne.security,
        ne.frequency,
        ne.capabilities,
        ne.is_5ghz,
        ne.is_6ghz,
        ne.is_hidden,
        ne.first_seen,
        ne.last_seen,
        ne.manufacturer,
        ne.manufacturer_address,
        ne.min_altitude_m,
        ne.max_altitude_m,
        ne.altitude_span_m,
        ne.max_distance_meters,
        ne.last_altitude_m,
        ne.is_sentinel,
        ne.distance_from_home_km,
        r.observation_count AS observations,
        r.first_observed_at,
        r.last_observed_at,
        r.unique_days,
        r.unique_locations,
        r.avg_signal,
        r.min_signal,
        r.max_signal,
        l.observed_at,
        l.level AS signal,
        l.lat,
        l.lon,
        l.accuracy AS accuracy_meters,
        s.stationary_confidence,
        ne.threat,
        an.unified_id AS network_id
      FROM obs_rollup r
      JOIN obs_latest l ON l.bssid = r.bssid
      JOIN public.api_network_explorer ne ON ne.bssid = r.bssid
      LEFT JOIN obs_spatial s ON s.bssid = r.bssid
      LEFT JOIN app.networks an ON an.bssid = r.bssid
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${this.addParam(limit)} OFFSET ${this.addParam(offset)}
    `;

    return {
      sql,
      params: [...params, limit, offset],
      appliedFilters: this.appliedFilters,
      ignoredFilters: this.ignoredFilters,
      warnings: this.warnings,
    };
  }

  buildNetworkCountQuery() {
    const { cte, params } = this.buildFilteredObservationsCte();
    const networkWhere = this.buildNetworkWhere();
    const whereClause = networkWhere.length > 0 ? `WHERE ${networkWhere.join(' AND ')}` : '';

    const sql = `
      ${cte}
      , obs_rollup AS (
        SELECT
          bssid,
          COUNT(*) AS observation_count
        FROM filtered_obs
        GROUP BY bssid
      ),
      obs_centroids AS (
        SELECT
          bssid,
          ST_Centroid(ST_Collect(geom::geometry)) AS centroid,
          MIN(time) AS first_time,
          MAX(time) AS last_time,
          COUNT(*) AS obs_count
        FROM filtered_obs
        WHERE geom IS NOT NULL
        GROUP BY bssid
      ),
      obs_spatial AS (
        SELECT
          c.bssid,
          CASE
            WHEN c.obs_count < 2 THEN NULL
            ELSE ROUND(
              LEAST(1, GREATEST(0,
                (
                  (1 - LEAST(MAX(ST_Distance(o.geom::geography, c.centroid::geography)) / 500.0, 1)) * 0.5 +
                  (1 - LEAST(EXTRACT(EPOCH FROM (c.last_time - c.first_time)) / 3600 / 168, 1)) * 0.3 +
                  LEAST(c.obs_count / 50.0, 1) * 0.2
                )
              ))::numeric,
              3
            )
          END AS stationary_confidence
        FROM filtered_obs o
        JOIN obs_centroids c ON c.bssid = o.bssid
        WHERE o.geom IS NOT NULL
        GROUP BY c.bssid, c.centroid, c.first_time, c.last_time, c.obs_count
      )
      SELECT COUNT(DISTINCT r.bssid) AS total
      FROM obs_rollup r
      JOIN public.api_network_explorer ne ON ne.bssid = r.bssid
      LEFT JOIN obs_spatial s ON s.bssid = r.bssid
      ${whereClause}
    `;

    return { sql, params: [...params] };
  }

  buildNetworkWhere() {
    const f = this.filters;
    const e = this.enabled;
    const networkWhere = [];

    if (e.threatScoreMin && f.threatScoreMin !== undefined) {
      networkWhere.push(
        `(ne.threat->>'score')::numeric * 100 >= ${this.addParam(f.threatScoreMin)}`
      );
      this.addApplied('threat', 'threatScoreMin', f.threatScoreMin);
    }
    if (e.threatScoreMax && f.threatScoreMax !== undefined) {
      networkWhere.push(
        `(ne.threat->>'score')::numeric * 100 <= ${this.addParam(f.threatScoreMax)}`
      );
      this.addApplied('threat', 'threatScoreMax', f.threatScoreMax);
    }
    if (e.threatCategories && Array.isArray(f.threatCategories) && f.threatCategories.length > 0) {
      networkWhere.push(`LOWER(ne.threat->>'level') = ANY(${this.addParam(f.threatCategories)})`);
      this.addApplied('threat', 'threatCategories', f.threatCategories);
    }
    if (e.observationCountMin && f.observationCountMin !== undefined) {
      networkWhere.push(`r.observation_count >= ${this.addParam(f.observationCountMin)}`);
      this.addApplied('quality', 'observationCountMin', f.observationCountMin);
    }
    if (e.observationCountMax && f.observationCountMax !== undefined) {
      networkWhere.push(`r.observation_count <= ${this.addParam(f.observationCountMax)}`);
      this.addApplied('quality', 'observationCountMax', f.observationCountMax);
    }
    if (e.stationaryConfidenceMin && f.stationaryConfidenceMin !== undefined) {
      networkWhere.push(`s.stationary_confidence >= ${this.addParam(f.stationaryConfidenceMin)}`);
      this.addApplied('threat', 'stationaryConfidenceMin', f.stationaryConfidenceMin);
    }
    if (e.stationaryConfidenceMax && f.stationaryConfidenceMax !== undefined) {
      networkWhere.push(`s.stationary_confidence <= ${this.addParam(f.stationaryConfidenceMax)}`);
      this.addApplied('threat', 'stationaryConfidenceMax', f.stationaryConfidenceMax);
    }

    if (e.threatScoreMin && f.threatScoreMin === undefined) {
      this.addIgnored('threat', 'threatScoreMin', 'enabled_without_value');
    }
    if (e.threatScoreMax && f.threatScoreMax === undefined) {
      this.addIgnored('threat', 'threatScoreMax', 'enabled_without_value');
    }
    if (
      e.threatCategories &&
      (!Array.isArray(f.threatCategories) || f.threatCategories.length === 0)
    ) {
      this.addIgnored('threat', 'threatCategories', 'enabled_without_value');
    }
    if (e.stationaryConfidenceMin && f.stationaryConfidenceMin === undefined) {
      this.addIgnored('threat', 'stationaryConfidenceMin', 'enabled_without_value');
    }
    if (e.stationaryConfidenceMax && f.stationaryConfidenceMax === undefined) {
      this.addIgnored('threat', 'stationaryConfidenceMax', 'enabled_without_value');
    }

    return networkWhere;
  }

  buildGeospatialQuery({ limit = 5000, selectedBssids = [] } = {}) {
    const { cte, params } = this.buildFilteredObservationsCte();
    const selectionWhere = [];

    if (Array.isArray(selectedBssids) && selectedBssids.length > 0) {
      selectionWhere.push(`o.bssid = ANY(${this.addParam(selectedBssids)})`);
    }

    const whereClause = selectionWhere.length > 0 ? `AND ${selectionWhere.join(' AND ')}` : '';

    const sql = `
      ${cte}
      SELECT
        o.bssid,
        o.ssid,
        o.lat,
        o.lon,
        o.level,
        o.accuracy,
        o.time,
        o.radio_frequency,
        o.radio_capabilities,
        o.radio_type,
        o.altitude,
        ROW_NUMBER() OVER (PARTITION BY o.bssid ORDER BY o.time ASC) AS obs_number,
        ne.threat
      FROM filtered_obs o
      JOIN public.api_network_explorer ne ON ne.bssid = o.bssid
      WHERE o.lat IS NOT NULL
        AND o.lon IS NOT NULL
        ${whereClause}
      ORDER BY o.time ASC
      LIMIT ${this.addParam(limit)}
    `;

    return {
      sql,
      params: [...params, limit],
      appliedFilters: this.appliedFilters,
      ignoredFilters: this.ignoredFilters,
      warnings: this.warnings,
    };
  }

  buildAnalyticsQueries() {
    const { cte, params } = this.buildFilteredObservationsCte();

    const base = (query) => ({
      sql: `${cte}\n${query}`,
      params: [...params],
    });

    return {
      networkTypes: base(`
        SELECT
          CASE
            WHEN ne.type = 'W' THEN 'WiFi'
            WHEN ne.type = 'E' THEN 'BLE'
            WHEN ne.type = 'B' THEN 'BT'
            WHEN ne.type = 'L' THEN 'LTE'
            WHEN ne.type = 'N' THEN 'NR'
            WHEN ne.type = 'G' THEN 'GSM'
            ELSE 'Other'
          END AS network_type,
          COUNT(DISTINCT ne.bssid) AS count
        FROM filtered_obs o
        JOIN public.api_network_explorer ne ON ne.bssid = o.bssid
        GROUP BY network_type
        ORDER BY count DESC
      `),
      signalStrength: base(`
        WITH latest AS (
          SELECT DISTINCT ON (bssid)
            bssid,
            level
          FROM filtered_obs
          ORDER BY bssid, time DESC
        )
        SELECT
          CASE
            WHEN level >= -30 THEN '-30'
            WHEN level >= -40 THEN '-40'
            WHEN level >= -50 THEN '-50'
            WHEN level >= -60 THEN '-60'
            WHEN level >= -70 THEN '-70'
            WHEN level >= -80 THEN '-80'
            ELSE '-90'
          END AS signal_range,
          COUNT(*) AS count
        FROM latest
        WHERE level IS NOT NULL
        GROUP BY signal_range
        ORDER BY signal_range DESC
      `),
      security: base(`
        SELECT
          ${SECURITY_EXPR('o')} AS security_type,
          COUNT(*) AS count
        FROM filtered_obs o
        GROUP BY security_type
        ORDER BY count DESC
      `),
      threatDistribution: base(`
        SELECT
          CASE
            WHEN (ne.threat->>'score')::numeric * 100 >= 90 THEN '90-100'
            WHEN (ne.threat->>'score')::numeric * 100 >= 80 THEN '80-90'
            WHEN (ne.threat->>'score')::numeric * 100 >= 70 THEN '70-80'
            WHEN (ne.threat->>'score')::numeric * 100 >= 60 THEN '60-70'
            WHEN (ne.threat->>'score')::numeric * 100 >= 50 THEN '50-60'
            WHEN (ne.threat->>'score')::numeric * 100 >= 40 THEN '40-50'
            WHEN (ne.threat->>'score')::numeric * 100 >= 30 THEN '30-40'
            ELSE '0-30'
          END AS range,
          COUNT(DISTINCT ne.bssid) AS count
        FROM filtered_obs o
        JOIN public.api_network_explorer ne ON ne.bssid = o.bssid
        GROUP BY range
        ORDER BY range DESC
      `),
      temporalActivity: base(`
        SELECT
          EXTRACT(HOUR FROM time) AS hour,
          COUNT(*) AS count
        FROM filtered_obs
        GROUP BY hour
        ORDER BY hour
      `),
      radioTypeOverTime: base(`
        SELECT
          DATE_TRUNC('day', o.time) AS date,
          CASE
            WHEN ${OBS_TYPE_EXPR('o')} = 'W' THEN 'WiFi'
            WHEN ${OBS_TYPE_EXPR('o')} = 'E' THEN 'BLE'
            WHEN ${OBS_TYPE_EXPR('o')} = 'B' THEN 'BT'
            WHEN ${OBS_TYPE_EXPR('o')} = 'L' THEN 'LTE'
            WHEN ${OBS_TYPE_EXPR('o')} = 'N' THEN 'NR'
            WHEN ${OBS_TYPE_EXPR('o')} = 'G' THEN 'GSM'
            ELSE 'Other'
          END AS network_type,
          COUNT(*) AS count
        FROM filtered_obs o
        GROUP BY date, network_type
        ORDER BY date, network_type
      `),
      threatTrends: base(`
        WITH daily_networks AS (
          SELECT
            DATE_TRUNC('day', o.time) AS date,
            o.bssid
          FROM filtered_obs o
          GROUP BY date, o.bssid
        )
        SELECT
          d.date,
          ROUND(AVG((ne.threat->>'score')::numeric * 100)::numeric, 1) AS avg_score,
          COUNT(*) FILTER (WHERE (ne.threat->>'score')::numeric * 100 >= 80) AS critical_count,
          COUNT(*) FILTER (WHERE (ne.threat->>'score')::numeric * 100 >= 70
            AND (ne.threat->>'score')::numeric * 100 < 80) AS high_count,
          COUNT(*) FILTER (WHERE (ne.threat->>'score')::numeric * 100 >= 40
            AND (ne.threat->>'score')::numeric * 100 < 70) AS medium_count
        FROM daily_networks d
        JOIN public.api_network_explorer ne ON ne.bssid = d.bssid
        GROUP BY d.date
        ORDER BY d.date
      `),
      topNetworks: base(`
        SELECT
          o.bssid,
          MAX(o.ssid) AS ssid,
          COUNT(*) AS observation_count,
          MIN(o.time) AS first_seen,
          MAX(o.time) AS last_seen
        FROM filtered_obs o
        GROUP BY o.bssid
        ORDER BY observation_count DESC
        LIMIT 50
      `),
    };
  }
}

module.exports = {
  UniversalFilterQueryBuilder,
  validateFilterPayload,
  DEFAULT_ENABLED,
};
