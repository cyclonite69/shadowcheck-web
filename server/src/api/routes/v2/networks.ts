import type { Request, Response } from 'express';
import { ROUTE_CONFIG } from '../../../config/routeConfig';

const express = require('express');
const router = express.Router();
const { v2Service, adminNetworkMediaService } = require('../../../config/container');
const { asyncHandler } = require('../../../utils/asyncHandler');
const { validators } = require('../../../utils/validators');
const { parseByteRange } = require('../../../utils/httpRangeUtils');

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

router.post(
  '/v2/networks/batch',
  asyncHandler(async (req: Request, res: Response) => {
    let bssids: string[] = [];
    if (req.body && Array.isArray(req.body.bssids)) {
      bssids = req.body.bssids
        .map((b: any) =>
          String(b || '')
            .trim()
            .toUpperCase()
        )
        .filter((b: string) => /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(b));
    }
    // Deduplicate
    bssids = Array.from(new Set(bssids));
    // Cap at 500
    if (bssids.length > 500) {
      bssids = bssids.slice(0, 500);
    }

    const locationMode = String(req.query.locationMode || 'latest_observation');
    const result = await v2Service.getNetworksByBssids(bssids, locationMode);

    // Identify which requested BSSIDs are missing from explorer rows
    const foundBssids = new Set(result.map((r: any) => r.bssid.toUpperCase()));
    const missingBssids = bssids.filter((b) => !foundBssids.has(b));

    // Query database to check if missing BSSIDs exist in app.networks
    const existingDbBssids = await v2Service.checkNetworksExist(missingBssids);
    const existingDbSet = new Set(existingDbBssids);

    // Classify each missing BSSID
    const unresolved: Record<string, 'non_renderable' | 'missing'> = {};
    for (const b of missingBssids) {
      if (existingDbSet.has(b)) {
        unresolved[b] = 'non_renderable';
      } else {
        unresolved[b] = 'missing';
      }
    }

    res.json({ data: result, unresolved });
  })
);

/**
 * Return related media for a BSSID — direct records plus component-surfaced
 * records from sibling groups. No binary payloads; includes thumbnail/inline URLs.
 * GET /api/v2/networks/:bssid/media
 *
 * @param {string} req.params.bssid Target BSSID
 */
router.get(
  '/v2/networks/:bssid/media',
  asyncHandler(async (req: Request, res: Response) => {
    const bssid = String(req.params.bssid || '').toUpperCase();
    const media = await adminNetworkMediaService.getRelatedNetworkMediaForBssid(bssid);

    const items = media.map((m: any) => ({
      id: m.id,
      requested_bssid: m.requested_bssid,
      source_bssid: m.source_bssid,
      observation_id: m.observation_id ?? null,
      media_type: m.media_type,
      filename: m.filename,
      mime_type: m.mime_type,
      file_size: m.file_size,
      created_at: m.created_at,
      exif_captured_at: m.exif_captured_at ?? null,
      is_direct: m.is_direct,
      source_kind: m.source_kind,
      thumbnail_url: `/api/v2/networks/media/${m.id}/thumbnail`,
      inline_url: `/api/v2/networks/media/${m.id}/inline`,
    }));

    res.json({ bssid, media: items, count: items.length });
  })
);

/**
 * Serve network media thumbnail inline under user permissions
 * GET /api/v2/networks/media/:id/thumbnail
 *
 * @param {string} req.params.id Media record ID
 */
router.get(
  '/v2/networks/media/:id/thumbnail',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const media = await adminNetworkMediaService.getNetworkMediaThumbnail(id);

    if (!media) {
      return res.status(404).json({
        error: { message: 'Media not found' },
      });
    }

    if (!media.thumbnail) {
      return res.status(404).json({
        error: { message: 'Thumbnail not found' },
      });
    }

    res.set({
      'Content-Type': media.mime_type || 'image/jpeg',
      'Content-Disposition': 'inline',
    });

    res.send(media.thumbnail);
  })
);

/**
 * Serve full network media inline under user permissions
 * GET /api/v2/networks/media/:id/inline
 *
 * @param {string} req.params.id Media record ID
 */
router.get(
  '/v2/networks/media/:id/inline',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const media = await adminNetworkMediaService.getNetworkMediaFile(id);

    if (!media) {
      return res.status(404).json({
        error: { message: 'Media not found' },
      });
    }

    if (!media.media_data) {
      return res.status(404).json({
        error: { message: 'Media data not found' },
      });
    }

    const buffer: Buffer = media.media_data;
    const isVideo =
      media.media_type === 'video' ||
      (typeof media.mime_type === 'string' && media.mime_type.startsWith('video/'));
    const mimeType = media.mime_type || (isVideo ? 'video/mp4' : 'application/octet-stream');
    const totalSize = buffer.length;

    res.set({
      'Content-Disposition': 'inline',
    });

    if (isVideo) {
      res.set('Accept-Ranges', 'bytes');

      const rangeHeader = req.headers.range;
      const parsed = parseByteRange(rangeHeader, totalSize);

      if (parsed.status === 'unsatisfiable') {
        res.set('Content-Range', `bytes */${totalSize}`);
        return res.status(416).end();
      }

      if (parsed.status === 'range' && parsed.start !== undefined && parsed.end !== undefined) {
        const { start, end } = parsed;
        const chunkSize = end - start + 1;

        res.status(206);
        res.set({
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Content-Length': String(chunkSize),
          'Content-Type': mimeType,
        });

        return res.send(buffer.subarray(start, end + 1));
      }
    }

    res.set({
      'Content-Type': mimeType,
      'Content-Length': String(totalSize),
    });

    res.send(buffer);
  })
);

module.exports = router;
