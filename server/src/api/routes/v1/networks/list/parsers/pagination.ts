import { parseRequiredInteger } from '../../../../../../validation/parameterParsers';
import { ROUTE_CONFIG } from '../../../../../../config/routeConfig';

export type PaginationParams = {
  limit: number;
  offset: number;
};

export const parsePagination = (
  limitRaw: unknown,
  offsetRaw: unknown
): { ok: true; params: PaginationParams } | { ok: false; status: 400; error: string } => {
  const limitResult = parseRequiredInteger(
    limitRaw,
    1,
    ROUTE_CONFIG.networks.maxLimit,
    'limit',
    'Missing limit parameter.',
    `Invalid limit parameter. Must be between 1 and ${ROUTE_CONFIG.networks.maxLimit}.`
  );
  if (!limitResult.ok) return { ok: false, status: 400, error: limitResult.error };

  const offsetResult = parseRequiredInteger(
    offsetRaw,
    0,
    ROUTE_CONFIG.networks.maxOffset,
    'offset',
    'Missing offset parameter.',
    'Invalid offset parameter. Must be >= 0.'
  );
  if (!offsetResult.ok) return { ok: false, status: 400, error: offsetResult.error };

  return { ok: true, params: { limit: limitResult.value, offset: offsetResult.value } };
};
