import { existsSync, readFileSync, writeFileSync } from 'fs';

const mockGet = jest.fn();
jest.mock('https', () => ({
  get: mockGet,
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe('geocode-batch', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;
  let timeoutSpy: jest.SpyInstance;
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((code?: number | string | null | undefined) => {
        throw new Error(`process.exit called with ${code}`);
      });
    timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
      fn();
      return 0 as any;
    });
    originalArgv = [...process.argv];
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
    timeoutSpy.mockRestore();
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  it('exits if MAPBOX_TOKEN is missing', () => {
    delete process.env.MAPBOX_TOKEN;

    jest.isolateModules(() => {
      expect(() => {
        require('../../../scripts/geocoding/geocode-batch');
      }).toThrow('process.exit called with 1');
    });

    expect(errorSpy).toHaveBeenCalledWith('❌ MAPBOX_TOKEN not found in .env');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits if input file does not exist', async () => {
    process.env.MAPBOX_TOKEN = 'mock-token';
    process.argv = ['node', 'script.js', 'missing.csv'];
    (existsSync as jest.Mock).mockReturnValue(false);

    jest.isolateModules(() => {
      require('../../../scripts/geocoding/geocode-batch');
    });

    await new Promise(process.nextTick);

    expect(errorSpy).toHaveBeenCalledWith('❌ Input file not found: missing.csv');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('geocodes batch of addresses and writes outputs, covering success, empty features, errors, and progress logging', async () => {
    process.env.MAPBOX_TOKEN = 'mock-token';
    process.argv = ['node', 'script.js', 'input.txt', 'output.csv'];
    (existsSync as jest.Mock).mockReturnValue(true);

    // Make 100 addresses to test the modulo 100 log statement
    const addresses = Array.from({ length: 100 }, (_, i) => `Address ${i + 1}`);
    const inputContent = addresses.join('\n');
    (readFileSync as jest.Mock).mockReturnValue(inputContent);

    // Mock geocoding behavior:
    // - Even indexes (0, 2, ...): Success
    // - Index 1: Empty features
    // - Index 3: HTTP call throws an error
    // - Others: Success
    mockGet.mockImplementation((url, cb) => {
      // Decode address from url to identify which index it is
      const match = url.match(/mapbox\.places\/(Address%20\d+)\.json/);
      if (!match) {
        throw new Error('Unexpected URL format');
      }
      const addrName = decodeURIComponent(match[1]);
      const index = parseInt(addrName.split(' ')[1], 10) - 1;

      if (index === 1) {
        // Empty features
        const mockRes = {
          on: (event: string, handler: any) => {
            if (event === 'data') {
              handler(JSON.stringify({ features: [] }));
            } else if (event === 'end') {
              handler();
            }
          },
        };
        cb(mockRes);
        return { on: jest.fn().mockReturnThis() };
      } else if (index === 3) {
        // Network error
        const mockReq = {
          on: (event: string, handler: any) => {
            if (event === 'error') {
              process.nextTick(() => handler(new Error('Mapbox request failed')));
            }
            return mockReq;
          },
        };
        return mockReq;
      } else {
        // Successful response
        const mockRes = {
          on: (event: string, handler: any) => {
            if (event === 'data') {
              handler(
                JSON.stringify({
                  features: [
                    {
                      center: [-83.0 + index * 0.01, 42.0 + index * 0.01],
                      place_name: `Full ${addrName}`,
                    },
                  ],
                })
              );
            } else if (event === 'end') {
              handler();
            }
          },
        };
        cb(mockRes);
        return { on: jest.fn().mockReturnThis() };
      }
    });

    let resolveWrite: (data: string) => void;
    const writePromise = new Promise<string>((resolve) => {
      resolveWrite = resolve;
    });
    (writeFileSync as jest.Mock).mockImplementation((file, data) => {
      resolveWrite(data);
    });

    jest.isolateModules(() => {
      require('../../../scripts/geocoding/geocode-batch');
    });

    const writtenData = await writePromise;

    // Verify file I/O calls
    expect(existsSync).toHaveBeenCalledWith('input.txt');
    expect(readFileSync).toHaveBeenCalledWith('input.txt', 'utf8');

    // 100 total, index 1 empty features, index 3 error, so 98 successful
    expect(logSpy).toHaveBeenCalledWith('  ✓ 100/100 (98 successful)');
    expect(logSpy).toHaveBeenCalledWith('\n✅ Complete: 98/100 addresses geocoded');
    expect(logSpy).toHaveBeenCalledWith('📄 Results saved to: output.csv');
    expect(errorSpy).toHaveBeenCalledWith('Error geocoding "Address 4":', 'Mapbox request failed');

    // Check formatting of the written output for the mock cases
    const lines = writtenData.split('\n');
    expect(lines[0]).toBe('address,lat,lon,full_address');
    // Index 0: Address 1 -> Success
    expect(lines[1]).toBe('"Address 1",42,-83,"Full Address 1"');
    // Index 1: Address 2 -> Empty features
    expect(lines[2]).toBe('"Address 2",,,');
    // Index 3: Address 4 -> Error
    expect(lines[4]).toBe('"Address 4",,,');
  });
});
