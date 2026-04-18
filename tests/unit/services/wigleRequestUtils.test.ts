import {
  hashParams,
  hashRecord,
  normalizeParams,
} from '../../../server/src/services/wigleRequestUtils';

describe('wigleRequestUtils', () => {
  describe('normalizeParams', () => {
    it('should normalize and sort parameters', () => {
      const params = {
        bssid: 'aa:bb:cc:dd:ee:ff',
        ssid: '  my ssid  ',
        latrange1: '40.123',
        notAnumber: 'abc',
        version: 'V2',
      };
      const result = normalizeParams(params);
      const parsed = JSON.parse(result);

      expect(parsed).toContainEqual(['bssid', 'AA:BB:CC:DD:EE:FF']);
      expect(parsed).toContainEqual(['ssid', 'my ssid']);
      expect(parsed).toContainEqual(['latrange1', '40.123']);
      expect(parsed).toContainEqual(['notAnumber', 'abc']);
      expect(parsed).toContainEqual(['version', 'v2']);
    });

    it('should handle empty values and whitespace', () => {
      const params = {
        empty: '',
        spaces: '   ',
        nil: null,
        undef: undefined,
      };
      const result = normalizeParams(params as any);
      expect(result).toBe('[]');
    });

    it('should handle URLSearchParams', () => {
      const params = new URLSearchParams();
      params.append('bssid', '00:11:22:33:44:55');
      params.append('ssid', 'test');

      const result = normalizeParams(params);
      expect(result).toContain('00:11:22:33:44:55');
      expect(result).toContain('test');
    });

    it('should handle arrays in parameters', () => {
      const params = {
        tags: ['tag1', 'tag2'],
        bssid: 'aa:bb:cc:dd:ee:ff',
      };
      const result = normalizeParams(params);
      const parsed = JSON.parse(result);
      expect(parsed).toContainEqual(['tags', 'tag1']);
      expect(parsed).toContainEqual(['tags', 'tag2']);
    });

    it('should handle non-finite numbers in range parameters', () => {
      const params = {
        latrange1: 'not-a-number',
      };
      const result = normalizeParams(params);
      expect(result).toContain('not-a-number');
    });

    it('should collapse multiple spaces in values', () => {
      const params = {
        ssid: 'my   ssid   with   spaces',
      };
      const result = normalizeParams(params);
      expect(result).toContain('my ssid with spaces');
    });
  });

  describe('hashParams', () => {
    it('should produce consistent hash for same params', () => {
      const params1 = { a: '1', b: '2' };
      const params2 = { b: '2', a: '1' };
      expect(hashParams(params1)).toBe(hashParams(params2));
    });

    it('should produce different hash for different params', () => {
      const params1 = { a: '1' };
      const params2 = { a: '2' };
      expect(hashParams(params1)).not.toBe(hashParams(params2));
    });
  });

  describe('hashRecord', () => {
    it('should hash a record consistently', () => {
      const record = { ssid: 'test', bssid: 'aa:bb:cc:dd:ee:ff' };
      const hash1 = hashRecord(record);
      const hash2 = hashRecord({ bssid: 'AA:BB:CC:DD:EE:FF', ssid: 'test' });
      expect(hash1).toBe(hash2);
    });

    it('should filter out empty/null values', () => {
      const hash1 = hashRecord({ a: '1', b: '' });
      const hash2 = hashRecord({ a: '1' });
      expect(hash1).toBe(hash2);
    });
  });
});
