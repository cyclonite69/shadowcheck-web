import type { Request, Response } from 'express';
import { ROUTE_CONFIG } from '../routeConfig';

const express = require('express');
const router = express.Router();
const { v2Service } = require('../../../config/container');
const { asyncHandler } = require('../../../utils/asyncHandler');
const { validators } = require('../../../utils/validators');

const NETWORK_SORT_COLS = ['observed_at', 'bssid', 'ssid', 'threat_score_v2', 'bestlevel'];

router.get(
  '/v2/networks',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = validators.limit(req.query.limit as string, 1, ROUTE_CONFIG.maxPageSize, 500);
    const offset = validators.offset(req.query.offset as string);
    const search = validators.search(req.query.search as string);
    const sort = validators.sort(req.query.sort as string, NETWORK_SORT_COLS);
    const order = validators.order(req.query.order as string);

    const result = await v2Service.listNetworks({ limit, offset, search, sort, order });
    res.json(result);
  })
);

router.get(
  '/v2/networks/:bssid',
  asyncHandler(async (req: Request, res: Response) => {
    const bssid = String(req.params.bssid || '').toUpperCase();
    const result = await v2Service.getNetworkDetail(bssid);
    res.json(result);
  })
);

router.get(
  '/v2/dashboard/metrics',
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await v2Service.getDashboardMetrics();
    res.json(result);
  })
);

router.get(
  '/v2/threats/map',
  asyncHandler(async (req: Request, res: Response) => {
    const severity = validators.search(req.query.severity as string).toLowerCase();
    const days = validators.limit(req.query.days as string, 1, 180, 30);
    const result = await v2Service.getThreatMapData({ severity, days });
    res.json(result);
  })
);

module.exports = router;
