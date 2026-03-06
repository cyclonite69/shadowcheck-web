/**
 * SQL Expression Builders
 * Reusable SQL CASE expressions for radio type, security, and channel inference.
 */

const SUPPORTED_RADIO_TYPES = ['W', 'B', 'E', 'L', 'N', 'G', 'C', 'D', 'F', '?'] as const;

const RADIO_TYPE_ALIASES: Record<string, (typeof SUPPORTED_RADIO_TYPES)[number]> = {
  W: 'W',
  WIFI: 'W',
  'WI-FI': 'W',
  E: 'E',
  BLE: 'E',
  B: 'B',
  BLUETOOTH: 'B',
  BT: 'B',
  L: 'L',
  LTE: 'L',
  G: 'G',
  GSM: 'G',
  N: 'N',
  NR: 'N',
  '5G': 'N',
  C: 'C',
  CDMA: 'C',
  D: 'D',
  DECT: 'D',
  F: 'F',
  FM: 'F',
  '?': '?',
  UNKNOWN: '?',
};

const normalizeRadioTypes = (rawTypes: unknown): string[] => {
  if (!Array.isArray(rawTypes)) {
    return [];
  }

  const deduped = new Set<string>();
  rawTypes.forEach((value) => {
    const key = String(value || '')
      .trim()
      .toUpperCase();
    const normalized = RADIO_TYPE_ALIASES[key];
    if (normalized) {
      deduped.add(normalized);
    }
  });

  return Array.from(deduped);
};

const isAllRadioTypesSelection = (radioTypes: string[]): boolean =>
  SUPPORTED_RADIO_TYPES.every((type) => radioTypes.includes(type));

const OBS_TYPE_EXPR = (alias = 'o'): string => `
  CASE
    WHEN UPPER(COALESCE(${alias}.radio_type, '')) IN ('W', 'WIFI', 'WI-FI') THEN 'W'
    WHEN UPPER(COALESCE(${alias}.radio_type, '')) IN ('E', 'BLE') THEN 'E'
    WHEN UPPER(COALESCE(${alias}.radio_type, '')) IN ('B', 'BLUETOOTH', 'BT') THEN 'B'
    WHEN UPPER(COALESCE(${alias}.radio_type, '')) IN ('L', 'LTE') THEN 'L'
    WHEN UPPER(COALESCE(${alias}.radio_type, '')) IN ('G', 'GSM') THEN 'G'
    WHEN UPPER(COALESCE(${alias}.radio_type, '')) IN ('N', 'NR', '5G') THEN 'N'
    WHEN UPPER(COALESCE(${alias}.radio_type, '')) IN ('C', 'CDMA') THEN 'C'
    WHEN UPPER(COALESCE(${alias}.radio_type, '')) IN ('D', 'DECT') THEN 'D'
    WHEN UPPER(COALESCE(${alias}.radio_type, '')) IN ('F', 'FM') THEN 'F'
    WHEN UPPER(COALESCE(${alias}.radio_type, '')) IN ('?', 'UNKNOWN') THEN '?'
    WHEN ${alias}.radio_frequency BETWEEN 2412 AND 2484 THEN 'W'
    WHEN ${alias}.radio_frequency BETWEEN 5000 AND 5900 THEN 'W'
    WHEN ${alias}.radio_frequency BETWEEN 5925 AND 7125 THEN 'W'
    WHEN UPPER(COALESCE(${alias}.radio_capabilities, '')) ~ '(WPA|WEP|WPS|RSN|ESS|CCMP|TKIP)' THEN 'W'
    WHEN UPPER(COALESCE(${alias}.radio_capabilities, '')) ~ '(BLE|BTLE|BLUETOOTH.?LOW.?ENERGY)' THEN 'E'
    WHEN UPPER(COALESCE(${alias}.radio_capabilities, '')) ~ '(BLUETOOTH)' THEN 'B'
    WHEN UPPER(COALESCE(${alias}.radio_capabilities, '')) ~ '(LTE|4G|EARFCN|5G|NR|3GPP)' THEN 'L'
    ELSE '?'
  END
`;

const SECURITY_FROM_CAPS_EXPR = (capsExpr: string): string => `
  CASE
    WHEN COALESCE(${capsExpr}, '') = '' THEN 'OPEN'
    WHEN UPPER(${capsExpr}) LIKE '%WPA3-E%' THEN 'WPA3-E'
    WHEN UPPER(${capsExpr}) LIKE '%WPA3-P%' THEN 'WPA3-P'
    WHEN UPPER(${capsExpr}) LIKE '%WPA2-E%' THEN 'WPA2-E'
    WHEN UPPER(${capsExpr}) LIKE '%WPA2-P%' THEN 'WPA2-P'
    WHEN UPPER(${capsExpr}) LIKE '%WEP%' THEN 'WEP'
    WHEN UPPER(${capsExpr}) ~ '^\\s*\\[ESS\\]\\s*$' THEN 'OPEN'
    WHEN UPPER(${capsExpr}) ~ '^\\s*\\[IBSS\\]\\s*$' THEN 'OPEN'
    WHEN UPPER(${capsExpr}) ~ 'RSN-OWE' OR UPPER(${capsExpr}) ~ '\\mOWE\\M' THEN 'OWE'
    WHEN UPPER(${capsExpr}) ~ 'RSN-SAE' THEN 'WPA3-P'
    WHEN UPPER(${capsExpr}) ~ '(WPA3|SAE)' AND UPPER(${capsExpr}) ~ '(EAP|MGT)' THEN 'WPA3-E'
    WHEN UPPER(${capsExpr}) ~ '(WPA3|SAE)' AND UPPER(${capsExpr}) ~ '(PSK|SAE)' THEN 'WPA3-P'
    WHEN UPPER(${capsExpr}) ~ '(WPA3|SAE)' THEN 'WPA3'
    WHEN UPPER(${capsExpr}) ~ '(WPA2|RSN)' AND UPPER(${capsExpr}) ~ '(EAP|MGT)' THEN 'WPA2-E'
    WHEN UPPER(${capsExpr}) ~ '(WPA2|RSN)' AND UPPER(${capsExpr}) ~ '(PSK|SAE)' THEN 'WPA2-P'
    WHEN UPPER(${capsExpr}) ~ '(WPA2|RSN)' THEN 'WPA2'
    WHEN UPPER(${capsExpr}) ~ 'WPA-' AND UPPER(${capsExpr}) NOT LIKE '%WPA2%' THEN 'WPA'
    WHEN UPPER(${capsExpr}) LIKE '%WPA%' AND UPPER(${capsExpr}) NOT LIKE '%WPA2%' AND UPPER(${capsExpr}) NOT LIKE '%WPA3%' AND UPPER(${capsExpr}) NOT LIKE '%RSN%' THEN 'WPA'
    WHEN UPPER(${capsExpr}) LIKE '%WPS%' AND UPPER(${capsExpr}) NOT LIKE '%WPA%' AND UPPER(${capsExpr}) NOT LIKE '%RSN%' THEN 'WPS'
    WHEN UPPER(${capsExpr}) ~ '(CCMP|TKIP|AES)' THEN 'WPA2'
    ELSE 'UNKNOWN'
  END
`;

const SECURITY_EXPR = (alias = 'o'): string =>
  SECURITY_FROM_CAPS_EXPR(`${alias}.radio_capabilities`);

const AUTH_EXPR = (alias = 'o'): string => `
  CASE
    WHEN UPPER(${alias}.radio_capabilities) ~ '(EAP|MGT|ENT)' THEN 'Enterprise'
    WHEN UPPER(${alias}.radio_capabilities) ~ '(SAE)' THEN 'SAE'
    WHEN UPPER(${alias}.radio_capabilities) ~ '(OWE)' THEN 'OWE'
    WHEN UPPER(${alias}.radio_capabilities) ~ '(PSK)' THEN 'PSK'
    WHEN COALESCE(${alias}.radio_capabilities, '') = '' THEN 'None'
    ELSE 'Unknown'
  END
`;

const WIFI_CHANNEL_EXPR = (alias = 'o'): string => `
  CASE
    WHEN ${alias}.radio_frequency BETWEEN 2412 AND 2484 THEN
      CASE
        WHEN ${alias}.radio_frequency = 2484 THEN 14
        ELSE FLOOR((${alias}.radio_frequency - 2412) / 5) + 1
      END
    WHEN ${alias}.radio_frequency BETWEEN 5000 AND 5900 THEN FLOOR((${alias}.radio_frequency - 5000) / 5)
    WHEN ${alias}.radio_frequency BETWEEN 5925 AND 7125 THEN FLOOR((${alias}.radio_frequency - 5925) / 5)
    ELSE NULL
  END
`;

const NETWORK_CHANNEL_EXPR = (alias = 'ne'): string => `
  CASE
    WHEN ${alias}.frequency BETWEEN 2412 AND 2484 THEN
      CASE
        WHEN ${alias}.frequency = 2484 THEN 14
        ELSE FLOOR((${alias}.frequency - 2412) / 5) + 1
      END
    WHEN ${alias}.frequency BETWEEN 5000 AND 5900 THEN FLOOR((${alias}.frequency - 5000) / 5)
    WHEN ${alias}.frequency BETWEEN 5925 AND 7125 THEN FLOOR((${alias}.frequency - 5925) / 5)
    ELSE NULL
  END
`;

// Uses app.get_threat_score() function which reads ml_blending_enabled setting
// When ML blending disabled: uses rule_based_score only
// When ML blending enabled: blends rule_based * (1-weight) + ml * weight
const THREAT_SCORE_EXPR = (ntsAlias = 'nts', ntAlias = 'nt'): string => `
  app.get_threat_score(
    ${ntsAlias}.rule_based_score,
    ${ntsAlias}.ml_threat_score,
    ${ntAlias}.threat_tag,
    ${ntAlias}.threat_confidence
  )
`;

const THREAT_LEVEL_EXPR = (ntsAlias = 'nts', ntAlias = 'nt'): string => `
  CASE
    WHEN ${ntAlias}.threat_tag = 'FALSE_POSITIVE' THEN 'NONE'
    WHEN ${ntAlias}.threat_tag = 'INVESTIGATE' THEN COALESCE(${ntsAlias}.final_threat_level, 'NONE')
    ELSE (
      COALESCE(
        ${ntsAlias}.final_threat_level,
        CASE
          WHEN (${THREAT_SCORE_EXPR(ntsAlias, ntAlias)}) >= 80 THEN 'CRITICAL'
          WHEN (${THREAT_SCORE_EXPR(ntsAlias, ntAlias)}) >= 60 THEN 'HIGH'
          WHEN (${THREAT_SCORE_EXPR(ntsAlias, ntAlias)}) >= 40 THEN 'MED'
          WHEN (${THREAT_SCORE_EXPR(ntsAlias, ntAlias)}) >= 20 THEN 'LOW'
          ELSE 'NONE'
        END
      )
    )
  END
`;

export {
  SUPPORTED_RADIO_TYPES,
  normalizeRadioTypes,
  isAllRadioTypesSelection,
  OBS_TYPE_EXPR,
  SECURITY_FROM_CAPS_EXPR,
  SECURITY_EXPR,
  AUTH_EXPR,
  WIFI_CHANNEL_EXPR,
  NETWORK_CHANNEL_EXPR,
  THREAT_SCORE_EXPR,
  THREAT_LEVEL_EXPR,
};
