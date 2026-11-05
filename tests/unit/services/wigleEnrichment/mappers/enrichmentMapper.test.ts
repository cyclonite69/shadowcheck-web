import {
  mapCreditSnapshotToValidation,
  mapV3ApiDetailObservationRows,
  mapV3ApiDetailToNetworkDetail,
  mapV3LocationToObservationRow,
  normalizeMacAddress,
  parseWigleStatsCreditSnapshot,
  resolveObservationSsid,
} from '../../../../../server/src/services/wigleEnrichment/mappers/enrichmentMapper';

describe('enrichmentMapper', () => {
  describe('normalizeMacAddress', () => {
    it('uppercases BSSIDs and MAC addresses', () => {
      expect(normalizeMacAddress('aa:bb:cc:dd:ee:ff')).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('returns null for empty values', () => {
      expect(normalizeMacAddress('')).toBeNull();
      expect(normalizeMacAddress(undefined)).toBeNull();
    });
  });

  describe('mapV3LocationToObservationRow', () => {
    it('maps API location JSON into wigle_v3_observations shape with uppercase netid', () => {
      const row = mapV3LocationToObservationRow(
        'aa:bb:cc:dd:ee:ff',
        {
          latitude: '38.8977',
          longitude: '-77.0365',
          alt: '10',
          accuracy: '5',
          signal: '-62',
          time: '2026-01-01T00:00:00Z',
          lastupdt: '2026-01-02T00:00:00Z',
          frequency: '2437',
          channel: '6',
          encryptionValue: 'wpa2',
          noise: '-95',
          snr: '33',
          month: '2026-01',
        },
        { clusterSsid: 'ClusterSSID' }
      );

      expect(row).toEqual({
        netid: 'AA:BB:CC:DD:EE:FF',
        latitude: 38.8977,
        longitude: -77.0365,
        altitude: 10,
        accuracy: 5,
        signal: -62,
        observed_at: '2026-01-01T00:00:00Z',
        last_update: '2026-01-02T00:00:00Z',
        ssid: 'ClusterSSID',
        frequency: 2437,
        channel: 6,
        encryption: 'wpa2',
        noise: -95,
        snr: 33,
        month: '2026-01',
      });
    });
  });

  describe('resolveObservationSsid', () => {
    it('prefers a non-placeholder location ssid over cluster fallback', () => {
      expect(resolveObservationSsid({ ssid: 'DirectSSID' }, { clusterSsid: 'ClusterSSID' })).toBe(
        'DirectSSID'
      );
    });

    it('falls back to cluster ssid when location ssid is placeholder', () => {
      expect(resolveObservationSsid({ ssid: '?' }, { clusterSsid: 'ClusterSSID' })).toBe(
        'ClusterSSID'
      );
    });
  });

  describe('mapV3ApiDetailObservationRows', () => {
    it('flattens location clusters into observation rows', () => {
      const rows = mapV3ApiDetailObservationRows('aa:bb:cc:dd:ee:ff', [
        {
          clusterSsid: 'NetSSID',
          locations: [{ latitude: '1', longitude: '2', time: '2026-01-01T00:00:00Z' }],
        },
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].netid).toBe('AA:BB:CC:DD:EE:FF');
      expect(rows[0].ssid).toBe('NetSSID');
    });
  });

  describe('mapV3ApiDetailToNetworkDetail', () => {
    it('maps detail API JSON with uppercase netid', () => {
      const row = mapV3ApiDetailToNetworkDetail({
        networkId: 'aa:bb:cc:dd:ee:ff',
        name: 'TestNet',
        type: 'wifi',
        trilateratedLatitude: 38.1,
        trilateratedLongitude: -77.1,
        locationClusters: [{ clusterSsid: 'SSID1' }],
      });

      expect(row.netid).toBe('AA:BB:CC:DD:EE:FF');
      expect(row.ssid).toBe('SSID1');
      expect(row.name).toBe('TestNet');
    });

    it('strips null bytes deeply from nested locationClusters and streetAddress JSON strings', () => {
      const row = mapV3ApiDetailToNetworkDetail({
        networkId: '2c:ab:33:41:e9:a6',
        name: 'Apple\u0000Device',
        type: 'bt',
        locationClusters: [
          {
            clusterSsid: 'BLE\u0000Tag\u0000',
            locations: [
              {
                latitude: '43.01',
                longitude: '-83.68',
                ssid: 'Inner\u0000Name',
                comment: 'Null\u0000Payload',
              },
            ],
          },
        ],
        streetAddress: {
          city: 'Flint\u0000',
          road: 'S\u0000Saginaw\u0000St',
          country: 'United\u0000States',
        },
      });

      // Assert row scalars are sanitized
      expect(row.name).toBe('AppleDevice');
      expect(row.ssid).toBe('BLETag');

      // Assert JSON strings do not contain \u0000
      expect(row.location_clusters).not.toContain('\u0000');
      expect(row.street_address).not.toContain('\u0000');

      // Parse JSON to verify structure and content
      const parsedClusters = JSON.parse(row.location_clusters);
      expect(parsedClusters[0].clusterSsid).toBe('BLETag');
      expect(parsedClusters[0].locations[0].ssid).toBe('InnerName');
      expect(parsedClusters[0].locations[0].comment).toBe('NullPayload');

      const parsedAddress = JSON.parse(row.street_address);
      expect(parsedAddress).toEqual({
        city: 'Flint',
        road: 'SSaginawSt',
        country: 'UnitedStates',
      });
    });

    it('preserves ordinary legitimate strings in locationClusters and streetAddress without alteration', () => {
      const clusters = [
        {
          clusterSsid: 'ValidSSID-123',
          locations: [
            {
              latitude: 42.5,
              longitude: -83.2,
              ssid: 'ValidSSID-123',
            },
          ],
        },
      ];
      const address = {
        city: 'Detroit',
        region: 'Michigan',
        road: 'Woodward Ave',
        country: 'United States',
      };

      const row = mapV3ApiDetailToNetworkDetail({
        networkId: '00:11:22:33:44:55',
        name: 'LegitimateNet',
        locationClusters: clusters,
        streetAddress: address,
      });

      expect(JSON.parse(row.location_clusters)).toEqual(clusters);
      expect(JSON.parse(row.street_address)).toEqual(address);
    });

    it('handles null/undefined streetAddress and missing locationClusters gracefully', () => {
      const row = mapV3ApiDetailToNetworkDetail({
        networkId: '00:11:22:33:44:55',
        name: 'EmptyNet',
      });

      expect(row.street_address).toBe('null');
      expect(row.location_clusters).toBe('[]');
    });
  });

  describe('parseWigleStatsCreditSnapshot', () => {
    it('reads estimatedApiQuotaRemaining from stats JSON', () => {
      expect(parseWigleStatsCreditSnapshot({ estimatedApiQuotaRemaining: 42 })).toEqual({
        remaining: 42,
      });
    });
  });

  describe('mapCreditSnapshotToValidation', () => {
    it('returns no credit when remaining is zero', () => {
      expect(mapCreditSnapshotToValidation({ remaining: 0 })).toEqual({
        hasCredit: false,
        message: 'No API credit remaining (0 requests)',
      });
    });

    it('returns available credit message when quota remains', () => {
      expect(mapCreditSnapshotToValidation({ remaining: 12 })).toEqual({
        hasCredit: true,
        message: '12 requests available',
      });
    });
  });
});
