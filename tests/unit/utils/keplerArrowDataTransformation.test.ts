import { tableFromArrays, tableToIPC } from 'apache-arrow';
import { mapKeplerArrowToNetworkData } from '../../../client/src/utils/keplerArrowDataTransformation';

describe('mapKeplerArrowToNetworkData', () => {
  it('maps Arrow columns to network data and derives UTC time bounds', () => {
    const table = tableFromArrays({
      id: [1n, 2n],
      lon: [-83.7, -83.6],
      lat: [43.0, 43.1],
      level: [-55, -72],
      observed_at_ms: [1000n, 3000n],
      bssid: ['00:11:22:33:44:55', '00:11:22:33:44:55'],
      ssid: ['Network', 'Network'],
    });
    const buffer = tableToIPC(table, 'stream');
    const arrayBuffer = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(arrayBuffer).set(buffer);

    const result = mapKeplerArrowToNetworkData(arrayBuffer);

    expect(result.networkData).toHaveLength(2);
    expect(result.networkData[0]).toEqual(
      expect.objectContaining({
        id: '1',
        position: [-83.7, 43.0],
        bssid: '00:11:22:33:44:55',
        ssid: 'Network',
        level: -55,
        observed_at_ms: 1000,
        timestamp: new Date(1000).toISOString(),
      })
    );
    expect(result.timeBounds).toEqual({ min: 1000, max: 3000 });
    expect(result.uniqueNetworks).toBe(1);
  });
});
