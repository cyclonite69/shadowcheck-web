import { SECURITY_EXPR } from '../sqlExpressions';
import { RELATIVE_WINDOWS } from '../constants';
import type { FilterBuildContext } from '../FilterBuildContext';

export function buildObservationSecurityTemporalPredicates(ctx: FilterBuildContext): string[] {
  const where: string[] = [];
  const f = ctx.filters;
  const e = ctx.enabled;
  const obsSecurityExpr = SECURITY_EXPR('o');

  if (e.encryptionTypes && Array.isArray(f.encryptionTypes) && f.encryptionTypes.length > 0) {
    const securityClauses: string[] = [];
    f.encryptionTypes.forEach((type) => {
      const normalizedType = String(type).trim().toUpperCase();
      const finalType = normalizedType.includes('WEP') ? 'WEP' : normalizedType;
      switch (finalType) {
        case 'OPEN':
          securityClauses.push(`${obsSecurityExpr} = 'OPEN'`);
          break;
        case 'WEP':
          securityClauses.push(`${obsSecurityExpr} = 'WEP'`);
          break;
        case 'WPA':
          securityClauses.push(`${obsSecurityExpr} = 'WPA'`);
          break;
        case 'WPA2-P':
          securityClauses.push(`${obsSecurityExpr} = 'WPA2-P'`);
          break;
        case 'WPA2-E':
          securityClauses.push(`${obsSecurityExpr} = 'WPA2-E'`);
          break;
        case 'WPA2':
          securityClauses.push(`${obsSecurityExpr} IN ('WPA2', 'WPA2-P', 'WPA2-E')`);
          break;
        case 'WPA3-P':
          securityClauses.push(`${obsSecurityExpr} = 'WPA3-P'`);
          break;
        case 'WPA3-E':
          securityClauses.push(`${obsSecurityExpr} = 'WPA3-E'`);
          break;
        case 'WPA3':
          securityClauses.push(`${obsSecurityExpr} IN ('WPA3', 'WPA3-P', 'WPA3-E', 'OWE')`);
          break;
        case 'OWE':
          securityClauses.push(`${obsSecurityExpr} = 'OWE'`);
          break;
        case 'WPS':
          securityClauses.push(`${obsSecurityExpr} = 'WPS'`);
          break;
        case 'UNKNOWN':
          securityClauses.push(`${obsSecurityExpr} = 'UNKNOWN'`);
          break;
        case 'MIXED':
          securityClauses.push(
            `${obsSecurityExpr} IN ('WPA', 'WPA2', 'WPA2-P', 'WPA2-E', 'WPA3', 'WPA3-P', 'WPA3-E', 'OWE')`
          );
          break;
      }
    });
    if (securityClauses.length > 0) {
      where.push(`(${securityClauses.join(' OR ')})`);
      ctx.addApplied('security', 'encryptionTypes', f.encryptionTypes);
    }
  }

  if (e.securityFlags && Array.isArray(f.securityFlags) && f.securityFlags.length > 0) {
    const flagClauses: string[] = [];
    if (f.securityFlags.includes('insecure')) {
      flagClauses.push(`${obsSecurityExpr} IN ('OPEN', 'WEP', 'WPS')`);
    }
    if (f.securityFlags.includes('deprecated')) {
      flagClauses.push(`${obsSecurityExpr} = 'WEP'`);
    }
    if (f.securityFlags.includes('enterprise')) {
      flagClauses.push(`${obsSecurityExpr} IN ('WPA2-E', 'WPA3-E')`);
    }
    if (f.securityFlags.includes('personal')) {
      flagClauses.push(`${obsSecurityExpr} IN ('WPA', 'WPA2', 'WPA2-P', 'WPA3', 'WPA3-P')`);
    }
    if (f.securityFlags.includes('unknown')) {
      flagClauses.push(`${obsSecurityExpr} = 'UNKNOWN'`);
    }
    if (flagClauses.length > 0) {
      where.push(`(${flagClauses.join(' OR ')})`);
      ctx.addApplied('security', 'securityFlags', f.securityFlags);
    }
  }

  if (e.timeframe && f.timeframe) {
    const scope = f.temporalScope || 'observation_time';
    if (scope === 'threat_window') {
      ctx.addWarning('Threat window scope mapped to observation_time on slow path.');
    }
    if (f.timeframe.type === 'absolute') {
      if (f.timeframe.startTimestamp) {
        where.push(`o.time >= ${ctx.addParam(f.timeframe.startTimestamp)}::timestamptz`);
      }
      if (f.timeframe.endTimestamp) {
        where.push(`o.time <= ${ctx.addParam(f.timeframe.endTimestamp)}::timestamptz`);
      }
    } else {
      const window = RELATIVE_WINDOWS[f.timeframe.relativeWindow || '30d'];
      if (window) {
        where.push(`o.time >= NOW() - ${ctx.addParam(window)}::interval`);
      }
    }
    ctx.addApplied('temporal', 'timeframe', f.timeframe);
    ctx.addApplied('temporal', 'temporalScope', scope);
  }

  return where;
}
