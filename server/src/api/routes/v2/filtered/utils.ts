import type { Request } from 'express';
import type { Filters, EnabledFlags } from '../filteredHelpers';

export const resolvePageType = (req: Request): 'geospatial' | 'wigle' => {
  return req.query.pageType === 'wigle' ? 'wigle' : 'geospatial';
};

export const resolveBodyPageType = (body: unknown): 'geospatial' | 'wigle' => {
  const pageType =
    body && typeof body === 'object' ? (body as { pageType?: unknown }).pageType : '';
  return pageType === 'wigle' ? 'wigle' : 'geospatial';
};

export const isIgnoredRow = (row: { is_ignored?: unknown }): boolean => {
  const raw = row?.is_ignored;
  if (typeof raw === 'boolean') return raw;
  return String(raw).toLowerCase() === 'true';
};

export const applyEffectiveThreat = <T extends { is_ignored?: unknown; threat?: unknown }>(
  row: T
): T => {
  if (!isIgnoredRow(row)) {
    return row;
  }

  return {
    ...row,
    threat: {
      score: '0',
      level: 'NONE',
      flags: ['IGNORED'],
      signals: [],
    },
  };
};

export const parseAndValidateBodyFilters = (
  body: unknown,
  validateFilterPayload: (filters: Filters, enabled: EnabledFlags) => { errors: string[] }
) => {
  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const filters = (payload.filters as Filters | undefined) ?? {};
  const enabled = (payload.enabled as EnabledFlags | undefined) ?? {};
  const { errors } = validateFilterPayload(filters, enabled);

  if (errors.length > 0) {
    return {
      ok: false as const,
      status: 400,
      body: { ok: false as const, errors },
    };
  }

  return { ok: true as const, filters, enabled };
};
