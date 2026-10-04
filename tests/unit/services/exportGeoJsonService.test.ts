export {};

const { EventEmitter } = require('events');
const {
  formatGeoJsonFeature,
  streamAllObservationsGeoJson,
} = require('../../../server/src/services/exportService');
const exportRepository = require('../../../server/src/repositories/exportRepository');

jest.mock('../../../server/src/repositories/exportRepository', () => ({
  acquireExportClient: jest.fn(),
  streamObservationsForGeoJSON: jest.fn(),
  queryObservationsForCSV: jest.fn(),
  queryObservationsForJSON: jest.fn(),
  queryNetworksForJSON: jest.fn(),
  queryObservationsForGeoJSON: jest.fn(),
  queryAppTableNames: jest.fn(),
  queryTableRowCount: jest.fn(),
  queryTableRows: jest.fn(),
  queryObservationsForKML: jest.fn(),
}));

describe('GeoJSON Export Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    exportRepository.acquireExportClient.mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    });
  });

  describe('formatGeoJsonFeature', () => {
    it('creates a Feature with Point geometry in [lon, lat] order for valid coordinates', () => {
      const row = {
        bssid: 'AA:BB:CC:DD:EE:FF',
        ssid: 'TestNetwork',
        latitude: 38.8951,
        longitude: -77.0364,
        signal_dbm: -65,
        observed_at: '2026-10-04T00:00:00.000Z',
        radio_type: 'W',
        frequency: 2412,
        capabilities: '[WPA2-PSK-CCMP][ESS]',
        accuracy: 10.5,
      };

      const feature = formatGeoJsonFeature(row);

      expect(feature.type).toBe('Feature');
      expect(feature.geometry).toEqual({
        type: 'Point',
        coordinates: [-77.0364, 38.8951], // lon, lat order!
      });
      expect(feature.properties).toEqual({
        bssid: 'AA:BB:CC:DD:EE:FF',
        ssid: 'TestNetwork',
        signal_dbm: -65,
        observed_at: '2026-10-04T00:00:00.000Z',
        radio_type: 'W',
        frequency: 2412,
        capabilities: '[WPA2-PSK-CCMP][ESS]',
        accuracy: 10.5,
      });
    });

    it('sets geometry to null when latitude or longitude is null or undefined', () => {
      const rowNull = {
        bssid: 'AA:BB:CC:DD:EE:FF',
        ssid: 'TestNet',
        latitude: null,
        longitude: null,
        signal_dbm: -70,
        observed_at: null,
        radio_type: null,
        frequency: null,
        capabilities: null,
        accuracy: null,
      };

      const featureNull = formatGeoJsonFeature(rowNull);
      expect(featureNull.geometry).toBeNull();
      expect(featureNull.properties.bssid).toBe('AA:BB:CC:DD:EE:FF');

      const rowUndef = {
        bssid: '11:22:33:44:55:66',
        ssid: 'TestNet2',
        latitude: undefined,
        longitude: undefined,
        signal_dbm: null,
        observed_at: null,
        radio_type: null,
        frequency: null,
        capabilities: null,
        accuracy: null,
      };

      const featureUndef = formatGeoJsonFeature(rowUndef);
      expect(featureUndef.geometry).toBeNull();
    });

    it('sets geometry to null when coordinates are non-finite (NaN, Infinity, -Infinity)', () => {
      const rowNaN = {
        latitude: NaN,
        longitude: -77.0,
      };
      expect(formatGeoJsonFeature(rowNaN).geometry).toBeNull();

      const rowInf = {
        latitude: 38.0,
        longitude: Infinity,
      };
      expect(formatGeoJsonFeature(rowInf).geometry).toBeNull();

      const rowNegInf = {
        latitude: -Infinity,
        longitude: -77.0,
      };
      expect(formatGeoJsonFeature(rowNegInf).geometry).toBeNull();
    });

    it('sets geometry to null when coordinates are out of standard WGS84 range', () => {
      // Latitude valid range is [-90, 90]
      expect(formatGeoJsonFeature({ latitude: 91, longitude: 0 }).geometry).toBeNull();
      expect(formatGeoJsonFeature({ latitude: -90.1, longitude: 0 }).geometry).toBeNull();

      // Longitude valid range is [-180, 180]
      expect(formatGeoJsonFeature({ latitude: 0, longitude: 180.5 }).geometry).toBeNull();
      expect(formatGeoJsonFeature({ latitude: 0, longitude: -181 }).geometry).toBeNull();
    });

    it('parses valid numeric string coordinates', () => {
      const row = {
        latitude: '38.8951',
        longitude: '-77.0364',
      };
      const feature = formatGeoJsonFeature(row as any);
      expect(feature.geometry).toEqual({
        type: 'Point',
        coordinates: [-77.0364, 38.8951],
      });
    });

    it('preserves all export property fields and skips none silently', () => {
      const row = {
        bssid: '00:11:22:33:44:55',
        ssid: 'OpenWifi',
        latitude: 10,
        longitude: 20,
        signal_dbm: -50,
        observed_at: '2026-05-01T12:00:00Z',
        radio_type: 'W',
        frequency: 5180,
        capabilities: '[ESS]',
        accuracy: 3.2,
      };

      const feature = formatGeoJsonFeature(row);
      expect(Object.keys(feature.properties).sort()).toEqual([
        'accuracy',
        'bssid',
        'capabilities',
        'frequency',
        'observed_at',
        'radio_type',
        'signal_dbm',
        'ssid',
      ]);
    });
  });

  describe('streamAllObservationsGeoJson', () => {
    function createMockResponse() {
      let output = '';
      const headers: Record<string, string> = {};
      const emitter = new EventEmitter();
      const res: any = Object.assign(emitter, {
        headersSent: false,
        writableEnded: false,
        destroyed: false,
        setHeader: jest.fn((key: string, value: string) => {
          headers[key.toLowerCase()] = value;
        }),
        writeHead: jest.fn((status: number, hdrs: any) => {
          res.headersSent = true;
          Object.assign(headers, hdrs);
        }),
        write: jest.fn((chunk: string) => {
          res.headersSent = true;
          output += chunk;
          return true; // no backpressure in unit test default
        }),
        end: jest.fn(() => {
          res.writableEnded = true;
        }),
        destroy: jest.fn((_err?: any) => {
          res.destroyed = true;
        }),
        getOutput: () => output,
        getHeaders: () => headers,
      });
      return res;
    }

    it('streams a valid FeatureCollection with features and sets application/geo+json headers', async () => {
      const rowsBatch1 = [
        {
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'Net1',
          latitude: 38.0,
          longitude: -77.0,
          signal_dbm: -60,
          observed_at: '2026-01-01',
          radio_type: 'W',
          frequency: 2412,
          capabilities: null,
          accuracy: 5,
        },
      ];
      const rowsBatch2 = [
        {
          bssid: '11:22:33:44:55:66',
          ssid: 'Net2',
          latitude: null, // null-geometry
          longitude: null,
          signal_dbm: -80,
          observed_at: '2026-01-02',
          radio_type: 'E',
          frequency: null,
          capabilities: null,
          accuracy: null,
        },
      ];

      async function* mockGenerator() {
        yield rowsBatch1;
        yield rowsBatch2;
      }
      exportRepository.streamObservationsForGeoJSON.mockImplementation(mockGenerator);

      const res = createMockResponse();
      const result = await streamAllObservationsGeoJson(res);

      expect(result.totalRows).toBe(2);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/geo+json');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="shadowcheck_observations_all_')
      );
      expect(res.end).toHaveBeenCalled();

      const parsed = JSON.parse(res.getOutput());
      expect(parsed.type).toBe('FeatureCollection');
      expect(parsed.features).toHaveLength(2);
      expect(parsed.features[0].geometry).toEqual({
        type: 'Point',
        coordinates: [-77.0, 38.0],
      });
      expect(parsed.features[1].geometry).toBeNull();
      expect(parsed.features[1].properties.bssid).toBe('11:22:33:44:55:66');
    });

    it('streams a valid empty FeatureCollection when no records exist', async () => {
      async function* emptyGenerator() {
        // yields nothing
      }
      exportRepository.streamObservationsForGeoJSON.mockImplementation(emptyGenerator);

      const res = createMockResponse();
      const result = await streamAllObservationsGeoJson(res);

      expect(result.totalRows).toBe(0);
      expect(res.end).toHaveBeenCalled();

      const parsed = JSON.parse(res.getOutput());
      expect(parsed).toEqual({
        type: 'FeatureCollection',
        features: [],
      });
    });

    it('destroys response mid-stream on generator error after headers are sent', async () => {
      async function* failingGenerator() {
        yield [{ bssid: 'AA:BB:CC:DD:EE:FF', latitude: 10, longitude: 20 }];
        throw new Error('Database connection lost mid-stream');
      }
      exportRepository.streamObservationsForGeoJSON.mockImplementation(failingGenerator);

      const res = createMockResponse();

      await expect(streamAllObservationsGeoJson(res)).rejects.toThrow(
        'Database connection lost mid-stream'
      );
      expect(res.destroy).toHaveBeenCalled();
    });

    it('throws before setting headers or writing anything when pool client acquisition fails', async () => {
      exportRepository.acquireExportClient.mockRejectedValueOnce(
        new Error('Connection pool exhausted')
      );
      const res = createMockResponse();

      await expect(streamAllObservationsGeoJson(res)).rejects.toThrow('Connection pool exhausted');
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.write).not.toHaveBeenCalled();
      expect(res.headersSent).toBe(false);
    });

    it('resolves cleanly without hanging when client disconnects (close) during backpressure drain wait', async () => {
      // Mock data: 2 batches of 1 observation each
      const batch1 = [{ bssid: 'AA:BB:CC:DD:EE:FF', latitude: 10, longitude: 20 }];
      const batch2 = [{ bssid: '11:22:33:44:55:66', latitude: 11, longitude: 21 }];
      async function* mockGenerator() {
        yield batch1;
        yield batch2;
      }
      exportRepository.streamObservationsForGeoJSON.mockImplementation(mockGenerator);

      const res = createMockResponse();
      let writeCount = 0;
      let blockedOnDrain = false;
      let closeFiredWhileBlocked = false;

      res.write = jest.fn((_chunk: string) => {
        writeCount++;
        // Write 1 is collection header; Write 2 is batch 1 (trigger backpressure)
        if (writeCount === 2) {
          setTimeout(() => {
            // Confirm the stream actually blocked awaiting drain before close was emitted
            if (blockedOnDrain) {
              closeFiredWhileBlocked = true;
            }
            res.destroyed = true;
            res.emit('close');
          }, 20);
          return false;
        }
        return true;
      });

      const abortController = new AbortController();
      const streamPromise = streamAllObservationsGeoJson(res, abortController.signal);
      blockedOnDrain = true;

      const result = await streamPromise;

      expect(closeFiredWhileBlocked).toBe(true);
      // Because disconnect occurred during write 2 (batch 1), batch 1 was not fully written.
      // Assert totalRows == rows fully written (0):
      expect(result.totalRows).toBe(0);
    });

    it('resolves cleanly without hanging when stream error occurs during backpressure drain wait', async () => {
      const batch1 = [{ bssid: 'AA:BB:CC:DD:EE:FF', latitude: 10, longitude: 20 }];
      const batch2 = [{ bssid: '11:22:33:44:55:66', latitude: 11, longitude: 21 }];
      async function* mockGenerator() {
        yield batch1;
        yield batch2;
      }
      exportRepository.streamObservationsForGeoJSON.mockImplementation(mockGenerator);

      const res = createMockResponse();
      let writeCount = 0;
      let blockedOnDrain = false;
      let errorFiredWhileBlocked = false;

      res.write = jest.fn((_chunk: string) => {
        writeCount++;
        if (writeCount === 2) {
          setTimeout(() => {
            if (blockedOnDrain) {
              errorFiredWhileBlocked = true;
            }
            res.destroyed = true;
            res.emit('error', new Error('ECONNRESET'));
          }, 20);
          return false;
        }
        return true;
      });

      const abortController = new AbortController();
      const streamPromise = streamAllObservationsGeoJson(res, abortController.signal);
      blockedOnDrain = true;

      const result = await streamPromise;

      expect(errorFiredWhileBlocked).toBe(true);
      expect(result.totalRows).toBe(0);
    });

    it('aborts cleanly when drain wait exceeds stall timeout (60s)', async () => {
      async function* mockGenerator() {
        yield [{ bssid: 'AA:BB:CC:DD:EE:FF', latitude: 10, longitude: 20 }];
      }
      exportRepository.streamObservationsForGeoJSON.mockImplementation(mockGenerator);

      const res = createMockResponse();
      let writeCount = 0;
      res.write = jest.fn((_chunk: string) => {
        writeCount++;
        if (writeCount === 2) {
          // Trigger backpressure and simulate stalled client (no drain, no close)
          return false;
        }
        return true;
      });

      // Pass drainTimeoutMs = 50ms for fast test execution
      const result = await streamAllObservationsGeoJson(res, undefined, 5000, 50);

      expect(res.destroy).toHaveBeenCalled();
      expect(result.totalRows).toBe(0);
    });

    describe('pool client release semantics', () => {
      it('calls release exactly once when aborted before opener write', async () => {
        const mockRelease = jest.fn();
        const mockClient = {
          query: jest.fn(),
          release: mockRelease,
        };
        exportRepository.acquireExportClient.mockResolvedValueOnce(mockClient);

        let generatorFinallyRan = false;
        async function* mockGenerator() {
          try {
            yield [{ bssid: 'AA:BB:CC:DD:EE:FF', latitude: 10, longitude: 20 }];
          } finally {
            generatorFinallyRan = true;
            mockClient.release();
          }
        }
        exportRepository.streamObservationsForGeoJSON.mockImplementation(mockGenerator);

        const abortController = new AbortController();
        abortController.abort(); // already aborted before opener write

        const res = createMockResponse();
        const result = await streamAllObservationsGeoJson(res, abortController.signal);

        expect(result.totalRows).toBe(0);
        expect(generatorFinallyRan).toBe(false); // confirms unstarted generator skipped its finally block
        expect(mockRelease).toHaveBeenCalledTimes(1);
      });

      it('calls release exactly once when setHeader throws', async () => {
        const mockRelease = jest.fn();
        const mockClient = {
          query: jest.fn(),
          release: mockRelease,
        };
        exportRepository.acquireExportClient.mockResolvedValueOnce(mockClient);

        let generatorFinallyRan = false;
        async function* mockGenerator() {
          try {
            yield [{ bssid: 'AA:BB:CC:DD:EE:FF', latitude: 10, longitude: 20 }];
          } finally {
            generatorFinallyRan = true;
            mockClient.release();
          }
        }
        exportRepository.streamObservationsForGeoJSON.mockImplementation(mockGenerator);

        const res = createMockResponse();
        res.setHeader = jest.fn(() => {
          throw new Error('Invalid header value');
        });

        await expect(streamAllObservationsGeoJson(res)).rejects.toThrow('Invalid header value');

        expect(generatorFinallyRan).toBe(false);
        expect(mockRelease).toHaveBeenCalledTimes(1);
      });

      it('calls release exactly once on normal completion', async () => {
        const mockRelease = jest.fn();
        const mockClient = {
          query: jest.fn(),
          release: mockRelease,
        };
        exportRepository.acquireExportClient.mockResolvedValueOnce(mockClient);

        async function* mockGenerator(client: any) {
          try {
            yield [{ bssid: 'AA:BB:CC:DD:EE:FF', latitude: 10, longitude: 20 }];
          } finally {
            client.release();
          }
        }
        exportRepository.streamObservationsForGeoJSON.mockImplementation(mockGenerator);

        const res = createMockResponse();
        const result = await streamAllObservationsGeoJson(res);

        expect(result.totalRows).toBe(1);
        expect(mockRelease).toHaveBeenCalledTimes(1);
      });

      it('calls release exactly once on mid-stream error', async () => {
        const mockRelease = jest.fn();
        const mockClient = {
          query: jest.fn(),
          release: mockRelease,
        };
        exportRepository.acquireExportClient.mockResolvedValueOnce(mockClient);

        async function* mockGenerator(client: any) {
          try {
            yield [{ bssid: 'AA:BB:CC:DD:EE:FF', latitude: 10, longitude: 20 }];
            throw new Error('Database error mid-stream');
          } finally {
            client.release();
          }
        }
        exportRepository.streamObservationsForGeoJSON.mockImplementation(mockGenerator);

        const res = createMockResponse();

        await expect(streamAllObservationsGeoJson(res)).rejects.toThrow(
          'Database error mid-stream'
        );
        expect(res.destroy).toHaveBeenCalled();
        expect(mockRelease).toHaveBeenCalledTimes(1);
      });

      it('calls release exactly once when client disconnects during backpressure drain wait', async () => {
        const mockRelease = jest.fn();
        const mockClient = {
          query: jest.fn(),
          release: mockRelease,
        };
        exportRepository.acquireExportClient.mockResolvedValueOnce(mockClient);

        async function* mockGenerator(client: any) {
          try {
            yield [{ bssid: 'AA:BB:CC:DD:EE:FF', latitude: 10, longitude: 20 }];
            yield [{ bssid: '11:22:33:44:55:66', latitude: 11, longitude: 21 }];
          } finally {
            client.release();
          }
        }
        exportRepository.streamObservationsForGeoJSON.mockImplementation(mockGenerator);

        const res = createMockResponse();
        let writeCount = 0;

        res.write = jest.fn((_chunk: string) => {
          writeCount++;
          if (writeCount === 2) {
            setTimeout(() => {
              res.destroyed = true;
              res.emit('close');
            }, 20);
            return false;
          }
          return true;
        });

        const abortController = new AbortController();
        const streamPromise = streamAllObservationsGeoJson(res, abortController.signal);
        const result = await streamPromise;

        expect(result.totalRows).toBe(0);
        expect(mockRelease).toHaveBeenCalledTimes(1);
      });

      it('does not double-release the client when the generator throws', async () => {
        const mockRelease = jest.fn();
        const mockClient = {
          query: jest.fn(),
          release: mockRelease,
        };
        exportRepository.acquireExportClient.mockResolvedValueOnce(mockClient);

        async function* mockGenerator(client: any) {
          try {
            yield [{ bssid: 'AA:BB:CC:DD:EE:FF', latitude: 10, longitude: 20 }];
            throw new Error('Commit failed: serialization failure');
          } finally {
            client.release();
          }
        }
        exportRepository.streamObservationsForGeoJSON.mockImplementationOnce(mockGenerator);

        const res = createMockResponse();

        await expect(streamAllObservationsGeoJson(res)).rejects.toThrow(
          'Commit failed: serialization failure'
        );
        expect(res.destroy).toHaveBeenCalled();
        expect(mockRelease).toHaveBeenCalledTimes(1);
      });
    });
  });
});
