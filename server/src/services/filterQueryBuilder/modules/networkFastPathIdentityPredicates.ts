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
      const operator = isNegated ? 'NOT ILIKE' : 'ILIKE';
      const pattern =
        wildcardToken.includes('%') || wildcardToken.includes('_')
          ? wildcardToken
          : `%${wildcardToken}%`;
      return `ne.ssid ${operator} ${ctx.addParam(pattern)}`;
    });
    where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
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
