import { NETWORK_CHANNEL_EXPR } from '../sqlExpressions';
import type { FilterBuildContext } from '../FilterBuildContext';
import type { QueryResult } from '../types';
import { buildFastPathPredicates, NE_NOT_IGNORED_EXISTS_CLAUSE } from './networkFastPathPredicates';

function buildFastPathCountSql(whereClause: string): string {
  return `SELECT COUNT(*) AS total FROM app.api_network_explorer_mv ne
            ${whereClause}`;
}

export function buildNetworkOnlyCountQuery(ctx: FilterBuildContext): QueryResult {
  const where = buildFastPathPredicates(ctx, {
    ignoredClause: NE_NOT_IGNORED_EXISTS_CLAUSE,
    channelExpr: NETWORK_CHANNEL_EXPR('ne'),
    tagLowerExpr: "LOWER(COALESCE((to_jsonb(nt)->>'threat_tag'), ''))",
    tagIgnoredExpr: "COALESCE((to_jsonb(nt)->>'is_ignored')::boolean, FALSE)",
    allowUnknownEncryptionFallback: true,
  });

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return {
    sql: buildFastPathCountSql(whereClause),
    params: ctx.getParams() as any[],
  };
}
