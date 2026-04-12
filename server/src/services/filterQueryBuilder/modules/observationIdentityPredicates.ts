import { SqlFragmentLibrary } from '../SqlFragmentLibrary';
import { isOui, coerceOui, splitTextFilterTokens, normalizeWildcards } from '../normalizers';
import type { FilterBuildContext } from '../FilterBuildContext';

export function buildObservationIdentityPredicates(ctx: FilterBuildContext): string[] {
  const where: string[] = [];
  const f = ctx.filters;
  const e = ctx.enabled;

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
      // If token has wildcards, use them, otherwise use %token%
      const pattern =
        wildcardToken.includes('%') || wildcardToken.includes('_')
          ? wildcardToken
          : `%${wildcardToken}%`;
      return `o.ssid ${operator} ${ctx.addParam(pattern)}`;
    });
    // For SSIDs, we usually want AND if there are negations, but OR for positive matches?
    // Conventional search: "A B -C" means (A OR B) AND NOT C.
    // Our splitTextFilterTokens currently splits by comma, so "A,B" is (A OR B).
    // Let's stick to the current OR behavior but allow NOT.
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
        return `UPPER(o.bssid) ${eqOperator} ${ctx.addParam(value)}`;
      }

      const pattern = isWildcard ? wildcardValue : `${wildcardValue}%`;
      return `UPPER(o.bssid) ${operator} ${ctx.addParam(pattern)}`;
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
      if (isOui(cleaned)) {
        return `UPPER(REPLACE(SUBSTRING(o.bssid, 1, 8), ':', '')) = ${ctx.addParam(cleaned)}`;
      }
      ctx.obsJoins.add(SqlFragmentLibrary.joinRadioManufacturers('o', 'rm'));
      return `rm.manufacturer ILIKE ${ctx.addParam(`%${token}%`)}`;
    });
    where.push(predicates.length === 1 ? predicates[0] : `(${predicates.join(' OR ')})`);
    ctx.addApplied('identity', 'manufacturer', f.manufacturer);
  }

  return where;
}
