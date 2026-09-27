/**
 * Kepler Service Layer
 * Thin orchestrator: validates filters, builds queries, delegates DB and transforms.
 */

const logger = require('../logging/logger');
const filterQueryBuilder = require('./filterQueryBuilder');
const { UniversalFilterQueryBuilder, validateFilterPayload } = filterQueryBuilder;
const {
  checkHomeLocationExists,
  executeKeplerQuery,
  streamKeplerQuery,
} = require('../repositories/keplerRepository');
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
export {
  checkHomeLocationExists,
  executeKeplerQuery,
  streamKeplerQuery,
} from '../repositories/keplerRepository';

async function assertHomeExistsIfNeeded(enabled: Record<string, any>) {
  if (enabled?.distanceFromHomeMin || enabled?.distanceFromHomeMax) {
    const exists = await checkHomeLocationExists();
    if (!exists) {
      throw new Error('Home location is required for distance filters.');
    }
  }
}

export async function getKeplerData(
  filters: any,
  enabled: any,
  limit: number | null,
  offset: number = 0
) {
  const { errors } = validateFilterPayload(filters, enabled);
  if (errors.length > 0) {
    const validationError = { status: 400, errors };
    throw validationError;
  }
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
  if (errors.length > 0) {
    const validationError = { status: 400, errors };
    throw validationError;
  }
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
  if (errors.length > 0) {
    const validationError = { status: 400, errors };
    throw validationError;
  }
  await assertHomeExistsIfNeeded(enabled);
  const { sql, params } = new UniversalFilterQueryBuilder(filters, enabled).buildNetworkListQuery({
    limit,
    offset,
  });
  const result = await executeKeplerQuery(sql, params);
  return buildKeplerNetworksGeoJson(result.rows || [], result.rowCount);
}

export async function streamKeplerObservations(
  filters: any,
  enabled: any,
  limit: number | null,
  res: any,
  signal?: AbortSignal
): Promise<void> {
  const { errors } = validateFilterPayload(filters, enabled);
  if (errors.length > 0) {
    const validationError = { status: 400, errors };
    throw validationError;
  }
  await assertHomeExistsIfNeeded(enabled);

  const { sql, params } = new UniversalFilterQueryBuilder(filters, enabled).buildGeospatialQuery({
    limit,
  });

  const batchSize = 10000;
  let firstChunk = true;
  let totalObservations = 0;
  const uniqueBssids = new Set<string>();

  const writeWithBackpressure = async (chunk: string): Promise<boolean> => {
    if (signal?.aborted || res.writableEnded) {
      return false;
    }
    const canContinue = res.write(chunk);
    if (!canContinue) {
      await new Promise<void>((resolve) => {
        let targetStream: any = null;
        const onDrain = () => {
          cleanup();
          resolve();
        };
        const onClose = () => {
          cleanup();
          resolve();
        };
        const cleanup = () => {
          res.removeListener('close', onClose);
          if (targetStream && typeof targetStream.removeListener === 'function') {
            targetStream.removeListener('drain', onDrain);
          }
          res.removeListener('drain', onDrain);
        };
        // In compression middleware, res.on('drain') delegates to the underlying transform stream (e.g. BrotliCompress)
        // and returns it, but res.removeListener does not; targetStream captures it for symmetric cleanup.
        // Note: Headers and opening boilerplate write ensure the compression transform is live before any stall.
        targetStream = res.on('drain', onDrain);
        res.once('close', onClose);
      });
    }
    return true;
  };

  try {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
    });

    await writeWithBackpressure('{"type":"FeatureCollection","features":[');

    await streamKeplerQuery(
      sql,
      params,
      batchSize,
      async (batchRows: any[]) => {
        if (signal?.aborted || res.writableEnded) {
          return;
        }

        for (let i = 0; i < batchRows.length; i++) {
          const b = batchRows[i].bssid;
          if (b) {
            uniqueBssids.add(b);
          }
        }
        totalObservations += batchRows.length;

        const partialGeo = buildKeplerObservationsGeoJson(batchRows, batchRows.length);
        if (partialGeo.features && partialGeo.features.length > 0) {
          let featuresStr = JSON.stringify(partialGeo.features);
          // Strip outer brackets '[' and ']'
          featuresStr = featuresStr.slice(1, -1);
          if (featuresStr.length > 0) {
            const separator = firstChunk ? '' : ',';
            firstChunk = false;
            await writeWithBackpressure(separator + featuresStr);
          }
        }
      },
      signal
    );

    if (signal?.aborted || res.writableEnded) {
      return;
    }

    const footer = `],"actualCounts":{"observations":${totalObservations},"networks":${uniqueBssids.size}},"complete":true}`;
    await writeWithBackpressure(footer);
    res.end();
  } catch (err: any) {
    logger.error(`Kepler observations mid-stream cursor failure: ${err.message || err}`, {
      error: err,
      stack: err.stack,
    });
    if (!res.headersSent) {
      throw err;
    } else {
      res.destroy(err);
    }
  }
}

module.exports = {
  checkHomeLocationExists,
  executeKeplerQuery,
  streamKeplerQuery,
  getKeplerData,
  getKeplerObservations,
  streamKeplerObservations,
  getKeplerNetworks,
  inferRadioType: require('./kepler/keplerTransforms').inferRadioType,
  buildKeplerDataGeoJson,
  buildKeplerObservationsGeoJson,
  buildKeplerNetworksGeoJson,
};
