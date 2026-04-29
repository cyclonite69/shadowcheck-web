import crypto from 'crypto';
import secretsManager from './secretsManager';

export {};

type ParamSource = URLSearchParams | Record<string, unknown>;

function normalizeParamValue(key: string, rawValue: unknown): string {
  const stringValue = String(rawValue ?? '')
    .trim()
    .replace(/\s+/g, ' ');

  if (stringValue === '') {
    return '';
  }

  if (['bssid', 'netid'].includes(key)) {
    return stringValue.toUpperCase();
  }

  if (
    ['latrange1', 'latrange2', 'longrange1', 'longrange2', 'first', 'resultsPerPage'].includes(key)
  ) {
    const parsed = Number(stringValue);
    return Number.isFinite(parsed) ? String(parsed) : stringValue;
  }

  if (key === 'version') {
    return stringValue.toLowerCase();
  }

  return stringValue;
}

function toEntries(source: ParamSource): Array<[string, string]> {
  if (source instanceof URLSearchParams) {
    return Array.from(source.entries());
  }

  return Object.entries(source)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        return value.map((item) => [key, normalizeParamValue(key, item)] as [string, string]);
      }
      return [[key, normalizeParamValue(key, value)] as [string, string]];
    });
}

function normalizeParams(source: ParamSource): string {
  return JSON.stringify(
    toEntries(source)
      .filter(([, value]) => value !== '')
      .sort(([keyA, valueA], [keyB, valueB]) =>
        keyA === keyB ? valueA.localeCompare(valueB) : keyA.localeCompare(keyB)
      )
  );
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashParams(source: ParamSource): string {
  return sha256(normalizeParams(source));
}

function hashRecord(record: Record<string, unknown>): string {
  const normalized = Object.entries(record)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => [key, normalizeParamValue(key, value)]);

  return sha256(JSON.stringify(normalized));
}

function getEncodedWigleAuth(): string {
  const wigleApiName = secretsManager.get('wigle_api_name');
  const wigleApiToken = secretsManager.get('wigle_api_token');
  if (!wigleApiName || !wigleApiToken) {
    throw new Error(
      'WiGLE API credentials not configured. Set wigle_api_name and wigle_api_token secrets.'
    );
  }
  return Buffer.from(`${wigleApiName}:${wigleApiToken}`).toString('base64');
}

export { hashParams, hashRecord, normalizeParams, getEncodedWigleAuth };
