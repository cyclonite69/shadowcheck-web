/**
 * SQL Expression Builders
 * Reusable SQL CASE expressions for radio type, security, and channel inference.
 */

const OBS_TYPE_EXPR = (alias = 'o'): string => `
  COALESCE(${alias}.radio_type, CASE
    WHEN ${alias}.radio_frequency BETWEEN 2412 AND 2484 THEN 'W'
    WHEN ${alias}.radio_frequency BETWEEN 5000 AND 5900 THEN 'W'
    WHEN ${alias}.radio_frequency BETWEEN 5925 AND 7125 THEN 'W'
    WHEN UPPER(COALESCE(${alias}.radio_capabilities, '')) ~ '(WPA|WEP|WPS|RSN|ESS|CCMP|TKIP)' THEN 'W'
    WHEN UPPER(COALESCE(${alias}.radio_capabilities, '')) ~ '(BLE|BTLE|BLUETOOTH.?LOW.?ENERGY)' THEN 'E'
    WHEN UPPER(COALESCE(${alias}.radio_capabilities, '')) ~ '(BLUETOOTH)' THEN 'B'
    WHEN UPPER(COALESCE(${alias}.radio_capabilities, '')) ~ '(LTE|4G|EARFCN|5G|NR|3GPP)' THEN 'L'
    ELSE '?'
  END)
`;

const SECURITY_EXPR = (alias = 'o'): string => `
  CASE
    WHEN COALESCE(${alias}.radio_capabilities, '') = '' THEN 'OPEN'
    WHEN UPPER(${alias}.radio_capabilities) LIKE '%WEP%' THEN 'WEP'
    WHEN UPPER(${alias}.radio_capabilities) ~ '^\\s*\\[ESS\\]\\s*$' THEN 'OPEN'
    WHEN UPPER(${alias}.radio_capabilities) ~ '^\\s*\\[IBSS\\]\\s*$' THEN 'OPEN'
    WHEN UPPER(${alias}.radio_capabilities) ~ 'RSN-OWE' THEN 'WPA3-OWE'
    WHEN UPPER(${alias}.radio_capabilities) ~ 'RSN-SAE' THEN 'WPA3-SAE'
    WHEN UPPER(${alias}.radio_capabilities) ~ '(WPA3|SAE)' AND UPPER(${alias}.radio_capabilities) ~ '(EAP|MGT)' THEN 'WPA3-E'
    WHEN UPPER(${alias}.radio_capabilities) ~ '(WPA3|SAE)' THEN 'WPA3'
    WHEN UPPER(${alias}.radio_capabilities) ~ '(WPA2|RSN)' AND UPPER(${alias}.radio_capabilities) ~ '(EAP|MGT)' THEN 'WPA2-E'
    WHEN UPPER(${alias}.radio_capabilities) ~ '(WPA2|RSN)' THEN 'WPA2'
    WHEN UPPER(${alias}.radio_capabilities) ~ 'WPA-' AND UPPER(${alias}.radio_capabilities) NOT LIKE '%WPA2%' THEN 'WPA'
    WHEN UPPER(${alias}.radio_capabilities) LIKE '%WPA%' AND UPPER(${alias}.radio_capabilities) NOT LIKE '%WPA2%' AND UPPER(${alias}.radio_capabilities) NOT LIKE '%WPA3%' AND UPPER(${alias}.radio_capabilities) NOT LIKE '%RSN%' THEN 'WPA'
    WHEN UPPER(${alias}.radio_capabilities) LIKE '%WPS%' AND UPPER(${alias}.radio_capabilities) NOT LIKE '%WPA%' AND UPPER(${alias}.radio_capabilities) NOT LIKE '%RSN%' THEN 'WPS'
    WHEN UPPER(${alias}.radio_capabilities) ~ '(CCMP|TKIP|AES)' THEN 'WPA2'
    ELSE 'Unknown'
  END
`;

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
      CASE
        WHEN (${THREAT_SCORE_EXPR(ntsAlias, ntAlias)}) >= 80 THEN 'CRITICAL'
        WHEN (${THREAT_SCORE_EXPR(ntsAlias, ntAlias)}) >= 60 THEN 'HIGH'
        WHEN (${THREAT_SCORE_EXPR(ntsAlias, ntAlias)}) >= 40 THEN 'MED'
        WHEN (${THREAT_SCORE_EXPR(ntsAlias, ntAlias)}) >= 20 THEN 'LOW'
        ELSE 'NONE'
      END
    )
  END
`;

export {
  OBS_TYPE_EXPR,
  SECURITY_EXPR,
  AUTH_EXPR,
  WIFI_CHANNEL_EXPR,
  NETWORK_CHANNEL_EXPR,
  THREAT_SCORE_EXPR,
  THREAT_LEVEL_EXPR,
};
