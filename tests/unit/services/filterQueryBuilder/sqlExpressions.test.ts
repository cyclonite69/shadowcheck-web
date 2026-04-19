import {
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
} from '../../../../server/src/services/filterQueryBuilder/sqlExpressions';

describe('sqlExpressions', () => {
  describe('normalizeRadioTypes', () => {
    it('returns empty array if input is not an array', () => {
      expect(normalizeRadioTypes(null)).toEqual([]);
      expect(normalizeRadioTypes('W')).toEqual([]);
      expect(normalizeRadioTypes(123)).toEqual([]);
      expect(normalizeRadioTypes(undefined)).toEqual([]);
    });

    it('normalizes known aliases', () => {
      expect(normalizeRadioTypes(['WIFI', 'BLE', 'LTE'])).toEqual(['W', 'E', 'L']);
      expect(normalizeRadioTypes(['wi-fi', 'bluetooth', 'gsm', 'nr'])).toEqual(['W', 'B', 'G', 'N']);
      expect(normalizeRadioTypes(['cdma', 'dect', 'fm', 'unknown'])).toEqual(['C', 'D', 'F', '?']);
    });

    it('deduplicates results', () => {
      expect(normalizeRadioTypes(['W', 'WIFI', 'wi-fi'])).toEqual(['W']);
    });

    it('ignores unknown values and nullish values', () => {
      expect(normalizeRadioTypes(['W', null, undefined, '', 'INVALID'])).toEqual(['W']);
    });
    
    it('normalizes base types correctly', () => {
      expect(normalizeRadioTypes(['W', 'B', 'E', 'L', 'N', 'G', 'C', 'D', 'F', '?'])).toEqual(['W', 'B', 'E', 'L', 'N', 'G', 'C', 'D', 'F', '?']);
    });
  });

  describe('isAllRadioTypesSelection', () => {
    it('returns true if all supported types are selected', () => {
      expect(isAllRadioTypesSelection([...SUPPORTED_RADIO_TYPES])).toBe(true);
    });

    it('returns false if any supported type is missing', () => {
      const subset = [...SUPPORTED_RADIO_TYPES];
      subset.pop(); // Remove last element
      expect(isAllRadioTypesSelection(subset)).toBe(false);
    });
  });

  describe('OBS_TYPE_EXPR', () => {
    it('returns valid SQL expression with default alias', () => {
      const expr = OBS_TYPE_EXPR();
      expect(expr).toContain('o.radio_type');
      expect(expr).toContain('o.radio_frequency');
      expect(expr).toContain('o.radio_capabilities');
    });

    it('returns valid SQL expression with custom alias', () => {
      const expr = OBS_TYPE_EXPR('x');
      expect(expr).toContain('x.radio_type');
      expect(expr).toContain('x.radio_frequency');
      expect(expr).toContain('x.radio_capabilities');
    });
  });

  describe('SECURITY_FROM_CAPS_EXPR', () => {
    it('returns valid SQL expression wrapping the caps expression', () => {
      const expr = SECURITY_FROM_CAPS_EXPR('my_caps_column');
      expect(expr).toContain('my_caps_column');
      expect(expr).toContain("THEN 'OPEN'");
      expect(expr).toContain("THEN 'WPA3'");
      expect(expr).toContain("THEN 'WPA2'");
      expect(expr).toContain("THEN 'WEP'");
      expect(expr).toContain("ELSE 'UNKNOWN'");
    });
  });

  describe('SECURITY_EXPR', () => {
    it('returns valid SQL expression for security using default alias', () => {
      const expr = SECURITY_EXPR();
      expect(expr).toContain('o.radio_capabilities');
      expect(expr).toContain("THEN 'OPEN'");
    });

    it('returns valid SQL expression for security using custom alias', () => {
      const expr = SECURITY_EXPR('myAlias');
      expect(expr).toContain('myAlias.radio_capabilities');
    });
  });

  describe('AUTH_EXPR', () => {
    it('returns valid SQL expression for auth using default alias', () => {
      const expr = AUTH_EXPR();
      expect(expr).toContain('o.radio_capabilities');
      expect(expr).toContain("THEN 'Enterprise'");
      expect(expr).toContain("THEN 'SAE'");
      expect(expr).toContain("THEN 'OWE'");
      expect(expr).toContain("THEN 'PSK'");
      expect(expr).toContain("THEN 'None'");
    });

    it('returns valid SQL expression for auth using custom alias', () => {
      const expr = AUTH_EXPR('myAlias');
      expect(expr).toContain('myAlias.radio_capabilities');
    });
  });

  describe('WIFI_CHANNEL_EXPR', () => {
    it('returns valid SQL expression using default alias', () => {
      const expr = WIFI_CHANNEL_EXPR();
      expect(expr).toContain('o.radio_frequency');
      expect(expr).toContain('BETWEEN 2412 AND 2484');
      expect(expr).toContain('BETWEEN 5000 AND 5900');
      expect(expr).toContain('BETWEEN 5925 AND 7125');
    });

    it('returns valid SQL expression using custom alias', () => {
      const expr = WIFI_CHANNEL_EXPR('x');
      expect(expr).toContain('x.radio_frequency');
    });
  });

  describe('NETWORK_CHANNEL_EXPR', () => {
    it('returns valid SQL expression using default alias', () => {
      const expr = NETWORK_CHANNEL_EXPR();
      expect(expr).toContain('ne.frequency');
      expect(expr).toContain('BETWEEN 2412 AND 2484');
    });

    it('returns valid SQL expression using custom alias', () => {
      const expr = NETWORK_CHANNEL_EXPR('net');
      expect(expr).toContain('net.frequency');
    });
  });

  describe('THREAT_SCORE_EXPR', () => {
    it('returns valid SQL expression using default aliases', () => {
      const expr = THREAT_SCORE_EXPR();
      expect(expr).toContain('nts.rule_based_score');
      expect(expr).toContain('nts.ml_threat_score');
      expect(expr).toContain('nt.threat_tag');
      expect(expr).toContain('nt.threat_confidence');
      expect(expr).toContain('app.get_threat_score');
    });

    it('returns valid SQL expression using custom aliases', () => {
      const expr = THREAT_SCORE_EXPR('x', 'y');
      expect(expr).toContain('x.rule_based_score');
      expect(expr).toContain('y.threat_tag');
    });
  });

  describe('THREAT_LEVEL_EXPR', () => {
    it('returns valid SQL expression using default aliases', () => {
      const expr = THREAT_LEVEL_EXPR();
      expect(expr).toContain("nt.threat_tag = 'FALSE_POSITIVE' THEN 'NONE'");
      expect(expr).toContain("nt.threat_tag = 'INVESTIGATE' THEN COALESCE(nts.final_threat_level, 'NONE')");
      expect(expr).toContain('>= 80 THEN \'CRITICAL\'');
      expect(expr).toContain('>= 60 THEN \'HIGH\'');
      expect(expr).toContain('>= 40 THEN \'MED\'');
      expect(expr).toContain('>= 20 THEN \'LOW\'');
    });

    it('returns valid SQL expression using custom aliases', () => {
      const expr = THREAT_LEVEL_EXPR('a', 'b');
      expect(expr).toContain("b.threat_tag = 'FALSE_POSITIVE' THEN 'NONE'");
      expect(expr).toContain('a.final_threat_level');
    });
  });
});