import {
  bulkUpsertDetections,
  getEnrichedCandidates,
  ScoredDetectionType,
} from '../../../server/src/repositories/surveillanceDetectionRepository';

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim();

describe('surveillanceDetectionRepository characterization', () => {
  describe('getEnrichedCandidates', () => {
    const tierLabels = [
      'High-confidence WiFi OUI',
      'SSID exact: test_flck dev SSID',
      'SSID pattern: canonical Flock-[hex6]',
      'Medium-confidence OUI (Liteon/USI contract manufacturers)',
      'BLE manufacturer ID 0x09C8 (XUNTONG — Flock/Raven)',
      'BLE device name patterns (no mfgrid hit)',
      'ShotSpotter OUI match',
      'ShotSpotter SSID pattern',
      'Axon body camera OUI match (WiFi + BLE)',
      'Motorola body-worn camera OUI match',
      'Axon BLE manufacturer ID 0x034D',
      'Axon Signal BLE name patterns (^axon, ^taser, ^signal)',
      'Body-worn camera officer assignment SSID: X_[initial][surname]',
      'Axon body cam BLE service UUID 0xFFA1 (confirmed from captured devices).',
      'Axon body cam CoD fingerprint: 0x1F00 (Uncategorized, no service class).',
      'Bluetooth imaging device: CoD major class 0x06 (Imaging), minor 0x20 (Camera).',
      'Unknown vendor body cam SSID pattern: DEI-[digits]',
      'DEI- body cam service UUID (confirmed exclusive to DEI- devices in dataset).',
      'Dashcam SSID patterns. These remain surveillance-relevant but are',
      'Residential/consumer camera OUI match. Manufacturer reference',
    ];

    test('preserves the tier sequence and enriched candidate SQL contract', async () => {
      const rows = [{ bssid: 'AA:BB:CC:DD:EE:FF' }];
      const adminQuery = jest.fn().mockResolvedValue({ rows });

      const result = await getEnrichedCandidates(adminQuery);

      expect(result).toBe(rows);
      expect(adminQuery).toHaveBeenCalledTimes(1);

      const [sql, params] = adminQuery.mock.calls[0];
      const normalized = normalizeSql(sql);
      const tiers: RegExpMatchArray[] = [...sql.matchAll(/--\s+(\d+)\.\s+([^\n]+)/g)];

      expect(params).toBeUndefined();
      expect(tiers.map((match) => Number(match[1]))).toEqual(
        Array.from({ length: 20 }, (_, index) => index + 1)
      );
      expect(tiers.map((match) => match[2].trim())).toEqual(tierLabels);

      expect(normalized).toMatch(/^WITH candidates AS \(/);
      expect(normalized).toContain('), obs_stats AS (');
      expect(normalized).toContain('WHERE o.bssid IN (SELECT DISTINCT bssid FROM candidates)');
      expect(normalized).toContain(
        'AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)'
      );
      expect(normalized).toContain('COUNT(*) OVER (PARTITION BY c.bssid)::int AS tier_hit_count');
      expect(normalized).toContain('LEFT JOIN obs_stats os ON os.bssid = c.bssid');
      expect(normalized).toContain('ORDER BY c.bssid, c.priority ASC, c.base_likelihood DESC');
    });

    test('propagates query errors', async () => {
      const error = new Error('candidate query failed');
      const adminQuery = jest.fn().mockRejectedValue(error);

      await expect(getEnrichedCandidates(adminQuery)).rejects.toBe(error);
    });
  });

  describe('bulkUpsertDetections', () => {
    const detections: ScoredDetectionType[] = [
      {
        bssid: 'AA:BB:CC:DD:EE:01',
        device_type: 'FLOCK_SAFETY_CAMERA',
        confidence: 0.85,
        threat_score: 75,
        detection_method: 'oui_match',
        matched_signals: { oui: 'AA:BB:CC' },
        false_positive: false,
        fp_reason: null,
      },
      {
        bssid: 'AA:BB:CC:DD:EE:02',
        device_type: 'AXON_BODY_CAMERA',
        confidence: 0.92,
        threat_score: 88,
        detection_method: 'uuid_match',
        matched_signals: { service_uuid: '0000ffa1-0000-1000-8000-00805f9b34fb' },
        false_positive: true,
        fp_reason: 'operator review',
      },
    ];

    test('returns zero without querying for empty input', async () => {
      const adminQuery = jest.fn();

      await expect(bulkUpsertDetections(adminQuery, [])).resolves.toBe(0);
      expect(adminQuery).not.toHaveBeenCalled();
    });

    test('preserves parameter mapping, conflict handling, and the false-positive guard', async () => {
      const adminQuery = jest.fn().mockResolvedValue({ rowCount: 2 });

      await expect(bulkUpsertDetections(adminQuery, detections)).resolves.toBe(2);
      expect(adminQuery).toHaveBeenCalledTimes(1);

      const [sql, params] = adminQuery.mock.calls[0];
      const normalized = normalizeSql(sql);

      expect(params).toEqual([
        ['AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:02'],
        ['FLOCK_SAFETY_CAMERA', 'AXON_BODY_CAMERA'],
        [0.85, 0.92],
        [75, 88],
        ['oui_match', 'uuid_match'],
        [
          JSON.stringify({ oui: 'AA:BB:CC' }),
          JSON.stringify({ service_uuid: '0000ffa1-0000-1000-8000-00805f9b34fb' }),
        ],
        [false, true],
        [null, 'operator review'],
      ]);
      expect(normalized).toContain(
        '$1::text[], $2::text[], $3::numeric[], $4::numeric[], $5::text[], $6::jsonb[], $7::boolean[], $8::text[]'
      );
      expect(normalized).toContain('ON CONFLICT (bssid) DO UPDATE SET');
      expect(normalized).toContain(
        'WHERE app.surveillance_detections.false_positive = FALSE OR EXCLUDED.false_positive = TRUE'
      );
      expect(normalized).toContain('RETURNING bssid');
    });

    test.each([null, undefined])('falls back to zero when rowCount is %s', async (rowCount) => {
      const adminQuery = jest.fn().mockResolvedValue({ rowCount });

      await expect(bulkUpsertDetections(adminQuery, detections)).resolves.toBe(0);
    });

    test('propagates query errors', async () => {
      const error = new Error('upsert failed');
      const adminQuery = jest.fn().mockRejectedValue(error);

      await expect(bulkUpsertDetections(adminQuery, detections)).rejects.toBe(error);
    });
  });
});
