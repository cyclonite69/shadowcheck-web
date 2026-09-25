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

describe('geocode-addresses', () => {
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
        require('../../../scripts/geocoding/geocode-addresses');
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
      require('../../../scripts/geocoding/geocode-addresses');
    });

    await new Promise(process.nextTick);

    expect(errorSpy).toHaveBeenCalledWith('❌ Input file not found: missing.csv');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('geocodes addresses successfully, handles empty results and writes to output file', async () => {
    process.env.MAPBOX_TOKEN = 'mock-token';
    process.argv = ['node', 'script.js', 'input.csv', 'output.csv'];
    (existsSync as jest.Mock).mockReturnValue(true);

    const csvContent = `address,bssid
123 Main St,AA:BB:CC
456 Oak St,DD:EE:FF
789 Pine St,11:22:33
`;
    (readFileSync as jest.Mock).mockReturnValue(csvContent);

    // Mock different geocoding behaviors:
    // 1st: success, 2nd: empty result, 3rd: network error
    let reqCount = 0;
    mockGet.mockImplementation((url, cb) => {
      reqCount++;
      if (reqCount === 1) {
        const mockRes = {
          on: (event: string, handler: any) => {
            if (event === 'data') {
              handler(
                JSON.stringify({
                  features: [
                    {
                      center: [-83.45, 42.12],
                      place_name: '123 Main St, Detroit, MI',
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
      } else if (reqCount === 2) {
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
      } else {
        // Network error path
        const mockReq = {
          on: (event: string, handler: any) => {
            if (event === 'error') {
              process.nextTick(() => handler(new Error('Mapbox API failed')));
            }
            return mockReq;
          },
        };
        return mockReq;
      }
    });

    let resolveWrite: (val: string) => void;
    const writePromise = new Promise<string>((resolve) => {
      resolveWrite = resolve;
    });
    (writeFileSync as jest.Mock).mockImplementation((file, data) => {
      resolveWrite(data);
    });

    jest.isolateModules(() => {
      require('../../../scripts/geocoding/geocode-addresses');
    });

    const writtenData = await writePromise;

    expect(existsSync).toHaveBeenCalledWith('input.csv');
    expect(readFileSync).toHaveBeenCalledWith('input.csv', 'utf8');

    // 1st geocode success, 2nd empty (lat=null), 3rd error (lat=null)
    const expectedOutput = `address,bssid,latitude,longitude,geocoded_address
123 Main St,AA:BB:CC,42.12,-83.45,"123 Main St, Detroit, MI"
456 Oak St,DD:EE:FF,,,
789 Pine St,11:22:33,,,`;

    expect(writtenData).toBe(expectedOutput);
    expect(writeFileSync).toHaveBeenCalledWith('output.csv', expectedOutput);
    expect(logSpy).toHaveBeenCalledWith('\n✓ Complete: 1/3 geocoded');
    expect(errorSpy).toHaveBeenCalledWith('  ✗ Error: Mapbox API failed');
  });
});
