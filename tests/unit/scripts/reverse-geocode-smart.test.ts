import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as https from 'https';
import { roundCoord, reverseGeocode, main } from '../../../scripts/geocoding/reverse-geocode-smart';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('https');

describe('reverse-geocode-smart', () => {
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

  describe('roundCoord', () => {
    it('rounds numbers to precision of 4', () => {
      expect(roundCoord(42.123456)).toBe('42.1235');
      expect(roundCoord(42.12)).toBe('42.1200');
    });
  });

  describe('reverseGeocode', () => {
    it('returns place_name and venue if Mapbox returns features', async () => {
      const mockJson = JSON.stringify({
        features: [{ place_name: 'Smart St, City', text: 'Venue Name' }],
      });
      mockHttpsGet(mockJson);

      const result = await reverseGeocode(42.12, -83.45, 'token');
      expect(result).toEqual({ address: 'Smart St, City', venue: 'Venue Name' });
    });

    it('returns address null if no features found', async () => {
      mockHttpsGet(JSON.stringify({ features: [] }));
      const result = await reverseGeocode(42.12, -83.45, 'token');
      expect(result).toEqual({ address: null, venue: null });
    });

    it('rejects on network error', async () => {
      mockHttpsGet('', 500, new Error('Smart fail'));
      await expect(reverseGeocode(42.12, -83.45, 'token')).rejects.toThrow('Smart fail');
    });
  });

  describe('main', () => {
    it('fails if MAPBOX_TOKEN missing', async () => {
      delete process.env.MAPBOX_TOKEN;
      await expect(main()).rejects.toThrow('Process.exit called with: 1');
      expect(errorSpy).toHaveBeenCalledWith('❌ MAPBOX_TOKEN not found in .env');
    });

    it('fails if input file does not exist', async () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      process.argv = ['node', 'script.js', 'missing.csv'];
      await expect(main()).rejects.toThrow('Process.exit called with: 1');
      expect(errorSpy).toHaveBeenCalledWith('❌ Input file not found: missing.csv');
    });

    it('geocodes locations in smart concurrent mode', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue(
        'bssid,lat,lon\n"AA:BB:CC:DD:EE:FF",42.12,-83.45\n"11:22:33:44:55:66",42.13,-83.46\n'
      );
      process.argv = ['node', 'script.js', 'in.csv', 'out.csv'];

      const mockJson = JSON.stringify({
        features: [{ place_name: 'Smart St, Detroit', text: 'Detroit Venue' }],
      });
      mockHttpsGet(mockJson);

      await main();

      expect(writeFileSync).toHaveBeenCalledWith(
        'out.csv',
        'bssid,lat,lon,address,venue\n' +
          '"AA:BB:CC:DD:EE:FF",42.12,-83.45,"Smart St, Detroit","Detroit Venue"\n' +
          '"11:22:33:44:55:66",42.13,-83.46,"Smart St, Detroit","Detroit Venue"'
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Complete: 2/2 locations geocoded')
      );
    });

    it('handles lines with missing columns and filters them', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue('bssid,lat,lon\nAA:BB,,\n11:22,42.12,-83.45\n');
      process.argv = ['node', 'script.js', 'in.csv', 'out.csv'];

      const mockJson = JSON.stringify({
        features: [{ place_name: 'St A', text: 'Venue A' }],
      });
      mockHttpsGet(mockJson);

      await main();

      expect(writeFileSync).toHaveBeenCalledWith(
        'out.csv',
        'bssid,lat,lon,address,venue\n"11:22",42.12,-83.45,"St A","Venue A"'
      );
    });

    it('handles individual reverseGeocode error without crashing main', async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      (readFileSync as jest.Mock).mockReturnValue('bssid,lat,lon\n"AA:BB",42.12,-83.45\n');
      process.argv = ['node', 'script.js', 'in.csv', 'out.csv'];

      jest.spyOn(https, 'get').mockImplementation((_url: any, _cb?: any) => {
        const reqMock = {
          on: (event: string, eventCb: any) => {
            if (event === 'error') {
              eventCb(new Error('Fatal smart error'));
            }
            return reqMock;
          },
        };
        return reqMock as any;
      });

      await main();

      expect(writeFileSync).toHaveBeenCalledWith(
        'out.csv',
        'bssid,lat,lon,address,venue\n"AA:BB",42.12,-83.45,,'
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error geocoding AA:BB:'),
        'Fatal smart error'
      );
    });
  });
});
