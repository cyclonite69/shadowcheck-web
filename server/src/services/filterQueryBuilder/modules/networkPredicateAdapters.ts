import { buildEngagementPredicates } from '../engagementPredicates';
import type { FilterBuildContext } from '../FilterBuildContext';
import { buildRadioPredicates } from '../radioPredicates';

export function applyRadioFilters(
  ctx: FilterBuildContext,
  options: {
    typeExpr: string;
    frequencyExpr: string;
    channelExpr: string;
    signalExpr: string;
    channelWrapComparisons?: boolean;
    rssiRequireNotNullExpr?: string;
    rssiIncludeNoiseFloor?: boolean;
  }
): string[] {
  const result = buildRadioPredicates({
    enabled: ctx.enabled,
    filters: ctx.filters,
    addParam: ctx.addParam.bind(ctx),
    expressions: {
      typeExpr: options.typeExpr,
      frequencyExpr: options.frequencyExpr,
      channelExpr: options.channelExpr,
      signalExpr: options.signalExpr,
    },
    options: {
      channelWrapComparisons: options.channelWrapComparisons,
      rssiRequireNotNullExpr: options.rssiRequireNotNullExpr,
      rssiIncludeNoiseFloor: options.rssiIncludeNoiseFloor,
    },
  });

  result.applied.forEach((entry) => ctx.addApplied('radio', entry.field, entry.value));
  return result.where;
}

export function applyEngagementFilters(
  ctx: FilterBuildContext,
  options: {
    bssidExpr: string;
    tagAlias: string;
    tagLowerExpr: string;
    tagIgnoredExpr: string;
  }
): string[] {
  const result = buildEngagementPredicates({
    enabled: ctx.enabled,
    filters: ctx.filters,
    addParam: ctx.addParam.bind(ctx),
    bssidExpr: options.bssidExpr,
    tagAlias: options.tagAlias,
    tagLowerExpr: options.tagLowerExpr,
    tagIgnoredExpr: options.tagIgnoredExpr,
  });

  result.applied.forEach((entry) => ctx.addApplied('engagement', entry.field, entry.value));
  return result.where;
}
