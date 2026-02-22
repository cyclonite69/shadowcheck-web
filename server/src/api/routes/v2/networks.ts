import type { Request, Response, NextFunction } from 'express';

const express = require('express');
const router = express.Router();
const { v2Service } = require('../../../config/container');
const { CONFIG } = require('../../../config/database');

router.get('/v2/networks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 500, CONFIG.MAX_PAGE_SIZE);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);
    const search = req.query.search ? String(req.query.search).trim() : '';
    const sort = ((req.query.sort as string) || 'observed_at').toLowerCase();
    const order = ((req.query.order as string) || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const result = await v2Service.listNetworks({ limit, offset, search, sort, order });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/v2/networks/:bssid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bssid = String(req.params.bssid || '').toUpperCase();
    const result = await v2Service.getNetworkDetail(bssid);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/v2/dashboard/metrics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await v2Service.getDashboardMetrics();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/v2/threats/map', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const severity = ((req.query.severity as string) || '').toLowerCase();
    const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 30, 1), 180);
    const result = await v2Service.getThreatMapData({ severity, days });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
