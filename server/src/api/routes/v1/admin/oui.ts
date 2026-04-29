/**
 * OUI Routes
 * Handles OUI grouping and MAC randomization analysis
 */

export {};
import { ouiGroupingDemoHtml } from '../../../../views/ouiGroupingDemo';

const express = require('express');
const router = express.Router();
const {
  adminNetworkTagsService,
  ouiGroupingService: OUIGroupingService,
} = require('../../../../config/container');
const logger = require('../../../../logging/logger');

/**
 * GET /api/admin/oui/groups
 * Get all OUI device groups with collective threat scores
 */
router.get('/admin/oui/groups', async (req: any, res: any) => {
  try {
    const groups = await adminNetworkTagsService.getOUIGroups();

    res.json({
      ok: true,
      groups,
      count: groups.length,
    });
  } catch (err: any) {
    logger.error('Failed to get OUI groups:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch OUI groups' });
  }
});

/**
 * GET /api/admin/oui/:oui/details
 * Get detailed info for specific OUI group
 */
router.get('/admin/oui/:oui/details', async (req: any, res: any) => {
  try {
    const { oui } = req.params;

    const { group, randomization, networks } =
      await adminNetworkTagsService.getOUIGroupDetails(oui);

    res.json({
      ok: true,
      group,
      randomization,
      networks,
    });
  } catch (err: any) {
    logger.error('Failed to get OUI details:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch OUI details' });
  }
});

/**
 * GET /api/admin/oui/randomization/suspects
 * Get all suspected MAC randomization devices
 */
router.get('/admin/oui/randomization/suspects', async (req: any, res: any) => {
  try {
    const suspects = await adminNetworkTagsService.getMACRandomizationSuspects();

    res.json({
      ok: true,
      suspects,
      count: suspects.length,
    });
  } catch (err: any) {
    logger.error('Failed to get randomization suspects:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch suspects' });
  }
});

/**
 * POST /api/admin/oui/analyze
 * Trigger OUI grouping and MAC randomization analysis
 */
router.post('/admin/oui/analyze', async (req: any, res: any) => {
  try {
    logger.info('[Admin] Starting OUI analysis...');
    await OUIGroupingService.generateOUIGroups();
    await OUIGroupingService.detectMACRandomization();

    res.json({
      ok: true,
      message: 'OUI analysis completed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('OUI analysis failed:', err);
    res.status(500).json({ ok: false, error: 'OUI analysis failed' });
  }
});

/**
 * GET /api/admin/demo/oui-grouping - Serve OUI grouping demo page
 */
router.get('/admin/demo/oui-grouping', (_req: any, res: any) => {
  res.send(ouiGroupingDemoHtml);
});

export default router;
