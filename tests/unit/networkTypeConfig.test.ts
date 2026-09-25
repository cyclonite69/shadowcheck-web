describe('Network type utilities', () => {
  it('network type configuration is consistent', () => {
    const { NETWORK_TYPE_CONFIG } = require('../../client/src/constants/network');

    expect(NETWORK_TYPE_CONFIG).toBeDefined();
    expect(typeof NETWORK_TYPE_CONFIG === 'object').toBe(true);

    // Verify common network types are configured
    const types = Object.keys(NETWORK_TYPE_CONFIG);
    expect(types.length).toBeGreaterThan(0);
  });

  it('every network type has label and color configuration', () => {
    const { NETWORK_TYPE_CONFIG } = require('../../client/src/constants/network');

    Object.entries(NETWORK_TYPE_CONFIG).forEach(([_typeCode, config]: any) => {
      expect(config.label).toBeDefined();
      expect(typeof config.label).toBe('string');
      expect(config.label.length).toBeGreaterThan(0);
      expect(config.color).toBeDefined();
      expect(typeof config.color).toBe('string');
    });
  });

  it('supported network types match expected wireless standards', () => {
    const { NETWORK_TYPE_CONFIG } = require('../../client/src/constants/network');

    const expectedTypes = ['W', 'E', 'B', 'L', 'N', 'G'];
    expectedTypes.forEach((typeCode) => {
      expect(NETWORK_TYPE_CONFIG[typeCode]).toBeDefined();
    });
  });

  it('NETWORK_COLUMNS configuration is present and valid', () => {
    const { NETWORK_COLUMNS } = require('../../client/src/constants/network');

    expect(NETWORK_COLUMNS).toBeDefined();
    expect(typeof NETWORK_COLUMNS).toBe('object');

    // Verify select column exists
    expect(NETWORK_COLUMNS.select).toBeDefined();
    expect(NETWORK_COLUMNS.select.width).toBeGreaterThan(0);
    expect(NETWORK_COLUMNS.select.sortable).toBe(false);
  });

  it('THREAT_LEVEL_CONFIG defines all threat levels', () => {
    const { THREAT_LEVEL_CONFIG } = require('../../client/src/constants/network');

    expect(THREAT_LEVEL_CONFIG).toBeDefined();
    const levels = Object.keys(THREAT_LEVEL_CONFIG);
    expect(levels.length).toBeGreaterThan(0);
    levels.forEach((level) => {
      const config = THREAT_LEVEL_CONFIG[level];
      expect(config.label).toBeDefined();
      expect(config.color).toBeDefined();
    });
  });
});
