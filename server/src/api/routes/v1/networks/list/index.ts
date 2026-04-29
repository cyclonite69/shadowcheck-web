export {};

import type { Request, Response } from 'express';
import { createNetworkListHandler } from './handler';

const express = require('express');
const router = express.Router();
const { networkService } = require('../../../../../config/container');
const { cacheMiddleware } = require('../../../../../middleware/cacheMiddleware');
const { asyncHandler } = require('../../../../../utils/asyncHandler');

router.get(
  '/networks',
  cacheMiddleware(60),
  asyncHandler(createNetworkListHandler(networkService))
);

module.exports = router;
