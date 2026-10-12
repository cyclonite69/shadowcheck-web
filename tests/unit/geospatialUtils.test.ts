describe('Geospatial utilities', () => {
  it('loads geospatial utilities without errors', () => {
    const {
      renderNetworkTooltip,
    } = require('../../client/src/utils/geospatial/renderNetworkTooltip');
    expect(typeof renderNetworkTooltip).toBe('function');
  });

  it('renderNetworkTooltip handles missing values gracefully', () => {
    const {
      renderNetworkTooltip,
    } = require('../../client/src/utils/geospatial/renderNetworkTooltip');

    const testProps = {
      bssid: 'AA:BB:CC:DD:EE:FF',
      ssid: 'TestNet',
      level: -58,
      lon: -83.697534,
      lat: 43.022067,
      type: 'W',
    };

    const result = renderNetworkTooltip(testProps);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('renderNetworkTooltip includes key fields when present', () => {
    const {
      renderNetworkTooltip,
    } = require('../../client/src/utils/geospatial/renderNetworkTooltip');

    const testProps = {
      bssid: 'AA:BB:CC:DD:EE:FF',
      ssid: 'TestNet',
      level: -58,
      lon: -83.697534,
      lat: 43.022067,
      type: 'W',
      threat_score: 85,
      threat_level: 'HIGH',
    };

    const result = renderNetworkTooltip(testProps);
    expect(result).toContain('TestNet');
    expect(result).toContain('AA:BB:CC:DD:EE:FF');
  });

  it('escapes MVT-derived text while preserving network tooltip markup', () => {
    const {
      renderNetworkTooltip,
    } = require('../../client/src/utils/geospatial/renderNetworkTooltip');
    const result = renderNetworkTooltip({
      bssid: 'AA:BB:CC:DD:EE:FF" onmouseover="alert(1)',
      ssid: '<img src=x onerror=alert(1)> & "network"',
      comment: "<script>alert('x')</script>",
      type: 'W',
    });

    expect(result).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;network&quot;');
    expect(result).toContain('&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;');
    expect(result).not.toContain('<img src=x');
    expect(result).not.toContain('<script>');
    expect(result).toContain('<div style=');
  });
});
