/**
 * Unit tests for KML export service
 */

const { generateKML } = require('../../server/src/services/exportService');

describe('KML Generation Service', () => {
  describe('generateKML', () => {
    it('should generate valid KML for empty observations', () => {
      const kml = generateKML([]);
      expect(kml).toContain('<?xml version="1.0"');
      expect(kml).toContain('<kml');
      expect(kml).toContain('No Data');
    });

    it('should generate valid KML structure', () => {
      const observations = [
        {
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'TestNetwork',
          lat: 40.7128,
          lon: -74.006,
          signal_dbm: -50,
          observed_at: '2024-01-01T12:00:00Z',
          radio_type: 'WiFi',
          frequency: 2400,
          capabilities: 'WPA2',
          accuracy: 10,
          altitude: 100,
        },
      ];

      const kml = generateKML(observations);

      expect(kml).toContain('<?xml version="1.0"');
      expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
      expect(kml).toContain('<Document>');
      expect(kml).toContain('<Folder>');
      expect(kml).toContain('<Placemark>');
      expect(kml).toContain('TestNetwork');
      expect(kml).toContain('AA:BB:CC:DD:EE:FF');
      expect(kml).toContain('-74.006,40.7128,100');
      expect(kml).toContain('</kml>');
    });

    it('should include signal strength in placemark description', () => {
      const observations = [
        {
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'TestNetwork',
          lat: 40.7128,
          lon: -74.006,
          signal_dbm: -50,
          observed_at: '2024-01-01T12:00:00Z',
          radio_type: 'WiFi',
          frequency: 2400,
          capabilities: 'WPA2',
          accuracy: 10,
          altitude: 100,
        },
      ];

      const kml = generateKML(observations);
      expect(kml).toContain('Signal: -50dBm');
    });

    it('should escape XML special characters', () => {
      const observations = [
        {
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'Test & Network <>"\'',
          lat: 40.7128,
          lon: -74.006,
          signal_dbm: -50,
          observed_at: '2024-01-01T12:00:00Z',
          radio_type: 'WiFi',
          frequency: 2400,
          capabilities: 'WPA2',
          accuracy: 10,
          altitude: 100,
        },
      ];

      const kml = generateKML(observations);
      expect(kml).toContain('Test &amp; Network &lt;&gt;&quot;&apos;');
      expect(kml).not.toContain('<Test & Network');
    });

    it('should handle observations without altitude', () => {
      const observations = [
        {
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'TestNetwork',
          lat: 40.7128,
          lon: -74.006,
          signal_dbm: -50,
          observed_at: '2024-01-01T12:00:00Z',
          radio_type: 'WiFi',
          frequency: 2400,
          capabilities: 'WPA2',
          accuracy: 10,
          altitude: null,
        },
      ];

      const kml = generateKML(observations);
      expect(kml).toContain('-74.006,40.7128');
      // Should not have trailing comma
      const coords = kml.match(/<coordinates>([^<]+)<\/coordinates>/);
      expect(coords).toBeTruthy();
      if (coords) {
        expect(coords[1]).toMatch(/^-74\.006,40\.7128$/);
      }
    });

    it('should group multiple observations by BSSID', () => {
      const observations = [
        {
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'Network1',
          lat: 40.7128,
          lon: -74.006,
          signal_dbm: -50,
          observed_at: '2024-01-01T12:00:00Z',
          radio_type: 'WiFi',
          frequency: 2400,
          capabilities: 'WPA2',
          accuracy: 10,
          altitude: 100,
        },
        {
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'Network1',
          lat: 40.72,
          lon: -74.01,
          signal_dbm: -55,
          observed_at: '2024-01-01T13:00:00Z',
          radio_type: 'WiFi',
          frequency: 2400,
          capabilities: 'WPA2',
          accuracy: 8,
          altitude: 110,
        },
      ];

      const kml = generateKML(observations);
      // Should have 1 folder per unique BSSID
      const folderCount = (kml.match(/<Folder>/g) || []).length;
      expect(folderCount).toBe(1);
      // Should have placemarks (1 main + 1 observation)
      const placemarksCount = (kml.match(/<Placemark>/g) || []).length;
      expect(placemarksCount).toBe(2);
      expect(kml).toContain('Observations: 2');
    });

    it('should include observation count in folder', () => {
      const observations = [
        {
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'Network1',
          lat: 40.7128,
          lon: -74.006,
          signal_dbm: -50,
          observed_at: '2024-01-01T12:00:00Z',
          radio_type: 'WiFi',
          frequency: 2400,
          capabilities: 'WPA2',
          accuracy: 10,
          altitude: 100,
        },
      ];

      const kml = generateKML(observations);
      expect(kml).toContain('Observations: 1');
    });

    it('should handle multiple networks', () => {
      const observations = [
        {
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'Network1',
          lat: 40.7128,
          lon: -74.006,
          signal_dbm: -50,
          observed_at: '2024-01-01T12:00:00Z',
          radio_type: 'WiFi',
          frequency: 2400,
          capabilities: 'WPA2',
          accuracy: 10,
          altitude: 100,
        },
        {
          bssid: '11:22:33:44:55:66',
          ssid: 'Network2',
          lat: 40.758,
          lon: -73.9855,
          signal_dbm: -65,
          observed_at: '2024-01-01T13:00:00Z',
          radio_type: 'WiFi',
          frequency: 5000,
          capabilities: 'WPA3',
          accuracy: 8,
          altitude: 150,
        },
      ];

      const kml = generateKML(observations);
      expect(kml).toContain('2 Network(s)');
      expect(kml).toContain('Network1');
      expect(kml).toContain('Network2');
      const folderCount = (kml.match(/<Folder>/g) || []).length;
      expect(folderCount).toBe(2);
    });

    it('should include time information in placemarks', () => {
      const observations = [
        {
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'TestNetwork',
          lat: 40.7128,
          lon: -74.006,
          signal_dbm: -50,
          observed_at: new Date('2024-01-01T12:00:00Z').toISOString(),
          radio_type: 'WiFi',
          frequency: 2400,
          capabilities: 'WPA2',
          accuracy: 10,
          altitude: 100,
        },
      ];

      const kml = generateKML(observations);
      expect(kml).toContain('Last Seen: 2024-01-01');
      expect(kml).toContain('First Seen: 2024-01-01');
    });
  });
});
