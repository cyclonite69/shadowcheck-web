import type { Request, Response } from 'express';
import type { HandlerDeps } from '../types';

const { getMatchedMediaPoints } = require('../../../../../services/adminNetworkMediaService');

/**
 * Returns matched media locations as a GeoJSON FeatureCollection grouped by sibling component.
 * GET /api/v2/networks/filtered/matched-media
 */
export const createMatchedMediaHandler =
  (_deps: HandlerDeps) => async (_req: Request, res: Response) => {
    const mediaPoints = await getMatchedMediaPoints();

    const features = mediaPoints.map((point: any) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(point.lon), parseFloat(point.lat)],
      },
      properties: {
        component_id: point.component_id,
        media_count: point.media_count,
        media_ids: point.media_ids || [],
        member_bssids: point.member_bssids || [],
        location_provenance: point.location_provenance || 'component_location',
        location_confidence: null,
        marker_location_source: point.marker_location_source || null,
        observation_id:
          point.observation_id !== null && point.observation_id !== undefined
            ? Number(point.observation_id)
            : null,
        capture_lat:
          point.capture_lat !== null && point.capture_lat !== undefined
            ? parseFloat(point.capture_lat)
            : null,
        capture_lon:
          point.capture_lon !== null && point.capture_lon !== undefined
            ? parseFloat(point.capture_lon)
            : null,
        observation_lat:
          point.observation_lat !== null && point.observation_lat !== undefined
            ? parseFloat(point.observation_lat)
            : null,
        observation_lon:
          point.observation_lon !== null && point.observation_lon !== undefined
            ? parseFloat(point.observation_lon)
            : null,
        network_lat:
          point.network_lat !== null && point.network_lat !== undefined
            ? parseFloat(point.network_lat)
            : null,
        network_lon:
          point.network_lon !== null && point.network_lon !== undefined
            ? parseFloat(point.network_lon)
            : null,
      },
    }));

    res.json({
      ok: true,
      type: 'FeatureCollection',
      features,
    });
  };
