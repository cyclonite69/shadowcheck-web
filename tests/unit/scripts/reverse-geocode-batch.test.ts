import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as https from 'https';
import { reverseGeocode, main } from '../../../scripts/geocoding/reverse-geocode-batch';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('https');

describe('reverse-geocode-batch', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((code?: string | number | null | undefined): never => {
        throw new Error(`Process.exit called with: ${code}`);
      });
    originalArgv = [...process.argv];
    originalEnv = { ...process.env };
    process.env.MAPBOX_TOKEN = 'test-token';
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  const mockHttpsGet = (responseBody: string, statusCode = 200, error?: Error) => {
    return jest.spyOn(https, 'get').mockImplementation((url: any, cb?: any) => {
      const resMock: any = {
        statusCode,
        on: jest.fn((event, eventCb) => {
          if (event === 'data' && !error) {
            eventCb(responseBody);
          }
          if (event === 'end' && !error) {
            eventCb();
          }
          return resMock;
        }),
      };
      if (cb) {
        cb(resMock);
      }
      const reqMock: any = {
        on: jest.fn((event, eventCb) => {
          if (event === 'error' && error) {
            eventCb(error);
          }
          return reqMock;
        }),
      };
      return reqMock;
    });
  };

  describe('reverseGeocode', () => {
    it('returns place_name if Mapbox returns features', async () => {
      const mockJson = JSON.stringify({
        features: [{ place_name: '123 Main St, Springfield' }],
      });
      mockHttpsGet(mockJson);

      const result = await reverseGeocode('37.7749', '-122.4194', 'token');
      expect(result).toEqual({ address: '123 Main St, Springfield' });
    });

    it('returns address null if features is empty', async () => {
      const mockJson = JSON.stringify({ features: [] });
      mockHttpsGet(mockJson);

      const result = await reverseGeocode('37.7749', '-122.4194', 'token');
      expect(result).toEqual({ address: null });
    });

    it('rejects on HTTP error', async () => {
      mockHttpsGet('', 500, new Error('Network error'));
      await expect(reverseGeocode('37.7749', '-122.4194', 'token')).rejects.toThrow(
        'Network error'
      );
    });

    it('rejects on invalid JSON response', async () => {
      mockHttpsGet('invalid-json');
      await expect(reverseGeocode('37.7749', '-122.4194', 'token')).rejects.toThrow();
    });
  });

  describe('main', () => {
    it('fails if MAPBOX_TOKEN is missing', async () => {
      delete process.env.MAPBOX_TOKEN;
      await expect(main()).rejects.toThrow('Process.exit called with: 1');
      expect(errorSpy).toHaveBeenCalledWith('❌ MAPBOX_TOKEN not found in .env');
    });

    it('fails if INPUT_FILE does not exist', async () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      process.argv = ['node', 'script.js', 'missing.csv'];
      await expect(main()).rejects.toThrow('Process.exit called with: 1');
      expect(errorSpy).toHaveBeenCalledWith('❌ Input file not found: missing.csv');
    });

    it('returns early if INPUT_FILE is empty', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue('');
      process.argv = ['node', 'script.js', 'empty.csv', 'out.csv'];

      await main();
      expect(writeFileSync).toHaveBeenCalledWith('out.csv', 'address');
    });

    it('geocodes locations and writes to output file', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(
        'lat,lon,bssid\n42.12,-83.45,bssid-1\n42.13,-83.46,bssid-2\n'
      );
      process.argv = ['node', 'script.js', 'in.csv', 'out.csv'];

      const mockJson1 = JSON.stringify({ features: [{ place_name: 'Place A' }] });
      const mockJson2 = JSON.stringify({ features: [] });

      const _getSpy = jest
        .spyOn(https, 'get')
        .mockImplementationOnce((url: any, cb?: any) => {
          cb({
            on: (event: string, eventCb: any) => {
              if (event === 'data') {
                eventCb(mockJson1);
              }
              if (event === 'end') {
                eventCb();
              }
            },
          });
          return { on: jest.fn() } as any;
        })
        .mockImplementationOnce((url: any, cb?: any) => {
          cb({
            on: (event: string, eventCb: any) => {
              if (event === 'data') {
                eventCb(mockJson2);
              }
              if (event === 'end') {
                eventCb();
              }
            },
          });
          return { on: jest.fn() } as any;
        });

      await main();

      expect(writeFileSync).toHaveBeenCalledWith(
        'out.csv',
        'lat,lon,bssid,address\n42.12,-83.45,bssid-1,"Place A"\n42.13,-83.46,bssid-2,'
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Complete: 1/2 reverse geocoded')
      );
    });

    it('handles reverseGeocode throwing an error', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue('lat,lon,bssid\n42.12,-83.45,bssid-1\n');
      process.argv = ['node', 'script.js', 'in.csv', 'out.csv'];

      jest.spyOn(https, 'get').mockImplementation((_url: any, _cb?: any) => {
        const reqMock = {
          on: (event: string, eventCb: any) => {
            if (event === 'error') {
              eventCb(new Error('Network failure'));
            }
            return reqMock;
          },
        };
        return reqMock as any;
      });

      await main();

      expect(writeFileSync).toHaveBeenCalledWith(
        'out.csv',
        'lat,lon,bssid,address\n42.12,-83.45,bssid-1,'
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Complete: 0/1 reverse geocoded')
      );
    });
  });
});
