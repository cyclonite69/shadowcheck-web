import { FIELD_EXPRESSIONS, NULL_SAFE_COMPARISONS } from '../SchemaCompat';
import type { FilterBuildContext } from '../FilterBuildContext';
import { applyEngagementFilters, applyRadioFilters } from './networkPredicateAdapters';
import { buildFastPathIdentityPredicates } from './networkFastPathIdentityPredicates';
import type { FastPathPredicateOptions } from './networkFastPathPredicateTypes';
import { buildFastPathSecurityPredicates } from './networkFastPathSecurityPredicates';
import { buildFastPathSupplementalPredicates } from './networkFastPathSupplementalPredicates';

export const NT_TAG_LOWER_EXPR = FIELD_EXPRESSIONS.threatTagLowercase('nt');
export const NT_IS_IGNORED_EXPR = NULL_SAFE_COMPARISONS.isIgnored('nt');
export const NT_NOT_IGNORED_CLAUSE = 'COALESCE(nt.is_ignored, FALSE) = FALSE';
export const NE_NOT_IGNORED_EXISTS_CLAUSE = `NOT EXISTS (
  SELECT 1
  FROM app.network_tags nt_ignored
  WHERE UPPER(nt_ignored.bssid) = UPPER(ne.bssid)
    AND COALESCE((to_jsonb(nt_ignored)->>'is_ignored')::boolean, FALSE) = TRUE
)`;

export function buildListChannelExpr(frequencyExpr: string): string {
  return `
      CASE
        WHEN ${frequencyExpr} BETWEEN 2412 AND 2484 THEN
          CASE
            WHEN ${frequencyExpr} = 2484 THEN 14
            ELSE FLOOR((${frequencyExpr} - 2412) / 5) + 1
          END
        WHEN ${frequencyExpr} BETWEEN 5000 AND 5900 THEN
          FLOOR((${frequencyExpr} - 5000) / 5)
        WHEN ${frequencyExpr} BETWEEN 5925 AND 7125 THEN
          FLOOR((${frequencyExpr} - 5925) / 5)
        ELSE NULL
      END
    `;
}

export function buildFastPathPredicates(
  ctx: FilterBuildContext,
  options: FastPathPredicateOptions
): string[] {
  const where: string[] = [];

  if (!ctx.shouldIncludeIgnoredByExplicitTagFilter()) {
    where.push(options.ignoredClause);
  }

  where.push(...buildFastPathIdentityPredicates(ctx));

  where.push(
    ...applyRadioFilters(ctx, {
      typeExpr: 'ne.type',
      frequencyExpr: 'ne.frequency',
      channelExpr: options.channelExpr,
      signalExpr: 'ne.signal',
      channelWrapComparisons: options.channelWrapComparisons,
    })
  );

  where.push(
    ...buildFastPathSecurityPredicates(ctx, {
      allowUnknownEncryptionFallback: options.allowUnknownEncryptionFallback,
    })
  );

  where.push(
    ...applyEngagementFilters(ctx, {
      bssidExpr: 'ne.bssid',
      tagAlias: 'nt',
      tagLowerExpr: options.tagLowerExpr,
      tagIgnoredExpr: options.tagIgnoredExpr,
    })
  );

  where.push(
    ...buildFastPathSupplementalPredicates(ctx, {
      addUnsupportedWigleIgnored: options.addUnsupportedWigleIgnored,
    })
  );

  return where;
}
