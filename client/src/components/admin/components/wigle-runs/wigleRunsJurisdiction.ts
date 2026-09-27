import { US_STATES } from '../../../../constants/network';
import type { WigleImportRun } from '../../../../types/admin';

export const TERRITORY_CODES = new Set(['AS', 'GU', 'MP', 'PR', 'VI']);
export const JURISDICTION_LABELS = new Map(US_STATES.map((state) => [state.code, state.name]));
export const COUNTRY_LABELS = new Map([
  ['US', 'United States'],
  ['CA', 'Canada'],
  ['MX', 'Mexico'],
  ['GB', 'United Kingdom'],
  ['AU', 'Australia'],
  ['DE', 'Germany'],
  ['FR', 'France'],
  ['JP', 'Japan'],
]);

export function getStringParam(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function formatJurisdiction(run: WigleImportRun): {
  label: string;
  detail: string | null;
  isUnknown: boolean;
} {
  const stateOrRegion = getStringParam(run.state) || getStringParam(run.requestParams?.region);
  const country = getStringParam(run.requestParams?.country);
  const normalizedCountry = country.toUpperCase();
  const code = (
    stateOrRegion || (TERRITORY_CODES.has(normalizedCountry) ? country : '')
  ).toUpperCase();

  if (!code) {
    if (!country) {
      return {
        label: 'Global',
        detail: null,
        isUnknown: false,
      };
    }

    const countryName = COUNTRY_LABELS.get(normalizedCountry);
    if (countryName) {
      return {
        label: `${normalizedCountry} — ${countryName} (National)`,
        detail: `country=${normalizedCountry} region=${stateOrRegion || '-'}`,
        isUnknown: false,
      };
    }

    return {
      label: 'Unknown',
      detail: `country=${normalizedCountry || '-'} region=${stateOrRegion || '-'} state=${run.state || '-'}`,
      isUnknown: true,
    };
  }

  const name = JURISDICTION_LABELS.get(code);
  if (name) {
    return {
      label: `${code} — ${name}`,
      detail: `country=${country || '-'} region=${stateOrRegion || '-'}`,
      isUnknown: false,
    };
  }

  return {
    label: 'Unknown',
    detail: `country=${country || '-'} region=${stateOrRegion || '-'} state=${run.state || '-'}`,
    isUnknown: true,
  };
}
