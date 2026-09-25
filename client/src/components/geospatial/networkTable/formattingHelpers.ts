import { formatSecurity } from '../../../utils/wigle/security';

export const formatNumber = (value: number | null | undefined, precision = 1): string | null =>
  value === null || value === undefined ? null : value.toFixed(precision);

export const formatDistanceKm = (km: number | null | undefined): string | null => {
  if (km === null || km === undefined || !Number.isFinite(km)) {
    return null;
  }
  return parseFloat(km.toFixed(2)).toString();
};

export const metersToKm = (meters: number | null | undefined): number | null => {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) {
    return null;
  }
  return meters / 1000;
};

export const threatScoreColor = (value: number | null): string => {
  if (value === null) {
    return '#94a3b8';
  }
  if (value >= 75) {
    return '#dc2626';
  }
  if (value >= 50) {
    return '#f97316';
  }
  if (value >= 25) {
    return '#f59e0b';
  }
  return '#22c55e';
};

export const formatPercentLabel = (value: number | null | undefined): string | null => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  const percent = value * 100;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1)}%`;
};

export const getChannelBand = (channel: number, freqMhz: number | null): string => {
  if (freqMhz !== null && freqMhz > 0) {
    if (freqMhz >= 5925) {
      return '6 GHz';
    }
    if (freqMhz >= 5000) {
      return '5 GHz';
    }
    return '2.4 GHz';
  }
  if (channel >= 36) {
    return '5 GHz';
  }
  if (channel >= 1 && channel <= 14) {
    return '2.4 GHz';
  }
  return '';
};

export const getSignalQualityLabel = (dbm: number | null): string | undefined => {
  if (dbm === null || dbm === 0) {
    return undefined;
  }
  if (dbm >= -50) {
    return `${dbm} dBm · Excellent signal`;
  }
  if (dbm >= -60) {
    return `${dbm} dBm · Good signal`;
  }
  if (dbm >= -70) {
    return `${dbm} dBm · Fair signal`;
  }
  if (dbm >= -80) {
    return `${dbm} dBm · Poor signal`;
  }
  return `${dbm} dBm · Very poor signal`;
};

export const getSecurityTooltip = (
  security: string | null | undefined,
  capabilities: string | null | undefined,
  networkType: string | null | undefined
): string | undefined => {
  const displaySecurity = formatSecurity(capabilities, security).trim().toUpperCase();
  const normalizedType = String(networkType || '')
    .trim()
    .toUpperCase();
  const isWiFiType = normalizedType === 'W';
  const shouldShowDash =
    !displaySecurity ||
    displaySecurity.startsWith('UNKNOWN') ||
    displaySecurity === '—' ||
    (!isWiFiType && displaySecurity === 'OPEN');

  if (shouldShowDash) {
    return undefined;
  }

  const rawCapabilities = typeof capabilities === 'string' ? capabilities.trim() : '';
  const normalizedRawCapabilities = rawCapabilities.toUpperCase();
  const hasStructuredCapabilities =
    normalizedRawCapabilities.includes('[') ||
    /(WPA|RSN|WEP|WPS|OWE|SAE|TKIP|CCMP|EAP|ESS|IBSS)/.test(normalizedRawCapabilities);
  const shouldIncludeRawCapabilities =
    hasStructuredCapabilities &&
    rawCapabilities.length > 0 &&
    normalizedRawCapabilities !== displaySecurity &&
    normalizedRawCapabilities !== 'OPEN' &&
    normalizedRawCapabilities !== 'OPEN/UNKNOWN' &&
    normalizedRawCapabilities !== 'NONE';

  return shouldIncludeRawCapabilities ? `${displaySecurity} | ${rawCapabilities}` : displaySecurity;
};
