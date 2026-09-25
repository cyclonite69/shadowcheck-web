/**
 * Canonical US jurisdiction list for WiGLE coverage grid and daemon probe dispatch.
 *
 * Includes all 56 USPS jurisdictions: 50 states, DC, and five inhabited
 * territories. This is the authoritative source for server-side automation.
 *
 * IMPORTANT: Do not edit this list without updating the corresponding
 * US_STATES constant in client/src/constants/network.ts to match.
 */

export interface JurisdictionEntry {
  code: string;
  name: string;
}

/**
 * All 56 US USPS postal jurisdictions (50 states + DC + 5 inhabited territories).
 * Order matches the client-side US_STATES display list.
 */
export const US_JURISDICTIONS: JurisdictionEntry[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AS', name: 'American Samoa' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'GU', name: 'Guam' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'VI', name: 'U.S. Virgin Islands' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

/**
 * Derived array of just the jurisdiction codes — used by daemon probe dispatch.
 */
export const US_JURISDICTION_CODES: string[] = US_JURISDICTIONS.map((j) => j.code);

const US_JURISDICTION_CODE_SET = new Set(US_JURISDICTION_CODES);

/**
 * WiGLE probe support status for US territories.
 *
 * - 'supported' : Treated as normal US region — country=US&region=<code>.
 *   Auto-probing is safe.
 * - 'unverified': WiGLE behavior is unknown, inconsistent, or known to deviate
 *   (e.g. geocoding treats the territory as a foreign country, or test fixture
 *   inconsistencies were found). Do NOT auto-probe; show as 'unverified' in
 *   the coverage grid rather than 'failed' or 0% coverage.
 */
export const TERRITORY_PROBE_SUPPORT: Record<string, 'supported' | 'unverified'> = {
  PR: 'supported',
  AS: 'unverified',
  GU: 'unverified',
  MP: 'unverified',
  VI: 'unverified',
};

/**
 * Returns true if the given jurisdiction code is safe to include in an
 * automated daemon probe dispatch cycle.
 *
 * Excludes unverified territories (AS, GU, MP, VI) but allows states,
 * DC, and PR. Unknown codes are rejected as a fail-closed safety measure.
 */
export function isProbeDispatchable(code: string): boolean {
  const normalizedCode = code.toUpperCase();
  if (!US_JURISDICTION_CODE_SET.has(normalizedCode)) {
    return false;
  }
  return TERRITORY_PROBE_SUPPORT[normalizedCode] !== 'unverified';
}
