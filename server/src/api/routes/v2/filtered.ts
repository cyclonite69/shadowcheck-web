/**
 * Universal Filtered Networks API (v2)
 * Single source of truth for list, map, analytics, and observation queries.
 */

import type { Request, Response, NextFunction } from 'express';
import { createHandlers } from './filteredHandlers';
import { ROUTE_CONFIG } from '../../../config/routeConfig';

const express = require('express');
const router = express.Router();
const {
  filterQueryBuilder,
  filteredAnalyticsService,
  v2Service,
} = require('../../../config/container');
const logger = require('../../../logging/logger');
const { asyncHandler } = require('../../../utils/asyncHandler');
const { validators } = require('../../../utils/validators');

const handlers = createHandlers({
  filterQueryBuilder: {
    UniversalFilterQueryBuilder: filterQueryBuilder.UniversalFilterQueryBuilder,
    validateFilterPayload: filterQueryBuilder.validateFilterPayload,
  },
  v2Service,
  filteredAnalyticsService,
  logger,
  validators,
});

router.get('/', asyncHandler(handlers.list));
router.get('/geospatial', asyncHandler(handlers.geospatial));
router.get('/observations', asyncHandler(handlers.getObservations));
router.post('/observations', asyncHandler(handlers.postObservations));
router.get('/analytics', asyncHandler(handlers.analytics));
router.get('/debug', handlers.debug);

module.exports = router;
