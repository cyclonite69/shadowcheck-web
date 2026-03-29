export {};
import type { Request, Response } from 'express';
/**
 * Kepler Routes (v1)
 * Provides GeoJSON endpoints for Kepler.gl visualization
 */

const express = require('express');
const router = express.Router();
const { keplerService, filterQueryBuilder } = require('../../../config/container');
const { UniversalFilterQueryBuilder, validateFilterPayload } = filterQueryBuilder;
const logger = require('../../../logging/logger');
import {
  buildKeplerDataGeoJson,
  buildKeplerNetworksGeoJson,
  buildKeplerObservationsGeoJson,
  parseJsonParam,
} from './keplerHelpers';

const assertHomeExistsIfNeeded = async (
  enabled: Record<string, unknown> | null | undefined,
  res: Response
) => {
  if (!enabled?.distanceFromHomeMin && !enabled?.distanceFromHomeMax) {
    return true;
  }
  try {
    const exists = await keplerService.checkHomeLocationExists();
    if (!exists) {
      res.status(400).json({
        ok: false,
        error: 'Home location is required for distance filters.',
      });
      return false;
    }
    return true;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(400).json({
      ok: false,
      error: errMsg,
    });
    return false;
  }
};

/**
 * GET /api/kepler/data
 * Returns latest observation per network for Kepler.gl.
 */
router.get('/kepler/data', async (req: Request, res: Response) => {
  try {
    const { limit: limitRaw, offset: offsetRaw } = req.query;
    const limit = limitRaw ? parseInt(String(limitRaw), 10) : null;
    const offset = offsetRaw ? parseInt(String(offsetRaw), 10) : 0;
    let filters = {};
    let enabled = {};
    try {
      filters = parseJsonParam(req.query.filters, {}, 'filters');
      enabled = parseJsonParam(req.query.enabled, {}, 'enabled');
    } catch (err) {
      return res
        .status(400)
        .json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    const { errors } = validateFilterPayload(filters, enabled);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    if (!(await assertHomeExistsIfNeeded(enabled, res))) {
      return;
    }

    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const { sql, params } = builder.buildNetworkListQuery({ limit, offset });

    const result = await keplerService.executeKeplerQuery(sql, params);

    res.json(buildKeplerDataGeoJson(result.rows || [], result.rowCount));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Kepler data error: ${msg}`, { error });
    res.status(500).json({ error: msg || 'Failed to fetch kepler data' });
  }
});

/**
 * GET /api/kepler/observations
 * Returns full observations dataset for Kepler.gl.
 */
router.get('/kepler/observations', async (req: Request, res: Response) => {
  try {
    let filters = {};
    let enabled = {};
    try {
      filters = parseJsonParam(req.query.filters, {}, 'filters');
      enabled = parseJsonParam(req.query.enabled, {}, 'enabled');
    } catch (err) {
      return res
        .status(400)
        .json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    const { errors } = validateFilterPayload(filters, enabled);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    if (!(await assertHomeExistsIfNeeded(enabled, res))) {
      return;
    }

    const limitRaw = req.query.limit;
    const limit = limitRaw ? parseInt(String(limitRaw), 10) : null;

    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const { sql, params } = builder.buildGeospatialQuery({ limit });

    const result = await keplerService.executeKeplerQuery(sql, params);

    res.json(buildKeplerObservationsGeoJson(result.rows || [], result.rowCount));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Observations data error: ${msg}`, { error });
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/kepler/networks
 * Returns trilaterated networks from access_points for Kepler.gl.
 */
router.get('/kepler/networks', async (req: Request, res: Response) => {
  try {
    let filters = {};
    let enabled = {};
    try {
      filters = parseJsonParam(req.query.filters, {}, 'filters');
      enabled = parseJsonParam(req.query.enabled, {}, 'enabled');
    } catch (err) {
      return res
        .status(400)
        .json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    const { errors } = validateFilterPayload(filters, enabled);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    if (!(await assertHomeExistsIfNeeded(enabled, res))) {
      return;
    }

    const { limit: limitRaw, offset: offsetRaw } = req.query;
    const limit = limitRaw ? parseInt(String(limitRaw), 10) : null;
    const offset = offsetRaw ? parseInt(String(offsetRaw), 10) : 0;

    const builder = new UniversalFilterQueryBuilder(filters, enabled);
    const { sql, params } = builder.buildNetworkListQuery({ limit, offset });

    const result = await keplerService.executeKeplerQuery(sql, params);

    res.json(buildKeplerNetworksGeoJson(result.rows || [], result.rowCount));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Networks data error: ${msg}`, { error });
    res.status(500).json({ error: msg });
  }
});

module.exports = router;
