import { normalizeTooltipData } from '../geospatial/tooltipDataNormalizer';
import { renderNetworkTooltip } from '../geospatial/renderNetworkTooltip';

describe('tooltipDataNormalizer', () => {
  it('normalizes signal aliases used by geospatial payloads', () => {
    expect(normalizeTooltipData({ signalDbm: -61 }).signal).toBe(-61);
    expect(normalizeTooltipData({ maxSignal: -67 }).signal).toBe(-67);
    expect(normalizeTooltipData({ max_signal: -72 }).signal).toBe(-72);
    expect(normalizeTooltipData({ bestlevel: -58 }).signal).toBe(-58);
  });

  it('renders signal strength from alias fields when signal is absent', () => {
    const html = renderNetworkTooltip({
      ssid: 'Test',
      bssid: 'AA:BB:CC:DD:EE:FF',
      signalDbm: -64,
    });

    expect(html).toContain('-64 dBm');
  });

  it('normalizes threat_factors from JSONB payload', () => {
    const factors = { high_power: 15.5, suspicious_manufacturer: true };
    const normalized = normalizeTooltipData({ threat_factors: factors });
    expect(normalized.threat_factors).toEqual(factors);
  });

  it('renders STINGRAY tech with Magenta color and threat factors', () => {
    const html = renderNetworkTooltip({
      ssid: 'Unknown',
      bssid: 'DE:AD:BE:EF:00:01',
      capabilities: 'STINGRAY;310410',
      threat_factors: { high_power: 12.0, proximity: 5.2 },
    });

    expect(html).toContain('border:2px solid #FF00FF');
    expect(html).toContain('Stingray');
    expect(html).toContain('Threat Factors');
    expect(html).toContain('HIGH POWER');
    expect(html).toContain('12.0');
  });
});
