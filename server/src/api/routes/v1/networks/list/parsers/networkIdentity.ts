import { validateString, validateBSSIDList } from '../../../../../../validation/schemas';
import { parseCommaList } from '../../../../../../validation/parameterParsers';

export type NetworkIdentityParams = {
  ssidPattern: string | null;
  bssidList: string[] | null;
  quickSearchPattern: string | null;
  manufacturer: string | null;
  radioTypes: string[] | null;
  encryptionTypes: string[] | null;
  authMethods: string[] | null;
  insecureFlags: string[] | null;
  securityFlags: string[] | null;
  requireMacForBssid: boolean;
};

const WIFI_TYPES = new Set(['W', 'B', 'E']);
const CELLULAR_TYPES = new Set(['G', 'C', 'D', 'L', 'N', 'F']);

const parseCommaFilter = (raw: unknown, limit: number): string[] | null => {
  if (raw === undefined) return null;
  const values = parseCommaList(raw, limit);
  return values && values.length > 0 ? values : null;
};

export const parseNetworkIdentity = (
  ssidRaw: unknown,
  bssidRaw: unknown,
  quickSearchRaw: unknown,
  manufacturerRaw: unknown,
  radioTypesRaw: unknown,
  encryptionTypesRaw: unknown,
  authMethodsRaw: unknown,
  insecureFlagsRaw: unknown,
  securityFlagsRaw: unknown
): { ok: true; params: NetworkIdentityParams } | { ok: false; status: 400; error: string } => {
  let ssidPattern: string | null = null;
  if (ssidRaw !== undefined) {
    const validation = validateString(ssidRaw, 'ssid');
    if (!validation.valid) return { ok: false, status: 400, error: 'Invalid ssid parameter.' };
    ssidPattern = validation.value ?? null;
  }

  let bssidList: string[] | null = null;
  if (bssidRaw !== undefined) {
    const validation = validateBSSIDList(String(bssidRaw));
    if (!validation.valid) return { ok: false, status: 400, error: validation.error! };
    bssidList = validation.value ?? null;
  }

  let quickSearchPattern: string | null = null;
  if (quickSearchRaw !== undefined) {
    const validation = validateString(quickSearchRaw, 'q');
    if (!validation.valid) return { ok: false, status: 400, error: 'Invalid q parameter.' };
    quickSearchPattern = validation.value ?? null;
  }

  let manufacturer: string | null = null;
  if (manufacturerRaw !== undefined) {
    const validation = validateString(manufacturerRaw, 'manufacturer');
    if (!validation.valid)
      return { ok: false, status: 400, error: 'Invalid manufacturer parameter.' };
    manufacturer = validation.value ?? null;
  }

  let radioTypes: string[] | null = null;
  if (radioTypesRaw !== undefined) {
    const values = parseCommaList(radioTypesRaw, 20);
    if (values && values.length > 0) {
      radioTypes = values.map((v: string) => v.toUpperCase());
    }
  }

  const isWifiOnly =
    Array.isArray(radioTypes) &&
    radioTypes.length > 0 &&
    radioTypes.every((t) => WIFI_TYPES.has(t));
  const hasCellular = Array.isArray(radioTypes) && radioTypes.some((t) => CELLULAR_TYPES.has(t));

  return {
    ok: true,
    params: {
      ssidPattern,
      bssidList,
      quickSearchPattern,
      manufacturer,
      radioTypes,
      encryptionTypes: parseCommaFilter(encryptionTypesRaw, 50),
      authMethods: parseCommaFilter(authMethodsRaw, 20),
      insecureFlags: parseCommaFilter(insecureFlagsRaw, 20),
      securityFlags: parseCommaFilter(securityFlagsRaw, 20),
      requireMacForBssid: isWifiOnly && !hasCellular,
    },
  };
};
