/**
 * Kepler Service Layer
 * Encapsulates database queries and data shaping for Kepler.gl operations
 */

const { query } = require('../config/database');
const filterQueryBuilder = require('./filterQueryBuilder');
const { UniversalFilterQueryBuilder, validateFilterPayload } = filterQueryBuilder;
import {
  buildKeplerDataGeoJson,
  buildKeplerNetworksGeoJson,
  buildKeplerObservationsGeoJson,
} from '../api/routes/v1/keplerHelpers';

export async function checkHomeLocationExists(): Promise<boolean> {
  try {
    const home = await query(
      "SELECT 1 FROM app.location_markers WHERE marker_type = 'home' LIMIT 1"
    );
    return home.rowCount > 0;
  } catch (err: any) {
    if (err && err.code === '42P01') {
      throw new Error('Home location markers table is missing (app.location_markers).');
    }
    throw err;
  }
}

export async function executeKeplerQuery(sql: string, params: any[]): Promise<any> {
  await query("SET LOCAL statement_timeout = '120000ms'");
  const result = await query(sql, params);
  return result;
}

/**
 * Ensures home location exists if distance filters are enabled
 */
async function assertHomeExistsIfNeeded(enabled: Record<string, any>) {
  if (enabled?.distanceFromHomeMin || enabled?.distanceFromHomeMax) {
    const exists = await checkHomeLocationExists();
    if (!exists) {
      throw new Error('Home location is required for distance filters.');
    }
  }
}

/**
 * Get latest observation per network for Kepler.gl
 */
export async function getKeplerData(
  filters: any,
  enabled: any,
  limit: number | null,
  offset: number = 0
) {
  const { errors } = validateFilterPayload(filters, enabled);
  if (errors.length > 0) {
    throw { status: 400, errors };
  }

  await assertHomeExistsIfNeeded(enabled);

  const builder = new UniversalFilterQueryBuilder(filters, enabled);
  const { sql, params } = builder.buildNetworkListQuery({ limit, offset });

  const result = await executeKeplerQuery(sql, params);
  return buildKeplerDataGeoJson(result.rows || [], result.rowCount);
}

/**
 * Get full observations dataset for Kepler.gl
 */
export async function getKeplerObservations(filters: any, enabled: any, limit: number | null) {
  const { errors } = validateFilterPayload(filters, enabled);
  if (errors.length > 0) {
    throw { status: 400, errors };
  }

  await assertHomeExistsIfNeeded(enabled);

  const builder = new UniversalFilterQueryBuilder(filters, enabled);
  const { sql, params } = builder.buildGeospatialQuery({ limit });

  const result = await executeKeplerQuery(sql, params);
  return buildKeplerObservationsGeoJson(result.rows || [], result.rowCount);
}

/**
 * Get network summaries for Kepler.gl
 */
export async function getKeplerNetworks(
  filters: any,
  enabled: any,
  limit: number | null,
  offset: number = 0
) {
  const { errors } = validateFilterPayload(filters, enabled);
  if (errors.length > 0) {
    throw { status: 400, errors };
  }

  await assertHomeExistsIfNeeded(enabled);

  const builder = new UniversalFilterQueryBuilder(filters, enabled);
  const { sql, params } = builder.buildNetworkListQuery({ limit, offset });

  const result = await executeKeplerQuery(sql, params);
  return buildKeplerNetworksGeoJson(result.rows || [], result.rowCount);
}

module.exports = {
  checkHomeLocationExists,
  executeKeplerQuery,
  getKeplerData,
  getKeplerObservations,
  getKeplerNetworks,
};
