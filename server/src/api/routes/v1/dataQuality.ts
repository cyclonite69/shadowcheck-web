import { Router, Request, Response } from 'express';
const path = require('path');
const { miscService, dataQualityFilters } = require('../../../config/container');
const { DATA_QUALITY_FILTERS } = dataQualityFilters;
const logger = require('../../../logging/logger');

const router = Router();

/**
 * GET /demo/oui-grouping
 * Serves the OUI grouping demo page.
 */
router.get('/demo/oui-grouping', (req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public', 'oui-grouping-demo.html'));
});

/**
 * GET /api/data-quality
 * Returns data quality metrics for observations.
 */
router.get('/data-quality', async (req: Request, res: Response) => {
  try {
    const filter = (req.query.filter as string) || 'none';

    let whereClause = '';
    if (filter === 'temporal') {
      whereClause = DATA_QUALITY_FILTERS.temporal_clusters;
    } else if (filter === 'extreme') {
      whereClause = DATA_QUALITY_FILTERS.extreme_signals;
    } else if (filter === 'duplicate') {
      whereClause = DATA_QUALITY_FILTERS.duplicate_coords;
    } else if (filter === 'all') {
      whereClause = DATA_QUALITY_FILTERS.all();
    }

    const metrics = await miscService.getDataQualityMetrics(whereClause);
    res.json({
      filter_applied: filter,
      ...metrics,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Data quality error: ${msg}`, { error });
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
