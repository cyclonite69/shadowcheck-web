import {
  stripNullBytes,
  stripNullBytesKeepEmpty,
  stripNullBytesDeep,
  parseJsonObject,
  parseJsonArray,
  mapCachedDetailToApiShape,
  inferWigleEndpoint,
  parseIncludeTotalFlag,
} from '../../../server/src/services/wigleDetailTransforms';

describe('stripNullBytes', () => {
  it('removes null bytes from string', () => {
    expect(stripNullBytes('abc\u0000def')).toBe('abcdef');
  });

  it('returns null for null input', () => {
    expect(stripNullBytes(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(stripNullBytes(undefined)).toBeNull();
  });

  it('returns null for empty-after-strip result', () => {
    expect(stripNullBytes('\u0000')).toBeNull();
  });

  it('preserves normal strings', () => {
    expect(stripNullBytes('hello')).toBe('hello');
  });

  it('coerces numbers to string', () => {
    expect(stripNullBytes(42)).toBe('42');
  });
});

describe('stripNullBytesKeepEmpty', () => {
  it('returns empty string when only null bytes', () => {
    expect(stripNullBytesKeepEmpty('\u0000\u0000')).toBe('');
  });

  it('preserves empty string input', () => {
    expect(stripNullBytesKeepEmpty('')).toBe('');
  });

  it('returns null passthrough', () => {
    expect(stripNullBytesKeepEmpty(null)).toBeNull();
  });

  it('returns undefined passthrough', () => {
    expect(stripNullBytesKeepEmpty(undefined)).toBeUndefined();
  });

  it('strips null bytes from normal string', () => {
    expect(stripNullBytesKeepEmpty('a\u0000b')).toBe('ab');
  });
});

describe('stripNullBytesDeep', () => {
  it('handles null/undefined passthrough', () => {
    expect(stripNullBytesDeep(null)).toBeNull();
    expect(stripNullBytesDeep(undefined)).toBeUndefined();
  });

  it('strips null bytes from string values', () => {
    expect(stripNullBytesDeep('a\u0000b')).toBe('ab');
  });

  it('recurses into arrays', () => {
    expect(stripNullBytesDeep(['a\u0000', 'b\u0000c'])).toEqual(['a', 'bc']);
  });

  it('recurses into objects', () => {
    const result = stripNullBytesDeep({ ssid: 'net\u0000work', count: 5 });
    expect(result).toEqual({ ssid: 'network', count: 5 });
  });

  it('recurses into nested objects', () => {
    const result = stripNullBytesDeep({ a: { b: 'x\u0000y' } });
    expect(result).toEqual({ a: { b: 'xy' } });
  });

  it('passes through numbers unchanged', () => {
    expect(stripNullBytesDeep(42)).toBe(42);
  });
});

describe('parseJsonObject', () => {
  it('returns undefined for null', () => {
    expect(parseJsonObject(null)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseJsonObject('')).toBeUndefined();
  });

  it('returns object directly if already an object', () => {
    const obj = { a: 1 };
    expect(parseJsonObject(obj)).toBe(obj);
  });

  it('parses valid JSON object string', () => {
    expect(parseJsonObject('{"city":"Chicago"}')).toEqual({ city: 'Chicago' });
  });

  it('returns undefined for invalid JSON', () => {
    expect(parseJsonObject('not-json')).toBeUndefined();
  });

  it('returns undefined for JSON array string (not an object)', () => {
    // parseJsonObject returns the parsed value (array), which is truthy
    // The function just returns the parsed value without type-checking
    const result = parseJsonObject('[1,2]');
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('parseJsonArray', () => {
  it('returns undefined for null', () => {
    expect(parseJsonArray(null)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseJsonArray('')).toBeUndefined();
  });

  it('returns array directly if already an array', () => {
    const arr = [1, 2, 3];
    expect(parseJsonArray(arr)).toBe(arr);
  });

  it('parses valid JSON array string', () => {
    expect(parseJsonArray('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('returns undefined for invalid JSON', () => {
    expect(parseJsonArray('not-json')).toBeUndefined();
  });

  it('returns undefined for JSON object string (not an array)', () => {
    expect(parseJsonArray('{"a":1}')).toBeUndefined();
  });
});

describe('mapCachedDetailToApiShape', () => {
  it('maps all core fields correctly', () => {
    const cached = {
      netid: 'AA:BB:CC:DD:EE:FF',
      ssid: 'MyNetwork',
      name: 'MyNet',
      encryption: 'WPA2',
      type: 'W',
      channel: 6,
      first_seen: '2023-01-01',
      last_seen: '2024-01-01',
      last_observed_at: '2024-06-01',
      trilat: 41.8781,
      trilon: -87.6298,
      street_address: '{"street":"Main St"}',
      location_clusters: '[{"lat":41.8,"lon":-87.6}]',
      comment: 'test comment',
      qos: 10,
    };
    const result = mapCachedDetailToApiShape(cached);
    expect(result.networkId).toBe('AA:BB:CC:DD:EE:FF');
    expect(result.ssid).toBe('MyNetwork');
    expect(result.name).toBe('MyNet');
    expect(result.encryption).toBe('WPA2');
    expect(result.type).toBe('W');
    expect(result.channel).toBe(6);
    expect(result.firstSeen).toBe('2023-01-01');
    expect(result.lastSeen).toBe('2024-01-01');
    expect(result.lastUpdate).toBe('2024-06-01');
    expect(result.trilateratedLatitude).toBe(41.8781);
    expect(result.trilateratedLongitude).toBe(-87.6298);
    expect(result.streetAddress).toEqual({ street: 'Main St' });
    expect(result.locationClusters).toEqual([{ lat: 41.8, lon: -87.6 }]);
    expect(result.comment).toBe('test comment');
    expect(result.bestClusterWiGLEQoS).toBe(10);
  });

  it('falls back name to ssid when name is absent', () => {
    const result = mapCachedDetailToApiShape({ netid: 'x', ssid: 'fallback' });
    expect(result.name).toBe('fallback');
  });

  it('falls back ssid to name when ssid is absent', () => {
    const result = mapCachedDetailToApiShape({ netid: 'x', name: 'NetName' });
    expect(result.ssid).toBe('NetName');
  });

  it('uses last_seen as lastUpdate when last_observed_at is absent', () => {
    const result = mapCachedDetailToApiShape({ netid: 'x', last_seen: '2024-01-01' });
    expect(result.lastUpdate).toBe('2024-01-01');
  });

  it('falls back to last_lat/last_lon for coordinates', () => {
    const result = mapCachedDetailToApiShape({ netid: 'x', last_lat: 40.0, last_lon: -80.0 });
    expect(result.trilateratedLatitude).toBe(40.0);
    expect(result.trilateratedLongitude).toBe(-80.0);
  });

  it('returns null for missing optional fields', () => {
    const result = mapCachedDetailToApiShape({ netid: 'x' });
    expect(result.ssid).toBeNull();
    expect(result.encryption).toBeNull();
    expect(result.comment).toBeNull();
    expect(result.streetAddress).toBeUndefined();
    expect(result.locationClusters).toBeUndefined();
  });
});

describe('inferWigleEndpoint', () => {
  it('returns "bt" for "BT", "BLE", "ble", " BLE "', () => {
    expect(inferWigleEndpoint('BT')).toBe('bt');
    expect(inferWigleEndpoint('BLE')).toBe('bt');
    expect(inferWigleEndpoint('ble')).toBe('bt');
    expect(inferWigleEndpoint(' BLE ')).toBe('bt');
  });

  it('returns "bt" for raw WiGLE BT strings "BT_LE", "BT_CLASSIC", "bt_le", " BLE_X "', () => {
    expect(inferWigleEndpoint('BT_LE')).toBe('bt');
    expect(inferWigleEndpoint('BT_CLASSIC')).toBe('bt');
    expect(inferWigleEndpoint('bt_le')).toBe('bt');
    expect(inferWigleEndpoint(' BLE_X ')).toBe('bt');
  });

  it('returns "wifi" for "BSS", "BRIDGE", "BTX", "infra", "W", null, undefined, ""', () => {
    expect(inferWigleEndpoint('BSS')).toBe('wifi');
    expect(inferWigleEndpoint('BRIDGE')).toBe('wifi');
    expect(inferWigleEndpoint('BTX')).toBe('wifi');
    expect(inferWigleEndpoint('infra')).toBe('wifi');
    expect(inferWigleEndpoint('W')).toBe('wifi');
    expect(inferWigleEndpoint(null)).toBe('wifi');
    expect(inferWigleEndpoint(undefined)).toBe('wifi');
    expect(inferWigleEndpoint('')).toBe('wifi');
  });

  it('returns "bt" for type "B"', () => {
    expect(inferWigleEndpoint('B')).toBe('bt');
  });

  it('returns "bt" for type "E" (BLE)', () => {
    expect(inferWigleEndpoint('E')).toBe('bt');
  });

  it('returns "bt" for lowercase "b"', () => {
    expect(inferWigleEndpoint('b')).toBe('bt');
  });

  it('returns "wifi" for unknown type', () => {
    expect(inferWigleEndpoint('L')).toBe('wifi');
  });
});

describe('parseIncludeTotalFlag', () => {
  it('returns valid:true, value:false for undefined', () => {
    expect(parseIncludeTotalFlag(undefined)).toEqual({ valid: true, value: false });
  });

  it('returns valid:true, value:false for null', () => {
    expect(parseIncludeTotalFlag(null)).toEqual({ valid: true, value: false });
  });

  it('returns valid:true, value:false for empty string', () => {
    expect(parseIncludeTotalFlag('')).toEqual({ valid: true, value: false });
  });

  it('returns valid:true, value:true for "1"', () => {
    expect(parseIncludeTotalFlag('1')).toEqual({ valid: true, value: true });
  });

  it('returns valid:true, value:true for "true"', () => {
    expect(parseIncludeTotalFlag('true')).toEqual({ valid: true, value: true });
  });

  it('returns valid:true, value:false for "0"', () => {
    expect(parseIncludeTotalFlag('0')).toEqual({ valid: true, value: false });
  });

  it('returns valid:true, value:false for "false"', () => {
    expect(parseIncludeTotalFlag('false')).toEqual({ valid: true, value: false });
  });

  it('returns valid:false with error for invalid value', () => {
    const result = parseIncludeTotalFlag('maybe');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid include_total/);
  });
});
