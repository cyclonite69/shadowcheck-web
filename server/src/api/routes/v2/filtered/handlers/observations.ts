import type { Request, Response } from 'express';
import type { Filters, EnabledFlags } from '../../filteredHelpers';
import {
  parseJsonParam,
  parseAndValidateFilters,
  isParseValidatedFiltersError,
  assertHomeExistsIfNeeded,
} from '../../filteredHelpers';
import type { HandlerDeps } from '../types';
import { resolvePageType, resolveBodyPageType, parseAndValidateBodyFilters } from '../utils';
import { buildFilteredObservationsResponse } from '../observationsBuilder';
import { ROUTE_CONFIG } from '../../../../../config/routeConfig';

export const createGetObservationsHandler =
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
      parseInt(req.query.limit as string, 10) || ROUTE_CONFIG.observationsDefaultLimit,
      ROUTE_CONFIG.observationsMaxLimit
    );
    const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
    const includeTotalAndTruncation = parseInt(req.query.includeTotal as string, 10) === 1;
    const selectedBssids = parseJsonParam<string[]>(
      req.query.bssids as string | undefined,
      [],
      'bssids'
    );

    res.json(
      await buildFilteredObservationsResponse(
        UniversalFilterQueryBuilder,
        v2Service,
        logger,
        filters,
        enabled,
        limit,
        offset,
        selectedBssids,
        resolvePageType(req),
        includeTotalAndTruncation
      )
    );
  };

export const createPostObservationsHandler =
  (deps: HandlerDeps) => async (req: Request, res: Response) => {
    const { filterQueryBuilder, v2Service, logger } = deps;
    const { UniversalFilterQueryBuilder, validateFilterPayload } = filterQueryBuilder;

    const parsed = parseAndValidateBodyFilters(req.body, validateFilterPayload);
    if (isParseValidatedFiltersError(parsed)) {
      return res.status(parsed.status).json(parsed.body);
    }
    const { filters, enabled } = parsed;

    if (!(await assertHomeExistsIfNeeded(enabled as EnabledFlags, res))) {
      return;
    }

    const payload =
      req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const rawLimit =
      typeof payload.limit === 'number' ? payload.limit : parseInt(String(payload.limit ?? ''), 10);
    const limit = Math.min(
      Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : ROUTE_CONFIG.observationsDefaultLimit,
      ROUTE_CONFIG.observationsMaxLimit
    );
    const offset = Math.max(0, typeof payload.offset === 'number' ? payload.offset : 0);
    const includeTotalAndTruncation = payload.include_total === 1;
    const selectedBssids = Array.isArray(payload.bssids)
      ? payload.bssids.filter((v): v is string => typeof v === 'string')
      : [];

    res.json(
      await buildFilteredObservationsResponse(
        UniversalFilterQueryBuilder,
        v2Service,
        logger,
        filters as Filters,
        enabled as EnabledFlags,
        limit,
        offset,
        selectedBssids,
        resolveBodyPageType(req.body),
        includeTotalAndTruncation
      )
    );
  };
