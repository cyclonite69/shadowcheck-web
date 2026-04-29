import type { Request, Response } from 'express';
import type { Filters, EnabledFlags } from '../../filteredHelpers';
import {
  parseAndValidateFilters,
  isParseValidatedFiltersError,
  assertHomeExistsIfNeeded,
} from '../../filteredHelpers';
import type { HandlerDeps } from '../types';
import { resolvePageType } from '../utils';
import { ROUTE_CONFIG } from '../../../../../config/routeConfig';

export const createAnalyticsHandler =
  (deps: HandlerDeps) => async (req: Request, res: Response) => {
    const { filterQueryBuilder, filteredAnalyticsService } = deps;
    const { validateFilterPayload } = filterQueryBuilder;

    const parsed = parseAndValidateFilters(req, validateFilterPayload);
    if (isParseValidatedFiltersError(parsed)) {
      return res.status(parsed.status).json(parsed.body);
    }
    const { filters = {}, enabled = {} } = parsed;

    if (!(await assertHomeExistsIfNeeded(enabled as EnabledFlags, res))) {
      return;
    }

    const analyticsResult = await filteredAnalyticsService.getFilteredAnalytics(
      filters as Filters,
      enabled as EnabledFlags,
      resolvePageType(req)
    );

    res.json({
      ok: true,
      data: analyticsResult.data,
      meta: {
        queryTime: Date.now(),
        queryDurationMs: analyticsResult.queryDurationMs,
        fastPath: false,
        threatThresholds: ROUTE_CONFIG.threatThresholds,
      },
    });
  };
