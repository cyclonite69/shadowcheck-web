import { validateEnum, validateNumberRange } from '../../../../../../validation/schemas';

const { safeJsonParse } = require('../../../../../../utils/safeJsonParse');

export type ThreatFilterParams = {
  threatLevel: string | null;
  threatCategories: string[] | null;
  threatScoreMin: number | null;
  threatScoreMax: number | null;
};

export const parseThreatFilters = (
  threatLevelRaw: unknown,
  threatCategoriesRaw: unknown,
  threatScoreMinRaw: unknown,
  threatScoreMaxRaw: unknown
): { ok: true; params: ThreatFilterParams } | { ok: false; status: 400; error: string } => {
  let threatLevel: string | null = null;
  let threatCategories: string[] | null = null;
  let threatScoreMin: number | null = null;
  let threatScoreMax: number | null = null;

  if (threatLevelRaw !== undefined) {
    const validation = validateEnum(
      threatLevelRaw,
      ['NONE', 'LOW', 'MED', 'HIGH', 'CRITICAL'],
      'threat_level'
    );
    if (!validation.valid) {
      return {
        ok: false,
        status: 400,
        error: 'Invalid threat_level parameter. Must be NONE, LOW, MED, HIGH, or CRITICAL.',
      };
    }
    threatLevel = validation.value ?? null;
  }

  if (threatCategoriesRaw !== undefined) {
    try {
      const categories = Array.isArray(threatCategoriesRaw)
        ? threatCategoriesRaw
        : safeJsonParse(threatCategoriesRaw);
      if (Array.isArray(categories) && categories.length > 0) {
        const threatLevelMap: Record<string, string> = {
          critical: 'CRITICAL',
          high: 'HIGH',
          medium: 'MED',
          low: 'LOW',
          none: 'NONE',
        };
        threatCategories = categories
          .map((cat: string) => threatLevelMap[cat] || cat.toUpperCase())
          .filter(Boolean);
      }
    } catch {
      return {
        ok: false,
        status: 400,
        error: 'Invalid threat_categories parameter. Must be JSON array.',
      };
    }
  }

  if (threatScoreMinRaw !== undefined) {
    const validation = validateNumberRange(threatScoreMinRaw, 0, 100, 'threat_score_min');
    if (!validation.valid) {
      return {
        ok: false,
        status: 400,
        error: 'Invalid threat_score_min parameter. Must be 0-100.',
      };
    }
    threatScoreMin = validation.value ?? null;
  }

  if (threatScoreMaxRaw !== undefined) {
    const validation = validateNumberRange(threatScoreMaxRaw, 0, 100, 'threat_score_max');
    if (!validation.valid) {
      return {
        ok: false,
        status: 400,
        error: 'Invalid threat_score_max parameter. Must be 0-100.',
      };
    }
    threatScoreMax = validation.value ?? null;
  }

  return { ok: true, params: { threatLevel, threatCategories, threatScoreMin, threatScoreMax } };
};
