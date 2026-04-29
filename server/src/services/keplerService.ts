/**
 * Kepler Service Layer
 * Thin orchestrator: validates filters, builds queries, delegates DB and transforms.
 */

const filterQueryBuilder = require('./filterQueryBuilder');
const { UniversalFilterQueryBuilder, validateFilterPayload } = filterQueryBuilder;
const { checkHomeLocationExists, executeKeplerQuery } = require('../repositories/keplerRepository');
const {
  buildKeplerDataGeoJson,
  buildKeplerObservationsGeoJson,
  buildKeplerNetworksGeoJson,
} = require('./kepler/keplerTransforms');

export {
  inferRadioType,
  buildKeplerDataGeoJson,
  buildKeplerObservationsGeoJson,
  buildKeplerNetworksGeoJson,
  KeplerNetworkRow,
  KeplerObsRow,
} from './kepler/keplerTransforms';
export { checkHomeLocationExists, executeKeplerQuery } from '../repositories/keplerRepository';

async function assertHomeExistsIfNeeded(enabled: Record<string, any>) {
  if (enabled?.distanceFromHomeMin || enabled?.distanceFromHomeMax) {
    const exists = await checkHomeLocationExists();
    if (!exists) throw new Error('Home location is required for distance filters.');
  }
}

export async function getKeplerData(
  filters: any,
  enabled: any,
  limit: number | null,
  offset: number = 0
) {
  const { errors } = validateFilterPayload(filters, enabled);
  if (errors.length > 0) throw { status: 400, errors };
  await assertHomeExistsIfNeeded(enabled);
  const { sql, params } = new UniversalFilterQueryBuilder(filters, enabled).buildNetworkListQuery({
    limit,
    offset,
  });
  const result = await executeKeplerQuery(sql, params);
  return buildKeplerDataGeoJson(result.rows || [], result.rowCount);
}

export async function getKeplerObservations(filters: any, enabled: any, limit: number | null) {
  const { errors } = validateFilterPayload(filters, enabled);
  if (errors.length > 0) throw { status: 400, errors };
  await assertHomeExistsIfNeeded(enabled);
  const { sql, params } = new UniversalFilterQueryBuilder(filters, enabled).buildGeospatialQuery({
    limit,
  });
  const result = await executeKeplerQuery(sql, params);
  return buildKeplerObservationsGeoJson(result.rows || [], result.rowCount);
}

export async function getKeplerNetworks(
  filters: any,
  enabled: any,
  limit: number | null,
  offset: number = 0
) {
  const { errors } = validateFilterPayload(filters, enabled);
  if (errors.length > 0) throw { status: 400, errors };
  await assertHomeExistsIfNeeded(enabled);
  const { sql, params } = new UniversalFilterQueryBuilder(filters, enabled).buildNetworkListQuery({
    limit,
    offset,
  });
  const result = await executeKeplerQuery(sql, params);
  return buildKeplerNetworksGeoJson(result.rows || [], result.rowCount);
}

module.exports = {
  checkHomeLocationExists,
  executeKeplerQuery,
  getKeplerData,
  getKeplerObservations,
  getKeplerNetworks,
  inferRadioType: require('./kepler/keplerTransforms').inferRadioType,
  buildKeplerDataGeoJson,
  buildKeplerObservationsGeoJson,
  buildKeplerNetworksGeoJson,
};
