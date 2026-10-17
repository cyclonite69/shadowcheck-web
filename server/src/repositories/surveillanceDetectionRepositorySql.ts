interface DetectionUpsertInput {
  bssid: string;
  device_type: string;
  confidence: number;
  threat_score: number;
  detection_method: string;
  matched_signals: Record<string, any>;
  false_positive: boolean;
  fp_reason: string | null;
}

export type BulkUpsertDetectionParams = [
  bssids: string[],
  deviceTypes: string[],
  confidences: number[],
  threatScores: number[],
  methods: string[],
  signals: string[],
  falsePositives: boolean[],
  falsePositiveReasons: Array<string | null>,
];

/** SQL contract for the ordered surveillance-candidate tier query. */
export const ENRICHED_CANDIDATES_SQL = `
    WITH candidates AS (

      -- 1. High-confidence WiFi OUI
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        odg.surveillance_type AS device_type,
        CASE WHEN n.ssid ~ '^Flock-[0-9A-Fa-f]{6}$' THEN 90
             WHEN LEFT(n.bssid, 8) = 'B4:1E:52' THEN 85
             ELSE 80
        END AS base_likelihood,
        CASE WHEN n.ssid ~ '^Flock-[0-9A-Fa-f]{6}$' THEN 'EXACT'
             ELSE 'PARTIAL'
        END AS match_quality,
        CASE WHEN n.ssid ~ '^Flock-[0-9A-Fa-f]{6}$' THEN 'multi_signal'
             ELSE 'oui_match'
        END AS detection_method,
        jsonb_build_object('oui', LEFT(n.bssid, 8), 'ssid', n.ssid, 'tier', 'HIGH') AS matched_signals,
        1 AS priority
      FROM app.networks n
      JOIN app.oui_device_groups odg ON LEFT(n.bssid, 8) = odg.oui
      WHERE n.type = 'W'
        AND odg.surveillance_type IN ('FLOCK_SAFETY_CAMERA', 'FS_EXT_BATTERY')
        AND odg.surveillance_confidence = 'HIGH'

      UNION ALL

      -- 2. SSID exact: test_flck dev SSID
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'FLOCK_SAFETY_CAMERA', 90, 'EXACT', 'ssid_exact',
        jsonb_build_object('ssid', n.ssid, 'cve', 'CVE-2025-59409'), 2
      FROM app.networks n
      WHERE n.type = 'W' AND n.ssid = 'test_flck'
        AND NOT EXISTS (
          SELECT 1 FROM app.oui_device_groups odg
          WHERE odg.oui = LEFT(n.bssid, 8)
            AND odg.surveillance_type IN ('FLOCK_SAFETY_CAMERA', 'FS_EXT_BATTERY')
            AND odg.surveillance_confidence = 'HIGH'
        )

      UNION ALL

      -- 3. SSID pattern: canonical Flock-[hex6]
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'FLOCK_SAFETY_CAMERA', 85, 'STRONG', 'ssid_pattern',
        jsonb_build_object('ssid', n.ssid, 'pattern', 'Flock-[0-9A-Fa-f]{6}'), 3
      FROM app.networks n
      WHERE n.type = 'W' AND n.ssid ~ '^Flock-[0-9A-Fa-f]{6}$'
        AND NOT EXISTS (
          SELECT 1 FROM app.oui_device_groups odg
          WHERE odg.oui = LEFT(n.bssid, 8)
            AND odg.surveillance_type IN ('FLOCK_SAFETY_CAMERA', 'FS_EXT_BATTERY')
            AND odg.surveillance_confidence = 'HIGH'
        )

      UNION ALL

      -- 4. Medium-confidence OUI (Liteon/USI contract manufacturers)
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'FLOCK_SAFETY_CAMERA', 50, 'WEAK', 'oui_match',
        jsonb_build_object('oui', LEFT(n.bssid, 8), 'tier', 'MEDIUM', 'vendor', 'contract_mfr'), 4
      FROM app.networks n
      JOIN app.oui_device_groups odg ON LEFT(n.bssid, 8) = odg.oui
      WHERE n.type = 'W'
        AND odg.surveillance_type = 'FLOCK_SAFETY_CAMERA'
        AND odg.surveillance_confidence = 'MEDIUM'

      UNION ALL

      -- 5. BLE manufacturer ID 0x09C8 (XUNTONG — Flock/Raven)
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        CASE WHEN n.ssid ~* '^raven' THEN 'RAVEN_GUNSHOT_DETECTOR'
             WHEN n.ssid ~* '^fs ext battery' THEN 'FS_EXT_BATTERY'
             ELSE 'FLOCK_SAFETY_CAMERA'
        END,
        80, 'STRONG', 'mfgrid_match',
        jsonb_build_object('mfgrid', n.mfgrid, 'mfgrid_hex', '0x09C8', 'ssid', n.ssid), 5
      FROM app.networks n
      WHERE n.type IN ('E', 'B') AND n.mfgrid = 2504

      UNION ALL

      -- 6. BLE device name patterns (no mfgrid hit)
      -- NOTE: Pigvision BLE pattern recognition is deferred pending a schema migration
      -- to add PIGVISION_SYSTEM to app.surveillance_detections(chk_surveillance_device_type).
      -- Pigvision must not be misattributed as FLOCK_SAFETY_CAMERA.
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        CASE WHEN n.ssid ~* '^raven' THEN 'RAVEN_GUNSHOT_DETECTOR'
             WHEN n.ssid ~* '^fs ext battery' THEN 'FS_EXT_BATTERY'
             ELSE 'FLOCK_SAFETY_CAMERA'
        END,
        70, 'PARTIAL', 'ble_name_pattern',
        jsonb_build_object('ssid', n.ssid, 'type', n.type), 6
      FROM app.networks n
      WHERE n.type IN ('E', 'B')
        AND n.ssid ~* '^(fs ext battery|flock|falcon|raven|sparrow|condor|penguin)'
        AND (n.mfgrid IS NULL OR n.mfgrid != 2504)

      UNION ALL

      -- 7. ShotSpotter OUI match
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'SHOTSPOTTER_SENSOR', 85, 'STRONG', 'oui_match',
        jsonb_build_object('oui', LEFT(n.bssid, 8), 'vendor', 'ShotSpotter Inc. / SoundThinking'), 7
      FROM app.networks n
      JOIN app.oui_device_groups odg ON LEFT(n.bssid, 8) = odg.oui
      WHERE n.type = 'W'
        AND odg.surveillance_type = 'SHOTSPOTTER_SENSOR'
        AND odg.surveillance_confidence = 'HIGH'

      UNION ALL

      -- 8. ShotSpotter SSID pattern
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'SHOTSPOTTER_SENSOR', 80, 'PARTIAL', 'ssid_pattern',
        jsonb_build_object('ssid', n.ssid, 'pattern', 'SoundThinking|ShotSpotter|SST-|SENSOR-|SNS-|acoustic'), 8
      FROM app.networks n
      WHERE n.type = 'W'
        AND (n.ssid ~* '^(SoundThinking|ShotSpotter|SST-|SENSOR-|SNS-|acoustic)'
             OR n.ssid ~ '^[A-Z]{2,4}-\\d{4,6}$')
        AND NOT EXISTS (
          SELECT 1 FROM app.oui_device_groups odg
          WHERE odg.oui = LEFT(n.bssid, 8)
            AND odg.surveillance_type = 'SHOTSPOTTER_SENSOR'
            AND odg.surveillance_confidence = 'HIGH'
        )

      UNION ALL

      -- 9. Axon body camera OUI match (WiFi + BLE)
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'AXON_BODY_CAMERA', 75, 'STRONG', 'oui_match',
        jsonb_build_object('oui', LEFT(n.bssid, 8), 'vendor', 'Axon Enterprise'), 9
      FROM app.networks n
      JOIN app.oui_device_groups odg ON LEFT(n.bssid, 8) = odg.oui
      WHERE odg.surveillance_type = 'AXON_BODY_CAMERA'
        AND odg.surveillance_confidence = 'HIGH'
        AND LEFT(n.bssid, 8) NOT IN ('70:F7:54', 'B8:13:32', '54:78:C9', '08:FB:EA')
        AND (n.mfgrid IS NULL OR n.mfgrid != 845)

      UNION ALL

      -- 10. Motorola body-worn camera OUI match
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'MOTOROLA_BWC', 75, 'STRONG', 'oui_match',
        jsonb_build_object('oui', LEFT(n.bssid, 8), 'vendor', 'Motorola Solutions'), 10
      FROM app.networks n
      JOIN app.oui_device_groups odg ON LEFT(n.bssid, 8) = odg.oui
      WHERE odg.surveillance_type = 'MOTOROLA_BWC'
        AND odg.surveillance_confidence = 'HIGH'

      UNION ALL

      -- 11. Axon BLE manufacturer ID 0x034D
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'AXON_SIGNAL_PERIPHERAL', 80, 'STRONG', 'mfgrid_match',
        jsonb_build_object('mfgrid', n.mfgrid, 'mfgrid_hex', '0x034D', 'ssid', n.ssid), 11
      FROM app.networks n
      WHERE n.type IN ('E', 'B')
        AND n.mfgrid = 845

      UNION ALL

      -- 12. Axon Signal BLE name patterns (^axon, ^taser, ^signal)
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'AXON_SIGNAL_PERIPHERAL', 80, 'STRONG', 'ble_name_pattern',
        jsonb_build_object('ssid', n.ssid, 'pattern', '^(axon[_-]|taser[_-]|axon[[:space:]]|taser[[:space:]]|signal_sidearm|signal_unit)'), 12
      FROM app.networks n
      WHERE n.type IN ('E', 'B')
        AND n.ssid ~* '^(axon[_-]|taser[_-]|axon[[:space:]]|taser[[:space:]]|signal_sidearm|signal_unit)'
        AND (n.mfgrid IS NULL OR n.mfgrid != 845)

      UNION ALL

      -- 13. Low-confidence BWC SSID heuristic: officer assignment & operational naming (X_*)
      -- Pattern: X_ prefix followed by officer name or operational unit identifier.
      -- Captures both officer conventions (X_grodriguez) and unit tags (X_SPARE2, X_X2_BWC, X_K9-Forystek).
      -- Calibrated as a low-confidence heuristic (WEAK match quality, base likelihood 35–45)
      -- because naming conventions alone do not constitute hardware-level proof of device class.
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'AXON_BODY_CAMERA',
        CASE
          WHEN n.service IS NOT NULL
            AND '0000ffa1-0000-1000-8000-00805f9b34fb' = ANY(string_to_array(lower(n.service), ' '))
          THEN 45
          ELSE 35
        END,
        'WEAK',
        'ssid_pattern',
        jsonb_build_object(
          'ssid', n.ssid,
          'pattern', '^X_[A-Za-z0-9_-]+$',
          'note', 'bwc_naming_heuristic_low_confidence',
          'service_uuid', n.service
        ), 13
      FROM app.networks n
      WHERE n.ssid ~ '^X_[A-Za-z0-9_-]+$'

      UNION ALL

      -- 14. Low-confidence BWC BLE service UUID 0xFFA1 heuristic (non-X_ beacons)
      -- Full UUID: 0000ffa1-0000-1000-8000-00805f9b34fb (unassigned 16-bit BLE identifier).
      -- Calibrated as a low-confidence heuristic (base likelihood 30, WEAK match quality).
      -- Excludes X_ SSIDs (already captured by Tier 13) to prevent artificial multi-indicator inflation.
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'AXON_BODY_CAMERA', 30, 'WEAK', 'uuid_match',
        jsonb_build_object(
          'service_uuid', n.service,
          'uuid_short', '0xFFA1',
          'note', 'unassigned_ble_service_heuristic_low_confidence'
        ), 14
      FROM app.networks n
      WHERE n.type IN ('E', 'B')
        AND n.service IS NOT NULL
        AND '0000ffa1-0000-1000-8000-00805f9b34fb' = ANY(string_to_array(lower(n.service), ' '))
        AND (n.ssid IS NULL OR n.ssid !~ '^X_[A-Za-z0-9_-]+$')

      UNION ALL

      -- 15. Axon body cam CoD fingerprint: 0x1F00 (Uncategorized, no service class).
      -- Confirmed from 23 captured Axon body cams — every one reports CoD 0x1F00.
      -- Consumer BT devices always declare a proper major class; 0x1F00 on a known
      -- Axon OUI is a strong corroborating signal. On an unknown OUI it is a weak
      -- indicator (many cheap BT modules also ship with 0x1F00 as a default).
      -- Only fires when OUI is confirmed Axon AND no X_ SSID (those are already
      -- caught by tier 13 at higher confidence).
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'AXON_BODY_CAMERA', 78, 'STRONG', 'cod_fingerprint',
        jsonb_build_object('cod_hex', '0x1F00', 'cod_int', o.radio_frequency,
          'note', 'uncategorized_no_service_class_axon_oui'), 15
      FROM app.networks n
      JOIN app.observations o ON n.bssid = o.bssid AND o.radio_frequency = 7936
      JOIN app.oui_device_groups odg ON LEFT(n.bssid, 8) = odg.oui
      WHERE n.type IN ('E', 'B')
        AND odg.surveillance_type = 'AXON_BODY_CAMERA'
        AND odg.surveillance_confidence = 'HIGH'
        AND LEFT(n.bssid, 8) NOT IN ('70:F7:54', 'B8:13:32', '54:78:C9', '08:FB:EA')
        AND (n.mfgrid IS NULL OR n.mfgrid != 845)
        AND (n.ssid IS NULL OR n.ssid !~ '^X_[A-Za-z0-9_-]+$')

      UNION ALL

      -- 16. Bluetooth imaging device: CoD major class 0x06 (Imaging), minor 0x20 (Camera).
      -- Full CoD: 0x0620 = 1568 decimal (Major 0x06 Imaging + Minor 0x20 Camera).
      -- Note: 0x0680 = 1664 decimal has bit 7 set, which indicates a Printer (receipt/label printers).
      -- These are devices that honestly self-identify as Bluetooth cameras — dashcams, security cameras,
      -- body-worn cameras from vendors other than Axon. Confidence is moderate (STRONG) since CoD is
      -- self-reported and could be spoofed, but combined with location/behavioral data it is meaningful.
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'BT_IMAGING_DEVICE', 70, 'STRONG', 'cod_imaging',
        jsonb_build_object('cod_hex', '0x0620', 'cod_int', o.radio_frequency,
          'major_class', 'Imaging', 'minor_class', 'Camera'), 16
      FROM app.networks n
      JOIN app.observations o ON n.bssid = o.bssid AND o.radio_frequency = 1568
      WHERE n.type IN ('E', 'B')

      UNION ALL

      -- 17. Unknown vendor body cam SSID pattern: DEI-[digits]
      -- 41 devices confirmed in dataset. All BLE (type E/B), all randomized MACs,
      -- all report CoD 0x1F00 (same deliberate obfuscation as Axon body cams).
      -- SSID encodes a serial number (e.g. DEI-9577469, range ~1.2M–9.8M observed).
      -- Vendor attribution: "DEI" prefix is unconfirmed — no public documentation
      -- links this naming convention to a specific manufacturer. Possible candidates
      -- include Digital Ally (FirstVu line) or other LE body cam vendors.
      -- The randomized MACs + 0x1F00 CoD + proprietary UUID pattern is consistent
      -- with purpose-built law enforcement surveillance equipment.
      -- Confidence boosted to EXACT when the proprietary service UUID is also present.
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'DEI_BWC',
        CASE WHEN n.service = 'b4520100-a308-4e56-8a52-536c2ad07147' THEN 92 ELSE 84 END,
        CASE WHEN n.service = 'b4520100-a308-4e56-8a52-536c2ad07147' THEN 'EXACT' ELSE 'STRONG' END,
        'ssid_pattern',
        jsonb_build_object('ssid', n.ssid, 'pattern', '^DEI-[0-9]+$',
          'note', 'digital_ally_serial', 'service_uuid', n.service), 17
      FROM app.networks n
      WHERE n.ssid ~ '^DEI-[0-9]+$'

      UNION ALL

      -- 18. DEI- body cam service UUID (confirmed exclusive to DEI- devices in dataset).
      -- UUID: b4520100-a308-4e56-8a52-536c2ad07147
      -- Not registered in any public BLE/GATT database — proprietary vendor UUID.
      -- Catches devices not advertising the DEI- SSID at time of capture.
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'DEI_BWC', 90, 'EXACT', 'uuid_match',
        jsonb_build_object('service_uuid', n.service,
          'note', 'dei_ble_service_uuid'), 18
      FROM app.networks n
      WHERE n.type IN ('E', 'B')
        AND n.service = 'b4520100-a308-4e56-8a52-536c2ad07147'
        AND (n.ssid IS NULL OR n.ssid !~ '^DEI-[0-9]+$')

      UNION ALL

      -- 19. Dashcam SSID patterns. These remain surveillance-relevant but are
      -- intentionally outside the body-worn-camera filter.
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'DASHCAM', 72, 'STRONG', 'ssid_pattern',
        jsonb_build_object('ssid', n.ssid, 'pattern',
          '^(Vantrue|Nextbase|Viofo|BlackVue|70mai)'), 19
      FROM app.networks n
      WHERE n.ssid ~* '^(Vantrue|Nextbase|Viofo|BlackVue|70mai)'

      UNION ALL

      -- 20. Residential/consumer camera OUI match. Manufacturer reference
      -- data is used as identity context; this is not a BWC classification.
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'RESIDENTIAL_CAMERA', 72, 'STRONG', 'manufacturer_oui_match',
        jsonb_build_object('oui', LEFT(n.bssid, 8), 'manufacturer', rm.manufacturer), 20
      FROM app.networks n
      JOIN app.radio_manufacturers rm
        ON UPPER(rm.oui) = REPLACE(LEFT(UPPER(n.bssid), 8), ':', '')
      WHERE rm.manufacturer ILIKE ANY (ARRAY[
        '%Ring%', '%Amazon Technologies%', '%Nest%', '%Google%',
        '%Arlo%', '%Netgear%', '%Wyze%', '%Eufy%', '%Anker Innovations%',
        '%SimpliSafe%'
      ])

      UNION ALL

      -- 21. Raven gunshot detector BLE service UUIDs
      -- NOTE: The legacy UUID pair (0x1809 + 0x1819) corresponds to standard Bluetooth SIG
      -- services (Health Thermometer + Location and Navigation). It is included here as a
      -- research-derived signature per SURVEILLANCE_DEVICE_SIGNATURES.md §3, pending further
      -- device-specific capture validation.
      SELECT n.bssid, n.ssid, n.type, n.bestlevel, n.service, n.mfgrid,
        'RAVEN_GUNSHOT_DETECTOR',
        CASE
          WHEN ((CASE WHEN n.service ~* '(^|[[:space:]])00003100-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END +
                 CASE WHEN n.service ~* '(^|[[:space:]])00003200-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END +
                 CASE WHEN n.service ~* '(^|[[:space:]])00003300-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END +
                 CASE WHEN n.service ~* '(^|[[:space:]])00003400-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END +
                 CASE WHEN n.service ~* '(^|[[:space:]])00003500-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END) >= 2)
            THEN 90
          WHEN (n.service ~* '(^|[[:space:]])0000(3100|3200|3300|3400|3500)-0000-1000-8000-00805f9b34fb([[:space:]]|$)')
            THEN 70
          ELSE 60
        END AS base_likelihood,
        CASE
          WHEN ((CASE WHEN n.service ~* '(^|[[:space:]])00003100-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END +
                 CASE WHEN n.service ~* '(^|[[:space:]])00003200-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END +
                 CASE WHEN n.service ~* '(^|[[:space:]])00003300-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END +
                 CASE WHEN n.service ~* '(^|[[:space:]])00003400-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END +
                 CASE WHEN n.service ~* '(^|[[:space:]])00003500-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END) >= 2)
            THEN 'EXACT'
          ELSE 'PARTIAL'
        END AS match_quality,
        'uuid_match',
        jsonb_build_object(
          'service', n.service,
          'matched_custom_uuid_count', (
            CASE WHEN n.service ~* '(^|[[:space:]])00003100-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END +
            CASE WHEN n.service ~* '(^|[[:space:]])00003200-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END +
            CASE WHEN n.service ~* '(^|[[:space:]])00003300-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END +
            CASE WHEN n.service ~* '(^|[[:space:]])00003400-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END +
            CASE WHEN n.service ~* '(^|[[:space:]])00003500-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END
          ),
          'matched_custom_uuids', to_jsonb(array_remove(ARRAY[
            CASE WHEN n.service ~* '(^|[[:space:]])00003100-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN '00003100-0000-1000-8000-00805f9b34fb' END,
            CASE WHEN n.service ~* '(^|[[:space:]])00003200-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN '00003200-0000-1000-8000-00805f9b34fb' END,
            CASE WHEN n.service ~* '(^|[[:space:]])00003300-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN '00003300-0000-1000-8000-00805f9b34fb' END,
            CASE WHEN n.service ~* '(^|[[:space:]])00003400-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN '00003400-0000-1000-8000-00805f9b34fb' END,
            CASE WHEN n.service ~* '(^|[[:space:]])00003500-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN '00003500-0000-1000-8000-00805f9b34fb' END
          ], NULL)),
          'has_legacy_pair', (
            n.service ~* '(^|[[:space:]])00001809-0000-1000-8000-00805f9b34fb([[:space:]]|$)' AND
            n.service ~* '(^|[[:space:]])00001819-0000-1000-8000-00805f9b34fb([[:space:]]|$)'
          ),
          'firmware_version', (
            CASE
              WHEN n.service ~* '(^|[[:space:]])0000(3400|3500)-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN '1.3.x (inferred)'
              WHEN ((CASE WHEN n.service ~* '(^|[[:space:]])00003100-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END +
                     CASE WHEN n.service ~* '(^|[[:space:]])00003200-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END +
                     CASE WHEN n.service ~* '(^|[[:space:]])00003300-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN 1 ELSE 0 END) >= 2) THEN '1.2.x (inferred)'
              WHEN n.service ~* '(^|[[:space:]])0000(3100|3200|3300)-0000-1000-8000-00805f9b34fb([[:space:]]|$)' THEN '1.2.x+ (partial, inferred)'
              WHEN (n.service ~* '(^|[[:space:]])00001809-0000-1000-8000-00805f9b34fb([[:space:]]|$)' AND
                    n.service ~* '(^|[[:space:]])00001819-0000-1000-8000-00805f9b34fb([[:space:]]|$)') THEN '1.1.x (legacy, inferred)'
              ELSE 'unknown'
            END
          )
        ),
        21
      FROM app.networks n
      WHERE n.type IN ('E', 'B')
        AND n.service IS NOT NULL
        AND (
          n.service ~* '(^|[[:space:]])0000(3100|3200|3300|3400|3500)-0000-1000-8000-00805f9b34fb([[:space:]]|$)'
          OR (
            n.service ~* '(^|[[:space:]])00001809-0000-1000-8000-00805f9b34fb([[:space:]]|$)'
            AND n.service ~* '(^|[[:space:]])00001819-0000-1000-8000-00805f9b34fb([[:space:]]|$)'
          )
        )

    ),
    obs_stats AS (
      SELECT
        o.bssid,
        COUNT(*)::int                                      AS obs_count,
        COUNT(DISTINCT DATE(o.time))::int                  AS unique_days,
        MIN(o.level)::int                                  AS min_rssi,
        MAX(o.level)::int                                  AS max_rssi,
        ROUND(AVG(o.level)::numeric, 1)                    AS avg_rssi,
        MIN(o.time)                                        AS first_seen,
        MAX(o.time)                                        AS last_seen,
        EXTRACT(EPOCH FROM MAX(o.time) - MIN(o.time))::int AS duration_seconds,
        COUNT(DISTINCT (ROUND(o.lat::numeric,3) || ',' || ROUND(o.lon::numeric,3)))::int AS unique_positions
      FROM app.observations o
      WHERE o.bssid IN (SELECT DISTINCT bssid FROM candidates)
        AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
      GROUP BY o.bssid
    )
    SELECT
      c.bssid, c.ssid, c.type, c.bestlevel, c.service, c.mfgrid,
      c.device_type, c.base_likelihood, c.match_quality,
      c.detection_method, c.matched_signals, c.priority,
      COUNT(*) OVER (PARTITION BY c.bssid)::int AS tier_hit_count,
      COALESCE(os.obs_count, 0)          AS obs_count,
      COALESCE(os.unique_days, 0)        AS unique_days,
      os.min_rssi,
      os.max_rssi,
      os.avg_rssi,
      os.first_seen,
      os.last_seen,
      COALESCE(os.duration_seconds, 0)   AS duration_seconds,
      COALESCE(os.unique_positions, 0)   AS unique_positions
    FROM candidates c
    LEFT JOIN obs_stats os ON os.bssid = c.bssid
    ORDER BY c.bssid, c.priority ASC, c.base_likelihood DESC
  `;

/** SQL contract for bulk surveillance-detection upserts. */
export const BULK_UPSERT_DETECTIONS_SQL = `
    INSERT INTO app.surveillance_detections
      (bssid, device_type, confidence, threat_score, detection_method,
       matched_signals, false_positive, fp_reason, created_by)
    SELECT b, dt, c, ts, dm, ms::jsonb, fp, fpr, 'surveillance_scan_job'
    FROM unnest(
      $1::text[], $2::text[], $3::numeric[], $4::numeric[],
      $5::text[], $6::jsonb[], $7::boolean[], $8::text[]
    ) AS t(b, dt, c, ts, dm, ms, fp, fpr)
    ON CONFLICT (bssid) DO UPDATE SET
      device_type      = EXCLUDED.device_type,
      confidence       = EXCLUDED.confidence,
      threat_score     = EXCLUDED.threat_score,
      detection_method = EXCLUDED.detection_method,
      matched_signals  = EXCLUDED.matched_signals,
      false_positive   = EXCLUDED.false_positive,
      fp_reason        = EXCLUDED.fp_reason,
      detected_at      = NOW()
    WHERE app.surveillance_detections.false_positive = FALSE
       OR EXCLUDED.false_positive = TRUE
    RETURNING bssid
    `;

/** Builds the ordered PostgreSQL array parameters consumed by the bulk-upsert SQL. */
export function buildBulkUpsertDetectionParams(
  detections: readonly DetectionUpsertInput[]
): BulkUpsertDetectionParams {
  return [
    detections.map((detection) => detection.bssid),
    detections.map((detection) => detection.device_type),
    detections.map((detection) => detection.confidence),
    detections.map((detection) => detection.threat_score),
    detections.map((detection) => detection.detection_method),
    detections.map((detection) => JSON.stringify(detection.matched_signals)),
    detections.map((detection) => detection.false_positive),
    detections.map((detection) => detection.fp_reason),
  ];
}

/** SQL contract for fetching detection evidence by BSSID. */
export const GET_DETECTION_EVIDENCE_BY_BSSID_SQL = `
  SELECT
      sd.device_type,
      sd.confidence,
      sd.threat_score,
      sd.detected_at,
      (
        SELECT MAX(wv.lastupdt)
        FROM app.wigle_v2_networks_search wv
        WHERE wv.bssid = sd.bssid
      ) AS lastupdt,
      sd.detection_method,
      sd.matched_signals,
      sd.false_positive,
      sd.fp_reason,
      sd.notes,
      nt.tags
    FROM app.surveillance_detections sd
    LEFT JOIN app.network_tags nt ON nt.bssid = sd.bssid
    WHERE sd.bssid = $1
    ORDER BY sd.detected_at DESC
`;
