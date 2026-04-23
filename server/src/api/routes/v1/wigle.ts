import { Router, Request, Response } from 'express';
const path = require('path');
const { wigleImportService } = require('../../../config/container');
const { importWigleDirectory } = wigleImportService;
const logger = require('../../../logging/logger');

const router = Router();

/**
 * POST /api/import/wigle
 * Imports WiGLE files from the local imports directory.
 */
router.post('/import/wigle', async (req: Request, res: Response) => {
  try {
    const importDir = path.join(process.cwd(), 'imports', 'wigle');
    const result = await importWigleDirectory(importDir);
    res.json({ success: true, ...result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`WiGLE import error: ${msg}`, { error });
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
