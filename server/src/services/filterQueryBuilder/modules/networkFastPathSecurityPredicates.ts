import { SECURITY_FROM_CAPS_EXPR } from '../sqlExpressions';
import type { FilterBuildContext } from '../FilterBuildContext';

function buildEncryptionClauses(
  ctx: FilterBuildContext,
  encryptionTypes: unknown[],
  networkSecurityExpr: string,
  allowUnknownEncryptionFallback = false
): string[] {
  const securityClauses: string[] = [];

  encryptionTypes.forEach((type) => {
    const normalizedType = String(type).trim().toUpperCase();
    const finalType = normalizedType.includes('WEP') ? 'WEP' : normalizedType;

    switch (finalType) {
      case 'OPEN':
        securityClauses.push(`${networkSecurityExpr} = 'OPEN'`);
        break;
      case 'WEP':
        securityClauses.push(`${networkSecurityExpr} = 'WEP'`);
        break;
      case 'WPA':
        securityClauses.push(`${networkSecurityExpr} = 'WPA'`);
        break;
      case 'WPA2-P':
        securityClauses.push(`${networkSecurityExpr} = 'WPA2-P'`);
        break;
      case 'WPA2-E':
        securityClauses.push(`${networkSecurityExpr} = 'WPA2-E'`);
        break;
      case 'WPA2':
        securityClauses.push(`${networkSecurityExpr} IN ('WPA2', 'WPA2-P', 'WPA2-E')`);
        break;
      case 'WPA3-P':
        securityClauses.push(`${networkSecurityExpr} = 'WPA3-P'`);
        break;
      case 'WPA3-E':
        securityClauses.push(`${networkSecurityExpr} = 'WPA3-E'`);
        break;
      case 'WPA3':
        securityClauses.push(`${networkSecurityExpr} IN ('WPA3', 'WPA3-P', 'WPA3-E', 'OWE')`);
        break;
      case 'OWE':
        securityClauses.push(`${networkSecurityExpr} = 'OWE'`);
        break;
      case 'WPS':
        securityClauses.push(`${networkSecurityExpr} = 'WPS'`);
        break;
      case 'UNKNOWN':
        securityClauses.push(`${networkSecurityExpr} = 'UNKNOWN'`);
        break;
      case 'MIXED':
        securityClauses.push(
          `${networkSecurityExpr} IN ('WPA', 'WPA2', 'WPA2-P', 'WPA2-E', 'WPA3', 'WPA3-P', 'WPA3-E', 'OWE')`
        );
        break;
      default:
        if (allowUnknownEncryptionFallback) {
          securityClauses.push(`${networkSecurityExpr} = ${ctx.addParam(finalType)}`);
        }
        break;
    }
  });

  return securityClauses;
}

function buildSecurityFlagClauses(securityFlags: string[], networkSecurityExpr: string): string[] {
  const flagClauses: string[] = [];

  if (securityFlags.includes('insecure')) {
    flagClauses.push(`${networkSecurityExpr} IN ('OPEN', 'WEP', 'WPS')`);
  }
  if (securityFlags.includes('deprecated')) {
    flagClauses.push(`${networkSecurityExpr} = 'WEP'`);
  }
  if (securityFlags.includes('enterprise')) {
    flagClauses.push(`${networkSecurityExpr} IN ('WPA2-E', 'WPA3-E')`);
  }
  if (securityFlags.includes('personal')) {
    flagClauses.push(`${networkSecurityExpr} IN ('WPA', 'WPA2', 'WPA2-P', 'WPA3', 'WPA3-P')`);
  }
  if (securityFlags.includes('unknown')) {
    flagClauses.push(`${networkSecurityExpr} = 'UNKNOWN'`);
  }

  return flagClauses;
}

export function buildFastPathSecurityPredicates(
  ctx: FilterBuildContext,
  options: { allowUnknownEncryptionFallback?: boolean }
): string[] {
  const f = ctx.filters;
  const e = ctx.enabled;
  const where: string[] = [];
  const networkSecurityExpr = SECURITY_FROM_CAPS_EXPR('COALESCE(ne.capabilities, ne.security)');

  if (e.encryptionTypes && Array.isArray(f.encryptionTypes) && f.encryptionTypes.length > 0) {
    const securityClauses = buildEncryptionClauses(
      ctx,
      f.encryptionTypes,
      networkSecurityExpr,
      options.allowUnknownEncryptionFallback
    );
    if (securityClauses.length > 0) {
      where.push(`(${securityClauses.join(' OR ')})`);
      ctx.addApplied('security', 'encryptionTypes', f.encryptionTypes);
    }
  }

  if (e.securityFlags && Array.isArray(f.securityFlags) && f.securityFlags.length > 0) {
    const flagClauses = buildSecurityFlagClauses(f.securityFlags, networkSecurityExpr);
    if (flagClauses.length > 0) {
      where.push(`(${flagClauses.join(' OR ')})`);
      ctx.addApplied('security', 'securityFlags', f.securityFlags);
    }
  }

  return where;
}
