export {};
import type { Request, Response } from 'express';
/**
 * Kepler Routes (v1)
 * Provides GeoJSON endpoints for Kepler.gl visualization
 */

const express = require('express');
const router = express.Router();
const { keplerService } = require('../../../config/container');
const logger = require('../../../logging/logger');
import { parseJsonParam } from './keplerHelpers';

/**
 * GET /api/kepler/data
 * Returns latest observation per network for Kepler.gl.
 */
router.get('/kepler/data', async (req: Request, res: Response) => {
  try {
    const { limit: limitRaw, offset: offsetRaw } = req.query;
    const limit = limitRaw ? parseInt(String(limitRaw), 10) : null;
    const offset = offsetRaw ? parseInt(String(offsetRaw), 10) : 0;

    const filters = parseJsonParam(req.query.filters, {}, 'filters');
    const enabled = parseJsonParam(req.query.enabled, {}, 'enabled');

    const result = await keplerService.getKeplerData(filters, enabled, limit, offset);
    res.json(result);
  } catch (error: any) {
    if (error.status === 400) {
      return res.status(400).json({ ok: false, errors: error.errors || [error.message] });
    }
    const msg = error.message || String(error);
    logger.error(`Kepler data error: ${msg}`, { error });
    res
      .status(error.status || 500)
      .json({ ok: false, error: msg || 'Failed to fetch kepler data' });
  }
});

/**
 * GET /api/kepler/observations
 * Returns full observations dataset for Kepler.gl.
 */
router.get('/kepler/observations', async (req: Request, res: Response) => {
  try {
    const filters = parseJsonParam(req.query.filters, {}, 'filters');
    const enabled = parseJsonParam(req.query.enabled, {}, 'enabled');

    const limitRaw = req.query.limit;
    const limit = limitRaw ? parseInt(String(limitRaw), 10) : null;

    const result = await keplerService.getKeplerObservations(filters, enabled, limit);
    res.json(result);
  } catch (error: any) {
    if (error.status === 400) {
      return res.status(400).json({ ok: false, errors: error.errors || [error.message] });
    }
    const msg = error.message || String(error);
    logger.error(`Observations data error: ${msg}`, { error });
    res.status(error.status || 500).json({ ok: false, error: msg });
  }
});

/**
 * GET /api/kepler/networks
 * Returns network summaries for Kepler.gl.
 */
router.get('/kepler/networks', async (req: Request, res: Response) => {
  try {
    const filters = parseJsonParam(req.query.filters, {}, 'filters');
    const enabled = parseJsonParam(req.query.enabled, {}, 'enabled');

    const { limit: limitRaw, offset: offsetRaw } = req.query;
    const limit = limitRaw ? parseInt(String(limitRaw), 10) : null;
    const offset = offsetRaw ? parseInt(String(offsetRaw), 10) : 0;

    const result = await keplerService.getKeplerNetworks(filters, enabled, limit, offset);
    res.json(result);
  } catch (error: any) {
    if (error.status === 400) {
      return res.status(400).json({ ok: false, errors: error.errors || [error.message] });
    }
    const msg = error.message || String(error);
    logger.error(`Networks data error: ${msg}`, { error });
    res.status(error.status || 500).json({ ok: false, error: msg });
  }
});

module.exports = router;
