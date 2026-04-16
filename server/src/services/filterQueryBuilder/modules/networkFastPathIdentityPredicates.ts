import { isOui, coerceOui, splitTextFilterTokens, normalizeWildcards } from '../normalizers';
import type { FilterBuildContext } from '../FilterBuildContext';

export function buildFastPathIdentityPredicates(ctx: FilterBuildContext): string[] {
  const f = ctx.filters;
  const e = ctx.enabled;
  const where: string[] = [];

  if (e.ssid && f.ssid) {
    const ssidTokens = splitTextFilterTokens(f.ssid);
    const predicates = (ssidTokens.length > 0 ? ssidTokens : [String(f.ssid)]).map((token) => {
      const isNegated = token.startsWith('-') || token.toUpperCase().startsWith('NOT ');
      const cleanToken = isNegated
        ? token.startsWith('-')
          ? token.substring(1).trim()
          : token.substring(4).trim()
        : token;
      const wildcardToken = normalizeWildcards(cleanToken);
      const pattern =
        wildcardToken.includes('%') || wildcardToken.includes('_')
          ? wildcardToken
          : `%${wildcardToken}%`;
      // Bind the pattern once and reuse the same $N placeholder in both the MV column
      // check and the EXISTS subquery — PostgreSQL allows multiple references to the same param.
      const p = ctx.addParam(pattern);
      if (isNegated) {
        // Exclude networks where current SSID OR any historical obs SSID matches the term.
        return `(ne.ssid NOT ILIKE ${p} AND NOT EXISTS (
          SELECT 1 FROM app.observations o2
          WHERE o2.bssid = ne.bssid AND NULLIF(o2.ssid, '') ILIKE ${p}
        ))`;
      }
      // Include networks where current SSID OR any historical obs SSID matches the term.
      return `(ne.ssid ILIKE ${p} OR EXISTS (
        SELECT 1 FROM app.observations o2
        WHERE o2.bssid = ne.bssid AND NULLIF(o2.ssid, '') ILIKE ${p}
      ))`;
    });
    where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' AND ')})`);
    ctx.addApplied('identity', 'ssid', f.ssid);
  }

  if (e.bssid && f.bssid) {
    const bssidTokens = splitTextFilterTokens(f.bssid);
    const predicates = (bssidTokens.length > 0 ? bssidTokens : [String(f.bssid)]).map((token) => {
      const isNegated = token.startsWith('-') || token.toUpperCase().startsWith('NOT ');
      const cleanToken = isNegated
        ? token.startsWith('-')
          ? token.substring(1).trim()
          : token.substring(4).trim()
        : token;
      const value = cleanToken.toUpperCase();
      const wildcardValue = normalizeWildcards(value);
      const isWildcard = wildcardValue.includes('%') || wildcardValue.includes('_');
      const operator = isNegated ? 'NOT LIKE' : 'LIKE';

      if (!isWildcard && value.length === 17) {
        const eqOperator = isNegated ? '!=' : '=';
        return `UPPER(ne.bssid) ${eqOperator} ${ctx.addParam(value)}`;
      }

      const pattern = isWildcard ? wildcardValue : `${wildcardValue}%`;
      return `UPPER(ne.bssid) ${operator} ${ctx.addParam(pattern)}`;
    });
    where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
    ctx.addApplied('identity', 'bssid', f.bssid);
  }

  if (e.manufacturer && f.manufacturer) {
    const manufacturerTokens = splitTextFilterTokens(f.manufacturer);
    const predicates = (
      manufacturerTokens.length > 0 ? manufacturerTokens : [String(f.manufacturer)]
    ).map((token) => {
      const cleaned = coerceOui(token);
      return isOui(cleaned)
        ? `UPPER(REPLACE(SUBSTRING(ne.bssid, 1, 8), ':', '')) = ${ctx.addParam(cleaned)}`
        : `ne.manufacturer ILIKE ${ctx.addParam(`%${token}%`)}`;
    });
    where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
    ctx.addApplied('identity', 'manufacturer', f.manufacturer);
  }

  return where;
}
