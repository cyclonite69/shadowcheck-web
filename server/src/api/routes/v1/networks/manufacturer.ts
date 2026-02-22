/**
 * Manufacturer Routes
 * Device manufacturer lookup by BSSID
 */

import express from 'express';
const router = express.Router();
const { networkService } = require('../../../../config/container');
import { validateBSSID } from '../../../../validation/schemas';

/**
 * GET /manufacturer/:bssid - Lookup manufacturer by BSSID
 */
router.get('/manufacturer/:bssid', async (req, res, next) => {
  try {
    const { bssid } = req.params;

    const bssidValidation = validateBSSID(bssid);
    if (!bssidValidation.valid) {
      return res.status(400).json({ error: bssidValidation.error });
    }

    const prefix = bssidValidation.cleaned.replace(/:/g, '').substring(0, 6).toUpperCase();

    const manufacturer = await networkService.getManufacturerByBSSID(prefix);

    if (!manufacturer) {
      return res.json({
        ok: true,
        bssid: bssidValidation.cleaned,
        manufacturer: 'Unknown',
        prefix: prefix,
      });
    }

    res.json({
      ok: true,
      bssid: bssidValidation.cleaned,
      manufacturer: manufacturer.manufacturer,
      address: manufacturer.address,
      prefix: manufacturer.prefix,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
