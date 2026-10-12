/**
 * Kepler Service Layer
 * Thin orchestrator: validates filters, builds queries, delegates DB and transforms.
 */

const logger = require('../logging/logger');
import {
  Field,
  Float64,
  Int32,
  Int64,
  makeData,
  RecordBatch,
  RecordBatchWriter,
  Schema,
  Struct,
  Utf8,
  vectorFromArray,
} from 'apache-arrow';
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

const OBSERVATION_ARROW_SCHEMA = new Schema([
  new Field('id', new Int64(), true),
  new Field('lon', new Float64(), false),
  new Field('lat', new Float64(), false),
  new Field('level', new Int32(), false),
  new Field('observed_at_ms', new Int64(), false),
  new Field('bssid', new Utf8(), false),
  new Field('ssid', new Utf8(), true),
]);

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

function toArrowInt64(value: unknown, fallback: bigint | null): bigint | null {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    return fallback;
  }
}

function toArrowNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return number || fallback;
}

function makeObservationArrowRecordBatch(rows: any[]): RecordBatch {
  const columns = [
    vectorFromArray(
      rows.map((row) => toArrowInt64(row.id, null)),
      new Int64()
    ),
    vectorFromArray(
      rows.map((row) => toArrowNumber(row.lon, 0)),
      new Float64()
    ),
    vectorFromArray(
      rows.map((row) => toArrowNumber(row.lat, 0)),
      new Float64()
    ),
    vectorFromArray(
      rows.map((row) => toArrowNumber(row.level, -100)),
      new Int32()
    ),
    vectorFromArray(
      rows.map((row) => toArrowInt64(row.observed_at_ms, 0n) ?? 0n),
      new Int64()
    ),
    vectorFromArray(
      rows.map((row) => String(row.bssid || '')),
      new Utf8()
    ),
    vectorFromArray(
      rows.map((row) => String(row.ssid || '')),
      new Utf8()
    ),
  ];
  return new RecordBatch(
    OBSERVATION_ARROW_SCHEMA,
    makeData({
      type: new Struct(OBSERVATION_ARROW_SCHEMA.fields),
      length: rows.length,
      children: columns.map((column) => column.data[0]),
      nullCount: 0,
    })
  );
}

function waitForArrowWriterDrain(
  writer: NodeJS.WritableStream,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      writer.removeListener('drain', onDrain);
      writer.removeListener('error', onError);
      writer.removeListener('close', onClose);
      signal?.removeEventListener('abort', onAbort);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onClose = () => {
      cleanup();
      reject(new Error('Arrow response stream closed before completing'));
    };
    const onAbort = () => {
      cleanup();
      resolve();
    };
    if (signal?.aborted) {
      resolve();
      return;
    }
    writer.once('drain', onDrain);
    writer.once('error', onError);
    writer.once('close', onClose);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function streamKeplerObservationsArrow(
  filters: any,
  enabled: any,
  limit: number | null,
  res: any,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted || res.destroyed) {
    return;
  }
  const { errors } = validateFilterPayload(filters, enabled);
  if (errors.length > 0) {
    const validationError: any = new Error('Invalid filter payload');
    validationError.status = 400;
    validationError.errors = errors;
    throw validationError;
  }
  await assertHomeExistsIfNeeded(enabled);

  const { sql, params } = new UniversalFilterQueryBuilder(filters, enabled).buildGeospatialQuery({
    limit,
    includeObservationMetadata: true,
  });
  const writer = RecordBatchWriter.throughNode();
  const writerAbort = new AbortController();
  const forwardAbort = () => writerAbort.abort();
  if (signal?.aborted) {
    writerAbort.abort();
  } else {
    signal?.addEventListener('abort', forwardAbort, { once: true });
  }
  let writerFailure: Error | null = null;
  let wroteBatch = false;
  writer.on('error', (error: Error) => {
    writerFailure = error;
    writerAbort.abort();
    logger.error(`Kepler Arrow writer failure: ${error.message}`, { error });
  });
  writer.pipe(res);
  res.writeHead(200, {
    'Content-Type': 'application/vnd.apache.arrow.stream',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
  });

  try {
    await streamKeplerQuery(
      sql,
      params,
      25000,
      async (rows: any[]) => {
        if (writerFailure) {
          throw writerFailure;
        }
        if (signal?.aborted || res.destroyed) {
          return;
        }
        if (!writer.write(makeObservationArrowRecordBatch(rows))) {
          await waitForArrowWriterDrain(writer, writerAbort.signal);
        }
        wroteBatch = true;
      },
      writerAbort.signal
    );

    if (writerFailure) {
      throw writerFailure;
    }
    if (!signal?.aborted && !res.destroyed) {
      if (!wroteBatch) {
        writer.write(makeObservationArrowRecordBatch([]));
      }
      const finished = new Promise<void>((resolve, reject) => {
        const onFinish = () => {
          cleanup();
          resolve();
        };
        const onClose = () => {
          cleanup();
          resolve();
        };
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const cleanup = () => {
          res.removeListener('finish', onFinish);
          res.removeListener('close', onClose);
          res.removeListener('error', onError);
        };
        res.once('finish', onFinish);
        res.once('close', onClose);
        res.once('error', onError);
      });
      writer.end();
      await finished;
    } else {
      writer.destroy();
    }
  } catch (error: any) {
    writer.destroy(error);
    logger.error(`Kepler Arrow stream failure: ${error.message || error}`, {
      error,
      stack: error.stack,
    });
    if (!res.headersSent) {
      throw error;
    }
    if (!res.destroyed) {
      res.destroy(error);
    }
  } finally {
    signal?.removeEventListener('abort', forwardAbort);
  }
}

module.exports = {
  checkHomeLocationExists,
  executeKeplerQuery,
  streamKeplerQuery,
  getKeplerData,
  getKeplerObservations,
  streamKeplerObservations,
  streamKeplerObservationsArrow,
  getKeplerNetworks,
  inferRadioType: require('./kepler/keplerTransforms').inferRadioType,
  buildKeplerDataGeoJson,
  buildKeplerObservationsGeoJson,
  buildKeplerNetworksGeoJson,
};
