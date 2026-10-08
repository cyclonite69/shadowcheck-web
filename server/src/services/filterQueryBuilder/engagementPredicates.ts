import type { EnabledFlags, Filters } from './types';

export type EngagementAppliedFilterField = 'has_notes' | 'tag_type';

type EngagementPredicateInput = {
  enabled: EnabledFlags;
  filters: Filters;
  addParam: (value: unknown) => string;
  bssidExpr: string;
  tagAlias: string;
  tagLowerExpr: string;
  tagIgnoredExpr: string;
};

type EngagementPredicateResult = {
  where: string[];
  applied: Array<{ field: EngagementAppliedFilterField; value: unknown }>;
};

export const buildEngagementPredicates = ({
  enabled,
  filters,
  addParam,
  bssidExpr,
  tagAlias,
  tagLowerExpr,
  tagIgnoredExpr,
}: EngagementPredicateInput): EngagementPredicateResult => {
  const where: string[] = [];
  const applied: Array<{ field: EngagementAppliedFilterField; value: unknown }> = [];

  if (enabled.has_notes && filters.has_notes !== undefined) {
    const existsClause = `EXISTS (SELECT 1 FROM app.network_notes nn WHERE nn.bssid = ${bssidExpr})`;
    where.push(filters.has_notes ? existsClause : `NOT ${existsClause}`);
    applied.push({ field: 'has_notes', value: filters.has_notes });
  }

  if (enabled.tag_type && Array.isArray(filters.tag_type) && filters.tag_type.length > 0) {
    const wantsIgnore = filters.tag_type.includes('ignore');
    const tagValues = filters.tag_type.filter((tag) => tag !== 'ignore');
    let tagClause = '';
    const tagArrayClause = (paramRef: string) =>
      `EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(${tagAlias}.tags, '[]'::jsonb)) AS tag_item(tag)
        WHERE LOWER(tag_item.tag) = ANY(${paramRef})
      )`;
    if (tagValues.length > 0 && wantsIgnore) {
      const tagParam = addParam(tagValues);
      tagClause = `((${tagLowerExpr} = ANY(${tagParam}) OR ${tagArrayClause(tagParam)}) OR ${tagIgnoredExpr} IS TRUE)`;
    } else if (tagValues.length > 0) {
      const tagParam = addParam(tagValues);
      tagClause = `(${tagLowerExpr} = ANY(${tagParam}) OR ${tagArrayClause(tagParam)})`;
    } else if (wantsIgnore) {
      tagClause = `${tagIgnoredExpr} IS TRUE`;
    }

    if (tagClause) {
      where.push(
        `EXISTS (SELECT 1 FROM app.network_tags ${tagAlias} WHERE UPPER(${tagAlias}.bssid) = UPPER(${bssidExpr}) AND ${tagClause})`
      );
      applied.push({ field: 'tag_type', value: filters.tag_type });
    }
  }

  return { where, applied };
};
