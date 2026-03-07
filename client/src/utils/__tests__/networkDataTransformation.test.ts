import {
  inferNetworkType,
  calculateTimespan,
  parseNumericField,
  mapApiRowToNetwork,
} from '../networkDataTransformation';

// ---------------------------------------------------------------------------
// inferNetworkType
// ---------------------------------------------------------------------------
describe('inferNetworkType', () => {
  it('passes through a known db type directly', () => {
    expect(inferNetworkType('W', null, null, null)).toBe('W');
    expect(inferNetworkType('E', null, null, null)).toBe('E');
    expect(inferNetworkType('B', null, null, null)).toBe('B');
    expect(inferNetworkType('L', null, null, null)).toBe('L');
    expect(inferNetworkType('N', null, null, null)).toBe('N');
    expect(inferNetworkType('G', null, null, null)).toBe('G');
  });

  it('ignores placeholder db types and falls back to inference', () => {
    // '?' and 'Unknown' should not be returned as-is
    expect(inferNetworkType('?', 2437, null, null)).toBe('W');
    expect(inferNetworkType('Unknown', 2437, null, null)).toBe('W');
    expect(inferNetworkType(null, 2437, null, null)).toBe('W');
  });

  it('infers W from 2.4 GHz frequency', () => {
    expect(inferNetworkType(null, 2412, null, null)).toBe('W');
    expect(inferNetworkType(null, 2484, null, null)).toBe('W');
  });

  it('infers W from 5 GHz frequency', () => {
    expect(inferNetworkType(null, 5180, null, null)).toBe('W');
    expect(inferNetworkType(null, 5900, null, null)).toBe('W');
  });

  it('infers W from 6 GHz frequency', () => {
    expect(inferNetworkType(null, 5935, null, null)).toBe('W');
    expect(inferNetworkType(null, 7125, null, null)).toBe('W');
  });

  it('infers W from WPA capability', () => {
    expect(inferNetworkType(null, null, null, '[WPA2-PSK-CCMP][ESS]')).toBe('W');
  });

  it('infers W from ESS capability', () => {
    expect(inferNetworkType(null, null, null, '[ESS]')).toBe('W');
  });

  it('infers N from 5G SSID keyword', () => {
    expect(inferNetworkType(null, null, 'MyNetwork5G', null)).toBe('N');
  });

  it('infers L from LTE SSID keyword', () => {
    expect(inferNetworkType(null, null, 'LTE-hotspot', null)).toBe('L');
  });

  it('infers E (BLE) from BLUETOOTH SSID + BLE capability', () => {
    expect(inferNetworkType(null, null, 'Bluetooth Sensor', 'BLE')).toBe('E');
  });

  it('infers B from BLUETOOTH SSID without BLE marker', () => {
    expect(inferNetworkType(null, null, 'BLUETOOTH Device', null)).toBe('B');
  });

  it('falls back to ? when no inference is possible', () => {
    expect(inferNetworkType(null, null, null, null)).toBe('?');
    expect(inferNetworkType('?', null, null, null)).toBe('?');
  });
});

// ---------------------------------------------------------------------------
// calculateTimespan
// ---------------------------------------------------------------------------
describe('calculateTimespan', () => {
  it('returns correct days between two dates', () => {
    expect(calculateTimespan('2024-01-01T00:00:00Z', '2024-01-08T00:00:00Z')).toBe(7);
  });

  it('returns 0 for same-day observations (identical timestamps)', () => {
    expect(calculateTimespan('2024-06-15T12:00:00Z', '2024-06-15T12:00:00Z')).toBe(0);
  });

  it('returns null when first is null', () => {
    expect(calculateTimespan(null, '2024-01-08T00:00:00Z')).toBeNull();
  });

  it('returns null when last is null', () => {
    expect(calculateTimespan('2024-01-01T00:00:00Z', null)).toBeNull();
  });

  it('returns null for invalid date strings', () => {
    expect(calculateTimespan('not-a-date', '2024-01-08T00:00:00Z')).toBeNull();
    expect(calculateTimespan('2024-01-01T00:00:00Z', 'not-a-date')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseNumericField
// ---------------------------------------------------------------------------
describe('parseNumericField', () => {
  it('passes through numbers unchanged', () => {
    expect(parseNumericField(42)).toBe(42);
    expect(parseNumericField(-3.14)).toBe(-3.14);
    expect(parseNumericField(0)).toBe(0);
  });

  it('parses numeric strings', () => {
    expect(parseNumericField('100')).toBe(100);
    expect(parseNumericField('-50.5')).toBe(-50.5);
  });

  it('returns null for NaN strings', () => {
    expect(parseNumericField('abc')).toBeNull();
    expect(parseNumericField('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(parseNumericField(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseNumericField(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapApiRowToNetwork
// ---------------------------------------------------------------------------
describe('mapApiRowToNetwork', () => {
  const baseRow = {
    bssid: 'aa:bb:cc:dd:ee:ff',
    ssid: 'TestNet',
    type: 'W',
    frequency: 2437,
    signal: -65,
    capabilities: '[WPA2-PSK-CCMP][ESS]',
    obs_count: 10,
    lat: 51.5,
    lon: -0.1,
    first_observed_at: '2024-01-01T00:00:00Z',
    last_observed_at: '2024-01-08T00:00:00Z',
    final_threat_score: 20,
    final_threat_level: 'LOW',
  };

  it('uppercases BSSID', () => {
    const net = mapApiRowToNetwork(baseRow, 0);
    expect(net.bssid).toBe('AA:BB:CC:DD:EE:FF');
  });

  it('uses (hidden) fallback when ssid is empty', () => {
    const net = mapApiRowToNetwork({ ...baseRow, ssid: '' }, 0);
    expect(net.ssid).toBe('(hidden)');
  });

  it('falls back to unknown-<idx> when bssid is missing', () => {
    const net = mapApiRowToNetwork({ ...baseRow, bssid: null }, 5);
    expect(net.bssid).toBe('UNKNOWN-5');
  });

  it('builds correct threat object shape', () => {
    const net = mapApiRowToNetwork(baseRow, 0);
    expect(net.threat).toEqual(
      expect.objectContaining({
        score: 0.2,
        level: 'LOW',
        summary: 'Threat level: LOW',
      })
    );
  });

  it('preserves CRITICAL threat level in threat object', () => {
    const net = mapApiRowToNetwork({ ...baseRow, final_threat_level: 'CRITICAL' }, 0);
    expect(net.threat?.level).toBe('CRITICAL');
  });

  it('converts distanceFromHome from km to metres', () => {
    const net = mapApiRowToNetwork({ ...baseRow, distance_from_home_km: 1.5 }, 0);
    expect(net.distanceFromHome).toBeCloseTo(1500);
  });

  it('sets distanceFromHome to null when field is absent', () => {
    const net = mapApiRowToNetwork({ ...baseRow, distance_from_home_km: null }, 0);
    expect(net.distanceFromHome).toBeNull();
  });

  it('computes timespanDays correctly', () => {
    const net = mapApiRowToNetwork(baseRow, 0);
    expect(net.timespanDays).toBe(7);
  });

  it('handles null latitude and longitude gracefully', () => {
    const net = mapApiRowToNetwork({ ...baseRow, lat: null, lon: null }, 0);
    expect(net.latitude).toBeNull();
    expect(net.longitude).toBeNull();
  });

  it('prefers capability-derived security variant over broad fallback label', () => {
    const net = mapApiRowToNetwork(
      {
        ...baseRow,
        capabilities: '[WPA2-EAP-CCMP][ESS]',
        security: 'WPA2',
      },
      0
    );
    expect(net.security).toBe('WPA2-E');
  });
});
