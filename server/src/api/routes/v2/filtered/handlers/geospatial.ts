import type { Request, Response } from 'express';
import type { FilterQueryResult, GeospatialRow } from '../../filteredHelpers';
import {
  DEBUG_GEOSPATIAL,
  parseJsonParam,
  parseAndValidateFilters,
  isParseValidatedFiltersError,
  normalizeThreatTransparency,
  assertHomeExistsIfNeeded,
} from '../../filteredHelpers';
import type { HandlerDeps } from '../types';
import { resolvePageType, applyEffectiveThreat } from '../utils';
import { ROUTE_CONFIG } from '../../../../../config/routeConfig';

export const createGeospatialHandler =
  (deps: HandlerDeps) => async (req: Request, res: Response) => {
    const { filterQueryBuilder, v2Service, logger } = deps;
    const { UniversalFilterQueryBuilder, validateFilterPayload } = filterQueryBuilder;

    const parsed = parseAndValidateFilters(req, validateFilterPayload);
    if (isParseValidatedFiltersError(parsed)) {
      return res.status(parsed.status).json(parsed.body);
    }
    const { filters, enabled } = parsed;

    if (!(await assertHomeExistsIfNeeded(enabled, res))) {
      return;
    }

    const limit = Math.min(
      parseInt(req.query.limit as string, 10) || ROUTE_CONFIG.geospatialDefaultLimit,
      ROUTE_CONFIG.geospatialMaxLimit
    );
    const selectedBssids = parseJsonParam<string[]>(
      req.query.bssids as string | undefined,
      [],
      'bssids'
    );
    const rawLocationMode = req.query.location_mode as string | undefined;
    const locationMode = ['centroid', 'weighted_centroid'].includes(rawLocationMode ?? '')
      ? (rawLocationMode as 'centroid' | 'weighted_centroid')
      : 'latest_observation';

    const builder = new UniversalFilterQueryBuilder(filters, enabled, {
      pageType: resolvePageType(req),
    });
    const { sql, params, appliedFilters, ignoredFilters, warnings }: FilterQueryResult =
      builder.buildGeospatialQuery({ limit, selectedBssids, locationMode });

    const start = Date.now();
    const result = await v2Service.executeV2Query(sql, params);
    const durationMs = Date.now() - start;

    if (DEBUG_GEOSPATIAL || durationMs > ROUTE_CONFIG.slowGeospatialQueryMs) {
      logger.info('[geospatial] filtered/geospatial query', {
        durationMs,
        rows: result.rowCount || 0,
        limit,
        selectedBssids: Array.isArray(selectedBssids) ? selectedBssids.length : 0,
        enabledCount: Object.values(enabled).filter(Boolean).length,
        appliedCount: appliedFilters.length,
      });
    }

    const features = (result.rows || []).map((row: GeospatialRow) => {
      const effectiveRow = applyEffectiveThreat(row);
      const transparency = normalizeThreatTransparency(effectiveRow.threat);
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [effectiveRow.lon as number, effectiveRow.lat as number],
        },
        properties: {
          bssid: effectiveRow.bssid,
          ssid: effectiveRow.ssid,
          signal: effectiveRow.level,
          accuracy: effectiveRow.accuracy,
          altitude: effectiveRow.altitude,
          time: effectiveRow.time,
          number: effectiveRow.obs_number,
          radio_frequency: effectiveRow.radio_frequency,
          radio_capabilities: effectiveRow.radio_capabilities,
          radio_type: effectiveRow.radio_type,
          centroid_lat: effectiveRow.centroid_lat ?? null,
          centroid_lon: effectiveRow.centroid_lon ?? null,
          weighted_lat: effectiveRow.weighted_lat ?? null,
          weighted_lon: effectiveRow.weighted_lon ?? null,
          threat: effectiveRow.threat,
          threatReasons: transparency.threatReasons,
          threatEvidence: transparency.threatEvidence,
          threatTransparencyError: transparency.transparencyError,
        },
      };
    });

    res.json({
      ok: true,
      type: 'FeatureCollection',
      features,
      filterTransparency: { appliedFilters, ignoredFilters, warnings },
      meta: {
        queryTime: Date.now(),
        queryDurationMs: durationMs,
        resultCount: features.length,
      },
    });
  };
