import { query, closePool } from '../../server/src/config/database';
import { describeIfIntegration } from '../helpers/integrationEnv';

describeIfIntegration('Unified Sibling Sieve (find_sibling_radios)', () => {
  const testBssids = [
    // Positive AirLink Delta-1
    '00:14:3E:FF:FF:10',
    '00:14:3E:FF:FF:11',
    // Positive Sierra Delta-1
    '28:A3:31:FF:FF:20',
    '28:A3:31:FF:FF:21',
    // Negative Delta-2 (AirLink)
    '00:14:3E:FF:FF:12',
    // Cross-vendor Negative
    '00:14:3E:FF:EE:30',
    '28:A3:31:FF:EE:31',
    // Asymmetric SSID test
    '00:14:3E:FF:DD:40',
    '00:14:3E:FF:DD:41',
    // Cradlepoint (00:30:44)
    '00:30:44:FF:CC:50',
    '00:30:44:FF:CC:51',
    // Mist positive (same SSID + different band)
    'D4:20:B0:FF:FF:11',
    'D4:20:B0:FF:FF:12',
    // Mist positive (different SSIDs + same band)
    'D4:20:B0:FF:FF:31',
    'D4:20:B0:FF:FF:32',
    // Mist negative (same SSID + same band + different chassis)
    'D4:20:B0:FF:AA:41',
    'D4:20:B0:FF:BB:41',
    // Mist Rule Correction tests (using EE to avoid clashes with live database observations)
    'D4:20:B0:EE:8F:E1',
    'D4:20:B0:EE:8F:E2',
    'D4:20:B0:EE:8C:E2',
    // AirLink fifth-octet variation tests
    '00:14:3E:EE:8F:E1',
    '00:14:3E:EE:8F:E2',
    '00:14:3E:EE:8C:E2',
    // Sierra fifth-octet variation tests
    '28:A3:31:EE:8F:E1',
    '28:A3:31:EE:8F:E2',
    '28:A3:31:EE:8C:E2',
    // Cisco 24:D7:9C fifth-octet variation and group validation tests
    '24:D7:9C:C6:BE:29',
    '24:D7:9C:C6:BE:2A',
    '24:D7:9C:C6:BE:2B',
    '24:D7:9C:C6:BE:2C',
    '24:D7:9C:C6:BE:2D',
    '24:D7:9C:C6:BE:2E',
    '24:D7:9C:C6:BE:2F',
    '24:D7:9C:C6:B3:2F',
    '24:D7:9C:C6:CD:2F',
    // Cisco 5C:5B:35 tests
    '5C:5B:35:C6:BE:2E',
    '5C:5B:35:C6:BE:2F',
    '5C:5B:35:C6:B3:2F',
    // Cradlepoint delta-3 guardrail tests (EE: prefix avoids collision with live data)
    // Radio pairs: delta 1 and delta 2 — must keep
    '00:30:44:EE:11:10',
    '00:30:44:EE:11:11',
    '00:30:44:EE:22:20',
    '00:30:44:EE:22:22',
    // Boundary: delta 3 — must keep
    '00:30:44:EE:33:30',
    '00:30:44:EE:33:33',
    // Reject: delta 4 — must not produce Class A
    '00:30:44:EE:44:40',
    '00:30:44:EE:44:44',
    // Cross-vehicle clique: same octets 2-5, large delta — must reject
    '00:30:44:EE:55:10',
    '00:30:44:EE:55:1F',
    // Specific Cradlepoint BSSIDs requested for audit verification
    '00:30:44:A2:54:CE',
    '00:30:44:A2:54:D3',
    '00:30:44:CA:44:19',
    '00:30:44:CA:44:1A',
    '00:30:44:CA:44:28',
    '00:30:44:CA:44:29',
    '00:30:44:61:8A:8F',
    '00:30:44:61:8A:90',
    '00:30:44:1C:CA:9E',
    '00:30:44:1C:CA:A0',
    // Cradlepoint SmartBus/Kajeet fleet BSSIDs for parity and band verification
    '00:30:44:A2:55:51',
    '00:30:44:A2:55:52',
    '00:30:44:A2:55:54',
    '00:30:44:A2:55:55',
    '00:30:44:A2:55:57',
    '00:30:44:A2:55:6C',
    '00:30:44:A2:55:6D',
    '00:30:44:A2:55:6F',
    '00:30:44:A2:55:72',
    '00:30:44:A2:55:73',
    '00:30:44:A2:55:76',
    '00:30:44:A2:55:77',
    '00:30:44:A2:55:80',
    '00:30:44:A2:55:82',
    '00:30:44:A2:55:90',
    '00:30:44:A2:55:93',
    '00:30:44:A2:55:A0',
    '00:30:44:A2:55:A1',
    '00:30:44:A2:55:B0',
    '00:30:44:A2:55:B1',
    '00:30:44:A2:55:C0',
    '00:30:44:A2:55:C1',
    // Cradlepoint Non-Fleet Delta Fallback tests
    '00:30:44:FF:D0:10',
    '00:30:44:FF:D0:11',
    '00:30:44:FF:D0:20',
    '00:30:44:FF:D0:22',
    '00:30:44:FF:D0:30',
    '00:30:44:FF:D0:33',
    '00:30:44:FF:D0:40',
    '00:30:44:FF:D0:44',
    // Xfinity/Vantiva randomized LAA tests
    '4A:BD:CE:D2:2D:B4',
    '4A:BD:CE:D9:2D:B4',
    '4A:BD:CE:D9:2D:B2',
    '4A:BD:CE:D9:2D:B6',
    // GM Vehicle Hotspot tests
    '02:92:A5:1A:AF:17',
    '02:92:A5:1A:CB:17',
    '02:92:A5:12:AF:17',
    '02:92:A5:12:CB:17',
    '02:92:A5:12:AF:18',
    '00:92:A5:A5:54:F8',
    '00:92:A5:A5:54:F9',
    '00:92:A5:A5:6A:F9',
    // Netgear Dual-Band tests
    '6C:CD:D6:35:CE:CC',
    '6C:CD:D6:38:3F:CC',
    '6C:CD:D6:35:CF:CD',
    // Arcadyan HOME-EE7D tests
    '5C:B0:66:EB:E1:C1',
    '7E:B0:66:EB:E1:C1',
    '9E:B0:66:EB:E1:C2',
    '5C:BF:66:EB:E1:C1',
    // Ubiquiti UniFi VAP tests
    'F6:E2:C6:16:6E:F5',
    'F6:E2:C6:86:6E:F5',
    'F4:E2:C6:46:6E:F5',
    'F6:E2:C6:E6:6E:F5',
    'F6:E2:C6:16:8A:F2',
    'F6:E2:C6:15:6E:F5',
    // Mist Systems VAP tests
    'D4:20:B0:9C:8F:E2',
    'D4:20:B0:9C:8F:F3',
    'D4:20:B0:9C:8A:F3',
    // LAA Hardening mock tests
    'F6:EE:EE:64:94:0C',
    '02:EE:EE:64:94:1C',
    'F4:EE:EE:64:94:1C',
    '02:EE:EE:64:94:0D',
  ];

  beforeAll(async () => {
    // Clear out any stale versions in test networks (safe since they are unique to this test)
    await query('DELETE FROM app.observations WHERE bssid = ANY($1)', [testBssids]);
    await query('DELETE FROM app.ssid_history WHERE bssid = ANY($1)', [testBssids]);
    await query('DELETE FROM app.networks WHERE bssid = ANY($1)', [testBssids]);

    // Insert mock networks
    await query(`
      INSERT INTO app.networks (bssid, ssid, type, frequency, capabilities, lasttime_ms, lastlat, lastlon, bestlat, bestlon)
      VALUES
        ('00:14:3E:FF:FF:10', 'AirLink_Target', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:14:3E:FF:FF:11', 'AirLink_Twin',   'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        ('28:A3:31:FF:FF:20', 'Sierra_Target',  'W', 2437, '', 1716500000000, 42.456, -83.456, 42.456, -83.456),
        ('28:A3:31:FF:FF:21', 'Sierra_Twin',    'W', 2437, '', 1716500000000, 42.456, -83.456, 42.456, -83.456),

        ('00:14:3E:FF:FF:12', 'AirLink_Delta2', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        ('00:14:3E:FF:EE:30', 'AirLink_Cross',  'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('28:A3:31:FF:EE:31', 'Sierra_Cross',   'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        ('00:14:3E:FF:DD:40', 'SSID_One',       'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:14:3E:FF:DD:41', 'SSID_Two_Diff',  'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        ('00:30:44:FF:CC:50', 'Cradle_One',     'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:FF:CC:51', 'Cradle_Two',     'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        -- Mist positive (same SSID + different band)
        ('D4:20:B0:FF:FF:11', 'eduroam', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('D4:20:B0:FF:FF:12', 'eduroam', 'W', 5745, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        -- Mist positive (different SSIDs + same band)
        ('D4:20:B0:FF:FF:31', 'eduroam', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('D4:20:B0:FF:FF:32', 'MGuest',  'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        -- Mist negative (same SSID + same band + different chassis)
        ('D4:20:B0:FF:AA:41', 'eduroam', 'W', 2437, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('D4:20:B0:FF:BB:41', 'eduroam', 'W', 2437, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        -- Mist Rule Correction tests
        ('D4:20:B0:EE:8F:E1', 'eduroam', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('D4:20:B0:EE:8F:E2', 'MGuest',  'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('D4:20:B0:EE:8C:E2', 'MGuest',  'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        -- AirLink fifth-octet variation tests
        ('00:14:3E:EE:8F:E1', 'AirLink_1', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:14:3E:EE:8F:E2', 'AirLink_2', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:14:3E:EE:8C:E2', 'AirLink_3', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        -- Sierra fifth-octet variation tests
        ('28:A3:31:EE:8F:E1', 'Sierra_1',  'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('28:A3:31:EE:8F:E2', 'Sierra_2',  'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('28:A3:31:EE:8C:E2', 'Sierra_3',  'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        -- Cisco 24:D7:9C fifth-octet variation and group validation tests
        ('24:D7:9C:C6:BE:29', 'Cisco_SOMIOT', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('24:D7:9C:C6:BE:2A', 'Cisco_SOMIOT', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('24:D7:9C:C6:BE:2B', 'Cisco_SOMIOT', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('24:D7:9C:C6:BE:2C', '',             'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('24:D7:9C:C6:BE:2D', '',             'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('24:D7:9C:C6:BE:2E', '',             'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('24:D7:9C:C6:BE:2F', '',             'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('24:D7:9C:C6:B3:2F', 'Cisco_SOMIOT', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('24:D7:9C:C6:CD:2F', 'Cisco_SOMIOT', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        -- Cisco 5C:5B:35 tests
        ('5C:5B:35:C6:BE:2E', 'Cisco_Enterprise', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('5C:5B:35:C6:BE:2F', '',                 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('5C:5B:35:C6:B3:2F', 'Cisco_Enterprise', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        -- Cradlepoint delta-3 guardrail tests
        -- Radio pair delta 1: 2.4/5 GHz siblings — must keep as Class A
        ('00:30:44:EE:11:10', 'CP-Radio-2.4', 'W', 2437, '', 1716500000000, 42.100, -83.100, 42.100, -83.100),
        ('00:30:44:EE:11:11', 'CP-Radio-5',   'W', 5745, '', 1716500000000, 42.100, -83.100, 42.100, -83.100),
        -- Radio pair delta 2: must keep as Class A
        ('00:30:44:EE:22:20', 'CP-Sibling-A', 'W', 2412, '', 1716500000000, 42.200, -83.200, 42.200, -83.200),
        ('00:30:44:EE:22:22', 'CP-Sibling-B', 'W', 5180, '', 1716500000000, 42.200, -83.200, 42.200, -83.200),
        -- Boundary delta 3: must keep as Class A
        ('00:30:44:EE:33:30', 'CP-Boundary-A', 'W', 2437, '', 1716500000000, 42.300, -83.300, 42.300, -83.300),
        ('00:30:44:EE:33:33', 'CP-Boundary-B', 'W', 5500, '', 1716500000000, 42.300, -83.300, 42.300, -83.300),
        -- Delta 4: must NOT produce Class A (cross-vehicle boundary)
        ('00:30:44:EE:44:40', 'CP-Fleet-A', 'W', 2412, '', 1716500000000, 42.400, -83.400, 42.400, -83.400),
        ('00:30:44:EE:44:44', 'CP-Fleet-B', 'W', 5745, '', 1716500000000, 42.405, -83.405, 42.405, -83.405),
        -- Cross-vehicle large delta (simulates SmartBus fleet clique): must reject
        ('00:30:44:EE:55:10', 'CP-Bus-A', 'W', 2412, '', 1716500000000, 42.500, -83.500, 42.500, -83.500),
        ('00:30:44:EE:55:1F', 'CP-Bus-B', 'W', 2412, '', 1716500000000, 42.510, -83.510, 42.510, -83.510),

        -- Specific audit / regression Cradlepoint fleet pairs
        ('00:30:44:A2:54:CE', 'Cradle_Enterprise', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:54:D3', 'Cradle_Enterprise', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:CA:44:19', 'CP-Bus-1-A',        'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:CA:44:1A', 'CP-Bus-1-B',        'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:CA:44:28', 'CP-Bus-2-A',        'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:CA:44:29', 'CP-Bus-2-B',        'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:61:8A:8F', 'CP-Bus-3-A',        'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:61:8A:90', 'CP-Bus-3-B',        'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:1C:CA:9E', 'CP-Bus-4-A',        'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:1C:CA:A0', 'CP-Bus-4-B',        'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        -- Cradlepoint SmartBus/Kajeet fleet BSSIDs for parity and band verification
        ('00:30:44:A2:55:51', 'Kajeet SmartBus', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:52', 'Kajeet SmartBus', 'W', 5720, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:54', 'MTA SmartBus',    'W', 2462, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:55', 'MTA SmartBus',    'W', 5745, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:57', 'Kajeet SmartBus', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:6C', 'MTA SmartBus',    'W', 2462, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:6D', 'MTA SmartBus',    'W', 5320, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:6F', 'Kajeet SmartBus', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:72', 'Kajeet SmartBus', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:73', 'Kajeet SmartBus', 'W', 5500, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:76', 'Kajeet SmartBus', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:77', 'Kajeet SmartBus', 'W', 2462, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:80', 'MTA SmartBus',    'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:82', 'MTA SmartBus',    'W', 5500, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:90', 'Kajeet SmartBus', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:93', 'Kajeet SmartBus', 'W', 5500, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:A0', 'MTA SmartBus',    'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:A1', 'Kajeet SmartBus', 'W', 5500, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:B0', 'Kajeet SmartBus', 'W', 5500, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:B1', 'Kajeet SmartBus', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:C0', 'MTA SmartBus',    'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:30:44:A2:55:C1', 'MTA SmartBus',    'W', 6115, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        -- Cradlepoint Non-Fleet Delta Fallback tests (isolated SSIDs, same first 5 octets, no distance dependency)
        ('00:30:44:FF:D0:10', 'CP-NonFleet-10', 'W', 2412, '', 1716500000000, 42.600, -83.600, 42.600, -83.600),
        ('00:30:44:FF:D0:11', 'CP-NonFleet-11', 'W', 5180, '', 1716500000000, 42.600, -83.600, 42.600, -83.600),
        ('00:30:44:FF:D0:20', 'CP-NonFleet-20', 'W', 2412, '', 1716500000000, 42.600, -83.600, 42.600, -83.600),
        ('00:30:44:FF:D0:22', 'CP-NonFleet-22', 'W', 5180, '', 1716500000000, 42.600, -83.600, 42.600, -83.600),
        ('00:30:44:FF:D0:30', 'CP-NonFleet-30', 'W', 2412, '', 1716500000000, 42.600, -83.600, 42.600, -83.600),
        ('00:30:44:FF:D0:33', 'CP-NonFleet-33', 'W', 5180, '', 1716500000000, 42.600, -83.600, 42.600, -83.600),
        ('00:30:44:FF:D0:40', 'CP-NonFleet-40', 'W', 2412, '', 1716500000000, 42.600, -83.600, 42.600, -83.600),
        ('00:30:44:FF:D0:44', 'CP-NonFleet-44', 'W', 5180, '', 1716500000000, 42.600, -83.600, 42.600, -83.600),

        -- Xfinity/Vantiva randomized LAA test networks
        ('4A:BD:CE:D2:2D:B4', 'xfinitywifi',     'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('4A:BD:CE:D9:2D:B4', 'xfinitywifi',     'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('4A:BD:CE:D9:2D:B2', 'GT-777',          'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('4A:BD:CE:D9:2D:B6', 'Xfinity Mobile',  'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),

        -- GM Vehicle Hotspot test networks
        ('02:92:A5:1A:AF:17', 'myChevrolet6472', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('02:92:A5:1A:CB:17', 'myBuick8689',     'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('02:92:A5:12:AF:17', 'myChevrolet6472', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('02:92:A5:12:CB:17', 'myBuick8689',     'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('02:92:A5:12:AF:18', 'myChevrolet6472', 'W', 5180, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:92:A5:A5:54:F8', 'myChevrolet1234', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:92:A5:A5:54:F9', 'myChevrolet1234', 'W', 5180, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('00:92:A5:A5:6A:F9', 'myChevrolet5678', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        -- Netgear Dual-Band test networks
        ('6C:CD:D6:35:CE:CC', 'NETGEAR73', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('6C:CD:D6:38:3F:CC', 'NETGEAR73', 'W', 5765, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('6C:CD:D6:35:CF:CD', 'NETGEAR73', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        -- Arcadyan HOME-EE7D test networks
        ('5C:B0:66:EB:E1:C1', 'HOME-EE7D', 'W', 2462, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('7E:B0:66:EB:E1:C1', '',          'W', 2462, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('9E:B0:66:EB:E1:C2', '',          'W', 5180, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('5C:BF:66:EB:E1:C1', 'HOME-EE7D', 'W', 2462, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        -- Ubiquiti UniFi VAP test networks
        ('F6:E2:C6:16:6E:F5', 'Philpott IOT',    'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('F6:E2:C6:86:6E:F5', 'Philpott',        'W', 5180, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('F4:E2:C6:46:6E:F5', 'Philpott',        'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('F6:E2:C6:E6:6E:F5', 'Philpott',        'W', 5180, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('F6:E2:C6:16:8A:F2', 'Philpott IOT',    'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('F6:E2:C6:15:6E:F5', 'Philpott IOT',    'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        -- Mist Systems VAP isolated tests
        ('D4:20:B0:9C:8F:E2', 'Mist-SSID-1', 'W', 2412, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('D4:20:B0:9C:8F:F3', 'Mist-SSID-2', 'W', 5180, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('D4:20:B0:9C:8A:F3', 'Mist-SSID-2', 'W', 5180, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        -- LAA Hardening mock networks
        ('F6:EE:EE:64:94:0C', 'YMCA-Mock-LAA',   'W', 2437, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('02:EE:EE:64:94:1C', 'Whaley-Mock-LAA', 'W', 2462, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('F4:EE:EE:64:94:1C', 'Whaley-Mock-Guest','W', 2462, '', 1716500000000, 42.123, -83.123, 42.123, -83.123),
        ('02:EE:EE:64:94:0D', 'YMCA-Mock-Twin-LAA','W', 2437, '', 1716500000000, 42.123, -83.123, 42.123, -83.123)
    `);
  });

  afterAll(async () => {
    // Cleanup inserted mock networks
    await query('DELETE FROM app.observations WHERE bssid = ANY($1)', [testBssids]);
    await query('DELETE FROM app.ssid_history WHERE bssid = ANY($1)', [testBssids]);
    await query('DELETE FROM app.networks WHERE bssid = ANY($1)', [testBssids]);
    await closePool();
  });

  // ── Non-regression Verification ─────────────────────────────────────────────
  test('Positive: AirLink delta-1 twin is paired and labeled AIRLINK_DELTA1_TWIN', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:14:3E:FF:FF:10')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:14:3E:FF:FF:11');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('AIRLINK_DELTA1_TWIN');
  });

  test('Positive: Sierra delta-1 twin is paired and labeled SIERRA_DELTA1_TWIN', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('28:A3:31:FF:FF:20')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '28:A3:31:FF:FF:21');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('SIERRA_DELTA1_TWIN');
  });

  test('Negative: delta-2 candidate does NOT match the DELTA1 rules', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:14:3E:FF:FF:10')");
    const rows = res.rows;
    // Assert that if delta-2 exists, it does not emit the DELTA1 labels
    const delta2 = rows.find((r) => r.sibling_bssid === '00:14:3E:FF:FF:12');
    if (delta2) {
      expect(delta2.rule).not.toBe('AIRLINK_DELTA1_TWIN');
      expect(delta2.rule).not.toBe('SIERRA_DELTA1_TWIN');
    }
  });

  test('Negative: AirLink does not pair with Sierra under this rule', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:14:3E:FF:EE:30')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '28:A3:31:FF:EE:31');
    expect(sibling).toBeUndefined();
  });

  test('Permissive: SSID is not required (different SSIDs pair cleanly)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:14:3E:FF:DD:40')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:14:3E:FF:DD:41');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('AIRLINK_DELTA1_TWIN');
  });

  test('Negative: Cradlepoint (00:30:44) does not emit DELTA1_TWIN rules', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:FF:CC:50')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:FF:CC:51');
    if (sibling) {
      expect(sibling.rule).not.toBe('AIRLINK_DELTA1_TWIN');
      expect(sibling.rule).not.toBe('SIERRA_DELTA1_TWIN');
    }
  });

  // ── Mist Systems Guardrail Verification ──────────────────────────────────────
  test('Mist Guardrail Negative: same SSID + same band + different chassis block must not pair under Class B', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('D4:20:B0:FF:AA:41')");
    const sibling = res.rows.find((r) => r.sibling_bssid === 'D4:20:B0:FF:BB:41');
    expect(sibling).toBeUndefined(); // Rejected! Same SSID + same band (2.4 GHz) across different chasses
  });

  test('Mist Guardrail Positive: same SSID + different band may pair if BSSID math supports it', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('D4:20:B0:FF:FF:11')");
    const sibling = res.rows.find((r) => r.sibling_bssid === 'D4:20:B0:FF:FF:12');
    expect(sibling).toBeDefined(); // Permitted! Same SSID but different bands (2.4 GHz vs 5 GHz) on the same chassis
    expect(sibling.rule).toBe('Mist Systems VAP (Class A)');
  });

  test('Mist Guardrail Positive: different SSIDs + same band may pair if BSSID math supports it', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('D4:20:B0:FF:FF:31')");
    const sibling = res.rows.find((r) => r.sibling_bssid === 'D4:20:B0:FF:FF:32');
    expect(sibling).toBeDefined(); // Permitted! Different SSIDs on the same band (2.4 GHz) on the same chassis
    expect(sibling.rule).toBe('Mist Systems VAP (Class A)');
  });

  // ── Vendor-Specific Sibling Logic (5th-Octet Exclusions) ──────────────────
  test('Mist Rule Correction: same first 5 octets matches', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('D4:20:B0:EE:8F:E1')");
    const sibling = res.rows.find((r) => r.sibling_bssid === 'D4:20:B0:EE:8F:E2');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Mist Systems VAP (Class A)');
  });

  test('Mist Rule Correction: fifth-octet variation does not match', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('D4:20:B0:EE:8F:E2')");
    const sibling = res.rows.find((r) => r.sibling_bssid === 'D4:20:B0:EE:8C:E2');
    expect(sibling).toBeUndefined(); // Rejected! Fifth-octet variation (8F vs 8C)
  });

  test('AirLink delta twin same first 5 octets matches', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:14:3E:EE:8F:E1')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:14:3E:EE:8F:E2');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('AIRLINK_DELTA1_TWIN');
  });

  test('AirLink delta twin fifth-octet variation does not match', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:14:3E:EE:8F:E2')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:14:3E:EE:8C:E2');
    expect(sibling).toBeUndefined(); // Rejected! Fifth-octet variation (8F vs 8C)
  });

  test('Sierra delta twin same first 5 octets matches', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('28:A3:31:EE:8F:E1')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '28:A3:31:EE:8F:E2');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('SIERRA_DELTA1_TWIN');
  });

  test('Sierra delta twin fifth-octet variation does not match', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('28:A3:31:EE:8F:E2')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '28:A3:31:EE:8C:E2');
    expect(sibling).toBeUndefined(); // Rejected! Fifth-octet variation (8F vs 8C)
  });

  // ── Cisco Guardrail Verification ──────────────────────────────────────
  test('Cisco Guardrail Positive: same first 5 octets matches within delta 1 (Class C)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('24:D7:9C:C6:BE:2F')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '24:D7:9C:C6:BE:2E');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Class C');
  });

  test('Cisco Guardrail Positive: same first 5 octets matches within Class B range (delta 6)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('24:D7:9C:C6:BE:2F')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '24:D7:9C:C6:BE:29');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Class B');
  });

  test('Cisco Guardrail Negative: same-index / different-chassis B3:2F does NOT match', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('24:D7:9C:C6:BE:2F')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '24:D7:9C:C6:B3:2F');
    expect(sibling).toBeUndefined(); // Rejected! Same last octet, different fifth octet
  });

  test('Cisco Guardrail Negative: same-index / different-chassis CD:2F does NOT match', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('24:D7:9C:C6:BE:2F')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '24:D7:9C:C6:CD:2F');
    expect(sibling).toBeUndefined(); // Rejected! Same last octet, different fifth octet
  });

  test('Cisco 5C:5B:35 Guardrail Positive: same first 5 octets matches (Class C)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('5C:5B:35:C6:BE:2F')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '5C:5B:35:C6:BE:2E');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Class C');
  });

  test('Cisco 5C:5B:35 Guardrail Negative: fifth-octet variation does not match same-index', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('5C:5B:35:C6:BE:2F')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '5C:5B:35:C6:B3:2F');
    expect(sibling).toBeUndefined(); // Rejected! Same last octet, different fifth octet
  });

  // ── Cradlepoint Class A Delta-3 Guardrail (migration 020) ─────────────────
  test('Cradlepoint Class A Positive: delta-1 radio pair kept (EE:11 fixture)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:EE:11:10')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:EE:11:11');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Class A');
    expect(sibling.d_last_octet).toBe(1);
  });

  test('Cradlepoint Class A Positive: delta-2 radio pair kept (EE:22 fixture)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:EE:22:20')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:EE:22:22');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Class A');
    expect(sibling.d_last_octet).toBe(2);
  });

  test('Cradlepoint Class A Positive: delta-3 boundary pair kept (EE:33 fixture)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:EE:33:30')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:EE:33:33');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Class A');
    expect(sibling.d_last_octet).toBe(3);
  });

  test('Cradlepoint Class A Negative: delta-4 pair does NOT produce Class A (EE:44 fixture)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:EE:44:40')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:EE:44:44');
    // Must not be Class A regardless of whether another rule catches it
    if (sibling) {
      expect(sibling.rule).not.toBe('Class A');
    }
  });

  test('Cradlepoint Class A Negative: cross-vehicle large delta (delta=15) does not pair as Class A (EE:55 fixture)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:EE:55:10')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:EE:55:1F');
    if (sibling) {
      expect(sibling.rule).not.toBe('Class A');
    }
  });

  test('Cradlepoint Class A Negative: cross-vehicle pair is absent or non-Class-A when queried from other side (EE:55 fixture)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:EE:55:1F')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:EE:55:10');
    if (sibling) {
      expect(sibling.rule).not.toBe('Class A');
    }
  });

  // ── Cradlepoint Specific Audit / Regression Cases ──────────────────────────
  test('Cradlepoint Audit: A2:54:CE -> A2:54:D3 must return 0 rows (fails Class A and blocked from Class B)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:A2:54:CE')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:A2:54:D3');
    expect(sibling).toBeUndefined(); // Returns 0 rows
  });

  test('Cradlepoint Audit: CA:44:19 <-> CA:44:1A still matches as Class A', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:CA:44:19')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:CA:44:1A');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Class A');
  });

  test('Cradlepoint Audit: CA:44:28 <-> CA:44:29 still matches as Class A', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:CA:44:28')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:CA:44:29');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Class A');
  });

  test('Cradlepoint Audit: 61:8A:8F <-> 61:8A:90 still matches as Class A', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:61:8A:8F')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:61:8A:90');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Class A');
  });

  test('Cradlepoint Audit: 1C:CA:9E <-> 1C:CA:A0 still matches as Class A', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:1C:CA:9E')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:1C:CA:A0');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Class A');
  });

  // ── Cradlepoint SmartBus/Kajeet Fleet Rule (migration 021) ─────────────────
  test('Cradlepoint Fleet Rule: keeps valid delta-1 cross-band pair with 2.4G MAC < 5G MAC (A2:55:72 ↔ A2:55:73)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:A2:55:72')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:A2:55:73');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Class A');
    expect(sibling.d_last_octet).toBe(1);
  });

  test('Cradlepoint Fleet Rule: keeps valid delta-1 2.4G to 6G pair', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:A2:55:C0')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:A2:55:C1');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Class A');
    expect(sibling.d_last_octet).toBe(1);
  });

  test('Cradlepoint Fleet Rule: rejects delta-1 same-service same-band pair', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:A2:55:76')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:A2:55:77');
    expect(sibling).toBeUndefined();
  });

  test('Cradlepoint Fleet Rule: rejects delta-2 same-service cross-band pair', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:A2:55:80')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:A2:55:82');
    expect(sibling).toBeUndefined();
  });

  test('Cradlepoint Fleet Rule: rejects delta-3 same-service cross-band pair', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:A2:55:90')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:A2:55:93');
    expect(sibling).toBeUndefined();
  });

  test('Cradlepoint Fleet Rule: rejects delta-1 mixed-service cross-band pair', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:A2:55:A0')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:A2:55:A1');
    expect(sibling).toBeUndefined();
  });

  test('Cradlepoint Fleet Rule: rejects delta-1 cross-band pair where 5G MAC < 2.4G MAC', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:30:44:A2:55:B0')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:30:44:A2:55:B1');
    expect(sibling).toBeUndefined();
  });

  test('Cradlepoint Non-Fleet Fallback: delta <= 3 fallback still pairs under Class A while delta 4 is rejected', async () => {
    // Assert Delta 1 pairs under Class A
    const resDelta1 = await query("SELECT * FROM app.find_sibling_radios('00:30:44:FF:D0:10')");
    const siblingDelta1 = resDelta1.rows.find((r) => r.sibling_bssid === '00:30:44:FF:D0:11');
    expect(siblingDelta1).toBeDefined();
    expect(siblingDelta1.rule).toBe('Class A');
    expect(siblingDelta1.d_last_octet).toBe(1);

    // Assert Delta 2 pairs under Class A
    const resDelta2 = await query("SELECT * FROM app.find_sibling_radios('00:30:44:FF:D0:20')");
    const siblingDelta2 = resDelta2.rows.find((r) => r.sibling_bssid === '00:30:44:FF:D0:22');
    expect(siblingDelta2).toBeDefined();
    expect(siblingDelta2.rule).toBe('Class A');
    expect(siblingDelta2.d_last_octet).toBe(2);

    // Assert Delta 3 pairs under Class A
    const resDelta3 = await query("SELECT * FROM app.find_sibling_radios('00:30:44:FF:D0:30')");
    const siblingDelta3 = resDelta3.rows.find((r) => r.sibling_bssid === '00:30:44:FF:D0:33');
    expect(siblingDelta3).toBeDefined();
    expect(siblingDelta3.rule).toBe('Class A');
    expect(siblingDelta3.d_last_octet).toBe(3);

    // Assert Delta 4 returns no sibling
    const resDelta4 = await query("SELECT * FROM app.find_sibling_radios('00:30:44:FF:D0:40')");
    const siblingDelta4 = resDelta4.rows.find((r) => r.sibling_bssid === '00:30:44:FF:D0:44');
    expect(siblingDelta4).toBeUndefined();
  });

  // ── Xfinity/Vantiva Sibling Hardening Tests ─────────────────────────────────
  test('Xfinity LAA: rejects cross-chassis Class B bridge (D2:2D:B4 ↔ D9:2D:B4)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('4A:BD:CE:D2:2D:B4')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '4A:BD:CE:D9:2D:B4');
    expect(sibling).toBeUndefined(); // Bridging different chassis is rejected
  });

  test('Xfinity LAA: preserves valid same-chassis Class A pairing (D9:2D:B2 ↔ D9:2D:B4)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('4A:BD:CE:D9:2D:B4')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '4A:BD:CE:D9:2D:B2');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Unnamed Recursive (Class A)');
  });

  test('Xfinity LAA: preserves valid same-chassis Class A pairing (D9:2D:B6 ↔ D9:2D:B4)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('4A:BD:CE:D9:2D:B4')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '4A:BD:CE:D9:2D:B6');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Unnamed Recursive (Class A)');
  });

  // ── GM Vehicle Hotspot Hardening Tests ──────────────────────────────────────
  test('GM Vehicle Hotspots: rejects myChevrolet ↔ myBuick bridges', async () => {
    const res1 = await query("SELECT * FROM app.find_sibling_radios('02:92:A5:1A:AF:17')");
    const sibling1 = res1.rows.find((r) => r.sibling_bssid === '02:92:A5:1A:CB:17');
    expect(sibling1).toBeUndefined(); // Different SSIDs: myChevrolet vs myBuick

    const res2 = await query("SELECT * FROM app.find_sibling_radios('02:92:A5:12:AF:17')");
    const sibling2 = res2.rows.find((r) => r.sibling_bssid === '02:92:A5:12:CB:17');
    expect(sibling2).toBeUndefined();
  });

  test('GM Vehicle Hotspots: rejects same final-octet cross-vehicle bridges', async () => {
    const res1 = await query("SELECT * FROM app.find_sibling_radios('02:92:A5:12:CB:17')");
    const sibling1 = res1.rows.find((r) => r.sibling_bssid === '02:92:A5:1A:CB:17');
    expect(sibling1).toBeUndefined(); // Different vehicle (same last octet, different middle)

    const res2 = await query("SELECT * FROM app.find_sibling_radios('02:92:A5:12:AF:17')");
    const sibling2 = res2.rows.find((r) => r.sibling_bssid === '02:92:A5:1A:AF:17');
    expect(sibling2).toBeUndefined();
  });

  test('GM Vehicle Hotspots: preserves valid same-vehicle pairing (02:92:A5:12:AF:17 ↔ 02:92:A5:12:AF:18)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('02:92:A5:12:AF:17')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '02:92:A5:12:AF:18');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('GM Vehicle Hotspot Seq (Class A)');
  });

  test('GM Vehicle Hotspots: preserves valid same-vehicle global OUI pairing (00:92:A5:A5:54:F8 ↔ 00:92:A5:A5:54:F9)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:92:A5:A5:54:F8')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:92:A5:A5:54:F9');
    expect(sibling).toBeDefined();
  });

  test('GM Vehicle Hotspots: rejects cross-vehicle global OUI pair with different SSIDs (00:92:A5:A5:54:F9 ↔ 00:92:A5:A5:6A:F9)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('00:92:A5:A5:54:F9')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '00:92:A5:A5:6A:F9');
    expect(sibling).toBeUndefined(); // Different SSIDs: myChevrolet1234 vs myChevrolet5678
  });

  // ── Netgear Dual-Band Sibling Rule Tests ────────────────────────────────────
  test('Netgear Dual-Band: preserves same-chassis pairing within delta 3 on byte 4 with same byte 6 (6C:CD:D6:35:CE:CC ↔ 6C:CD:D6:38:3F:CC)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('6C:CD:D6:35:CE:CC')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '6C:CD:D6:38:3F:CC');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Netgear Dual-Band (Class A)');
  });

  test('Netgear Dual-Band Negative: mismatching last octet does not pair (6C:CD:D6:35:CE:CC ↔ 6C:CD:D6:35:CF:CD)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('6C:CD:D6:35:CE:CC')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '6C:CD:D6:35:CF:CD');
    expect(sibling).toBeUndefined();
  });

  // ── Arcadyan HOME-EE7D Sibling Rule Tests ────────────────────────────────────
  test('Arcadyan HOME-EE7D: preserves same-chassis global-to-LAA and LAA-to-LAA pairings', async () => {
    // global to LAA
    const res1 = await query("SELECT * FROM app.find_sibling_radios('5C:B0:66:EB:E1:C1')");
    const sibling1 = res1.rows.find((r) => r.sibling_bssid === '7E:B0:66:EB:E1:C1');
    expect(sibling1).toBeDefined();
    expect(sibling1.rule).toBe('Arcadyan HOME-EE7D (Class A)');

    // LAA to LAA cross-band delta <= 7
    const res2 = await query("SELECT * FROM app.find_sibling_radios('7E:B0:66:EB:E1:C1')");
    const sibling2 = res2.rows.find((r) => r.sibling_bssid === '9E:B0:66:EB:E1:C2');
    expect(sibling2).toBeDefined();
    expect(sibling2.rule).toBe('Arcadyan HOME-EE7D (Class A)');
  });

  test('Arcadyan HOME-EE7D Negative: mismatching byte 2 does not pair (5C:B0:66:EB:E1:C1 ↔ 5C:BF:66:EB:E1:C1)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('5C:B0:66:EB:E1:C1')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '5C:BF:66:EB:E1:C1');
    expect(sibling).toBeUndefined();
  });

  // ── Ubiquiti UniFi VAP Sibling Rule Tests ────────────────────────────────────
  test('Ubiquiti VAPs: preserves same-chassis cross-band pairing with different fourth octets (F6:E2:C6:16:6E:F5 ↔ F6:E2:C6:86:6E:F5)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('F6:E2:C6:16:6E:F5')");
    const sibling = res.rows.find((r) => r.sibling_bssid === 'F6:E2:C6:86:6E:F5');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Ubiquiti UniFi VAP (Class A)');
  });

  test('Ubiquiti VAPs: preserves same-chassis global-to-LAA cross-band pairing (F4:E2:C6:46:6E:F5 ↔ F6:E2:C6:E6:6E:F5)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('F4:E2:C6:46:6E:F5')");
    const sibling = res.rows.find((r) => r.sibling_bssid === 'F6:E2:C6:E6:6E:F5');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Ubiquiti UniFi VAP (Class A)');
  });

  test('Ubiquiti VAPs Negative: mismatching suffix must not pair (F6:E2:C6:16:6E:F5 ↔ F6:E2:C6:16:8A:F2)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('F6:E2:C6:16:6E:F5')");
    const sibling = res.rows.find((r) => r.sibling_bssid === 'F6:E2:C6:16:8A:F2');
    expect(sibling).toBeUndefined();
  });

  test('Ubiquiti VAPs Negative: mismatching fourth-octet lower nibble must not pair (F6:E2:C6:16:6E:F5 ↔ F6:E2:C6:15:6E:F5)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('F6:E2:C6:16:6E:F5')");
    const sibling = res.rows.find((r) => r.sibling_bssid === 'F6:E2:C6:15:6E:F5');
    expect(sibling).toBeUndefined();
  });

  // ── Mist Systems VAP Sibling Rule Tests ────────────────────────────────────
  test('Mist VAPs: preserves same-chassis pairing within delta 18 (D4:20:B0:9C:8F:E2 ↔ D4:20:B0:9C:8F:F3)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('D4:20:B0:9C:8F:E2')");
    const sibling = res.rows.find((r) => r.sibling_bssid === 'D4:20:B0:9C:8F:F3');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Mist Systems VAP (Class A)');
  });

  test('Mist VAPs Negative: fifth-octet variation does not match (D4:20:B0:9C:8F:E2 ↔ D4:20:B0:9C:8A:F3)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('D4:20:B0:9C:8F:E2')");
    const sibling = res.rows.find((r) => r.sibling_bssid === 'D4:20:B0:9C:8A:F3');
    expect(sibling).toBeUndefined();
  });

  // ── LAA Generic Fallback Class A Hardening Tests ─────────────────────────────
  test('LAA Hardening Negative: generic LAA Class A fallback blocks delta 16 bridge (F6:EE:EE:64:94:0C ↔ 02/F4:EE:EE:64:94:1C)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('F6:EE:EE:64:94:0C')");
    const sibling1 = res.rows.find((r) => r.sibling_bssid === '02:EE:EE:64:94:1C');
    const sibling2 = res.rows.find((r) => r.sibling_bssid === 'F4:EE:EE:64:94:1C');
    expect(sibling1).toBeUndefined(); // delta 16 is rejected
    expect(sibling2).toBeUndefined(); // delta 16 is rejected
  });

  test('LAA Hardening Positive: generic LAA Class A fallback preserves delta <= 7 pairing (F6:EE:EE:64:94:0C ↔ 02:EE:EE:64:94:0D)', async () => {
    const res = await query("SELECT * FROM app.find_sibling_radios('F6:EE:EE:64:94:0C')");
    const sibling = res.rows.find((r) => r.sibling_bssid === '02:EE:EE:64:94:0D');
    expect(sibling).toBeDefined();
    expect(sibling.rule).toBe('Unnamed Recursive (Class A)');
    expect(sibling.d_last_octet).toBe(1);
  });

  test('LAA Hardening Live Regression: YMCA DT-Public must NOT pair with Whaley access points', async () => {
    // Check if the live BSSIDs are in the networks database
    const networkCheck = await query(
      "SELECT bssid FROM app.networks WHERE bssid = 'F6:92:BF:64:94:0C'"
    );
    if (networkCheck.rowCount && networkCheck.rowCount > 0) {
      const res = await query("SELECT * FROM app.find_sibling_radios('F6:92:BF:64:94:0C')");
      const sibling1 = res.rows.find((r) => r.sibling_bssid === '02:92:BF:64:94:1C');
      const sibling2 = res.rows.find((r) => r.sibling_bssid === 'F4:92:BF:64:94:1C');
      expect(sibling1).toBeUndefined(); // F6:92:BF:64:94:0C ↔ 02:92:BF:64:94:1C is blocked
      expect(sibling2).toBeUndefined(); // F6:92:BF:64:94:0C ↔ F4:92:BF:64:94:1C is blocked
    }
  });
});
