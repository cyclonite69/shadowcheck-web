import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentProps } from 'react';
import { KmlImportCard } from '../../client/src/components/admin/tabs/data-import/KmlImportCard';
import type { KmlImportStatusResponse } from '../../client/src/types/kmlImport';

jest.mock('../../client/src/api/adminApi', () => ({
  adminApi: {
    getWigleKmlSyncStatus: jest.fn().mockResolvedValue({
      configured: false,
      supported: false,
      status: 'credentials_missing',
      message: 'WiGLE API credentials are not configured.',
      recommendation: 'Configure wigle_api_name and wigle_api_token in Settings.',
      localKml: {
        fileCount: 0,
        pointCount: 0,
        latestImportedAt: null,
      },
    }),
  },
}));

const status: KmlImportStatusResponse = {
  totals: {
    file_count: 234,
    point_count: 316445,
    wigle_file_count: 234,
    latest_imported_at: '2026-04-04T01:09:31.717Z',
  },
  files: [
    {
      id: 234,
      source_file: 'wigle_downloads/20260331-00449.kml',
      source_name: 'WiGLE_Upload-20260331-00449',
      source_type: 'wigle',
      file_hash: 'b0783e718afd0000000000000000000000000000000000000000000000000000',
      hash_prefix: 'b0783e718afd',
      placemark_count: 3597,
      point_count: 3597,
      imported_at: '2026-04-04T01:09:31.717Z',
    },
  ],
};

const renderCard = (overrides: Partial<ComponentProps<typeof KmlImportCard>> = {}) => {
  const props: ComponentProps<typeof KmlImportCard> = {
    isLoading: false,
    kmlImports: status,
    kmlImportsError: null,
    kmlImportsLoading: false,
    kmlImportStatus: '',
    onFilesChange: jest.fn(),
    onFolderChange: jest.fn(),
    onRefreshImports: jest.fn(),
    ...overrides,
  };

  return renderToStaticMarkup(React.createElement(KmlImportCard, props));
};

describe('KmlImportCard', () => {
  it('renders imported status totals', () => {
    const html = renderCard();

    expect(html).toContain('Imported KMLs');
    expect(html).toContain('234');
    expect(html).toContain('316,445');
  });

  it('renders recent imported files', () => {
    const html = renderCard();

    expect(html).toContain('wigle_downloads/20260331-00449.kml');
    expect(html).toContain('wigle');
    expect(html).toContain('b0783e718afd');
    expect(html).toContain('3,597');
  });

  it('renders duplicate skip status safely', () => {
    const html = renderCard({
      kmlImportStatus: 'Imported 0 KML file(s) into 0 staged points (1 duplicate skipped)',
    });

    expect(html).toContain('duplicate skipped');
  });
});

describe('KmlImportCard - WiGLE Remote Sync', () => {
  let useStateSpy: jest.SpyInstance;

  afterEach(() => {
    if (useStateSpy) {
      useStateSpy.mockRestore();
    }
    jest.clearAllMocks();
  });

  it('renders WiGLE Remote Sync section and loading state initially', () => {
    const html = renderCard();
    expect(html).toContain('WiGLE Remote Sync');
    expect(html).toContain('Loading sync status...');
  });

  it('renders credentials missing state safely', () => {
    let stateCall = 0;
    useStateSpy = jest.spyOn(React, 'useState').mockImplementation((init?: any): any => {
      stateCall++;
      if (stateCall === 1) {
        return [
          {
            configured: false,
            supported: false,
            status: 'credentials_missing' as const,
            message: 'WiGLE API credentials are not configured.',
            recommendation: 'Configure wigle_api_name and wigle_api_token in Settings.',
            localKml: {
              fileCount: 234,
              pointCount: 316445,
              latestImportedAt: '2026-04-04T01:09:31.717Z',
            },
          },
          jest.fn(),
        ];
      }
      return [init, jest.fn()];
    });

    const html = renderCard();
    expect(html).toContain('WiGLE Remote Sync');
    expect(html).toContain('Credentials');
    expect(html).toContain('Missing');
    expect(html).toContain('Remote Sync');
    expect(html).toContain('Unsupported');
    expect(html).toContain('WiGLE API credentials are not configured.');
  });

  it('renders unsupported state safely with credentials configured', () => {
    let stateCall = 0;
    useStateSpy = jest.spyOn(React, 'useState').mockImplementation((init?: any): any => {
      stateCall++;
      if (stateCall === 1) {
        return [
          {
            configured: true,
            supported: false,
            status: 'remote_listing_unsupported' as const,
            message: 'WiGLE remote listing is unsupported.',
            recommendation: 'Manual KML upload remains the supported path.',
            localKml: {
              fileCount: 234,
              pointCount: 316445,
              latestImportedAt: '2026-04-04T01:09:31.717Z',
            },
          },
          jest.fn(),
        ];
      }
      return [init, jest.fn()];
    });

    const html = renderCard();
    expect(html).toContain('WiGLE Remote Sync');
    expect(html).toContain('Credentials');
    expect(html).toContain('Configured');
    expect(html).toContain('Remote Sync');
    expect(html).toContain('Unsupported');
  });

  it('renders disabled buttons with tooltips when unsupported', () => {
    let stateCall = 0;
    useStateSpy = jest.spyOn(React, 'useState').mockImplementation((init?: any): any => {
      stateCall++;
      if (stateCall === 1) {
        return [
          {
            configured: true,
            supported: false,
            status: 'remote_listing_unsupported' as const,
            message: 'WiGLE remote listing is unsupported...',
            recommendation: 'Manual KML upload remains the supported path.',
            localKml: {
              fileCount: 234,
              pointCount: 316445,
              latestImportedAt: '2026-04-04T01:09:31.717Z',
            },
          },
          jest.fn(),
        ];
      }
      return [init, jest.fn()];
    });

    const html = renderCard();
    expect(html).toContain('disabled=""');
    expect(html).toContain('Check WiGLE');
    expect(html).toContain('Sync now');
    expect(html).toContain('title="WiGLE remote KML listing is unsupported in this version"');
    expect(html).toContain('title="WiGLE remote KML sync is unsupported in this version"');
  });

  it('renders active sync panel when supported is true', () => {
    let stateCall = 0;
    useStateSpy = jest.spyOn(React, 'useState').mockImplementation((init?: any): any => {
      stateCall++;
      if (stateCall === 1) {
        return [
          {
            configured: true,
            supported: true,
            status: 'ready' as const,
            message: 'WiGLE API remote sync is ready.',
            recommendation: '',
            localKml: {
              fileCount: 234,
              pointCount: 316445,
              latestImportedAt: '2026-04-04T01:09:31.717Z',
            },
          },
          jest.fn(),
        ];
      }
      return [init, jest.fn()];
    });

    const html = renderCard();
    expect(html).toContain('WiGLE Remote Sync');
    expect(html).toContain('Credentials');
    expect(html).toContain('Configured');
    expect(html).toContain('Remote Sync');
    expect(html).toContain('Supported');
    expect(html).toContain('Check WiGLE');
    expect(html).toContain('Dry Run');
    expect(html).toContain('Sync now');
    expect(html).toContain('Force reimport');
  });

  it('renders active sync panel with transactions history list', () => {
    let stateCall = 0;
    useStateSpy = jest.spyOn(React, 'useState').mockImplementation((init?: any): any => {
      stateCall++;
      // 1. syncStatus
      if (stateCall === 1) {
        return [
          {
            configured: true,
            supported: true,
            status: 'ready' as const,
            message: 'WiGLE API remote sync is ready.',
            recommendation: '',
            localKml: {
              fileCount: 234,
              pointCount: 316445,
              latestImportedAt: '2026-04-04T01:09:31.717Z',
            },
          },
          jest.fn(),
        ];
      }
      // 2. syncStatusLoading
      if (stateCall === 2) {
        return [false, jest.fn()];
      }
      // 3. syncStatusError
      if (stateCall === 3) {
        return [null, jest.fn()];
      }
      // 4. txs (inside WiGLEActiveSyncPanel)
      if (stateCall === 4) {
        return [
          [
            {
              transid: '20260529-00225',
              fileName: 'test-upload.kml',
              fileSize: 102400,
              fileLines: 1500,
              status: 'SUCCESS',
            },
          ],
          jest.fn(),
        ];
      }
      // 5. txsLoading
      if (stateCall === 5) {
        return [false, jest.fn()];
      }
      // 6. txsError
      if (stateCall === 6) {
        return [null, jest.fn()];
      }
      // 7. syncLoading
      if (stateCall === 7) {
        return [false, jest.fn()];
      }
      // 8. syncResult (null so we render the list)
      if (stateCall === 8) {
        return [null, jest.fn()];
      }
      // 9. force
      if (stateCall === 9) {
        return [false, jest.fn()];
      }

      return [init, jest.fn()];
    });

    const html = renderCard();
    expect(html).toContain('Check WiGLE');
    expect(html).toContain('Dry Run');
    expect(html).toContain('Sync now');
    expect(html).toContain('test-upload.kml');
    expect(html).toContain('100 KB');
    expect(html).toContain('1,500 lines');
  });

  it('renders active sync panel with sync execution results', () => {
    let stateCall = 0;
    useStateSpy = jest.spyOn(React, 'useState').mockImplementation((init?: any): any => {
      stateCall++;
      // 1. syncStatus
      if (stateCall === 1) {
        return [
          {
            configured: true,
            supported: true,
            status: 'ready' as const,
            message: 'WiGLE API remote sync is ready.',
            recommendation: '',
            localKml: {
              fileCount: 234,
              pointCount: 316445,
              latestImportedAt: '2026-04-04T01:09:31.717Z',
            },
          },
          jest.fn(),
        ];
      }
      // 2. syncStatusLoading
      if (stateCall === 2) {
        return [false, jest.fn()];
      }
      // 3. syncStatusError
      if (stateCall === 3) {
        return [null, jest.fn()];
      }
      // 4. txs (inside WiGLEActiveSyncPanel) - can be set
      if (stateCall === 4) {
        return [
          [
            {
              transid: '20260529-00225',
              fileName: 'test-upload.kml',
              fileSize: 102400,
              fileLines: 1500,
              status: 'SUCCESS',
            },
          ],
          jest.fn(),
        ];
      }
      // 5. txsLoading
      if (stateCall === 5) {
        return [false, jest.fn()];
      }
      // 6. txsError
      if (stateCall === 6) {
        return [null, jest.fn()];
      }
      // 7. syncLoading
      if (stateCall === 7) {
        return [false, jest.fn()];
      }
      // 8. syncResult
      if (stateCall === 8) {
        return [
          {
            ok: true,
            syncedCount: 1,
            skippedCount: 0,
            failedCount: 0,
            results: [
              {
                transid: '20260529-00225',
                fileName: 'test-upload.kml',
                status: 'imported',
                pointsImported: 1500,
              },
            ],
          },
          jest.fn(),
        ];
      }
      // 9. force
      if (stateCall === 9) {
        return [false, jest.fn()];
      }

      return [init, jest.fn()];
    });

    const html = renderCard();
    expect(html).toContain('Sync Execution Results');
    expect(html).toContain('imported');
    expect(html).toContain('(1500 pts)');
  });

  it('renders rate-limited and deferred sync results correctly', () => {
    let stateCall = 0;
    useStateSpy = jest.spyOn(React, 'useState').mockImplementation((init?: any): any => {
      stateCall++;
      // 1. syncStatus
      if (stateCall === 1) {
        return [
          {
            configured: true,
            supported: true,
            status: 'ready' as const,
            message: 'WiGLE API remote sync is ready.',
            recommendation: '',
            localKml: {
              fileCount: 234,
              pointCount: 316445,
              latestImportedAt: '2026-04-04T01:09:31.717Z',
            },
          },
          jest.fn(),
        ];
      }
      // 2. syncStatusLoading
      if (stateCall === 2) {
        return [false, jest.fn()];
      }
      // 3. syncStatusError
      if (stateCall === 3) {
        return [null, jest.fn()];
      }
      // 4. txs
      if (stateCall === 4) {
        return [
          [
            {
              transid: '20260529-00225',
              fileName: 'test-upload.kml',
              fileSize: 102400,
              fileLines: 1500,
              status: 'SUCCESS',
            },
          ],
          jest.fn(),
        ];
      }
      // 5. txsLoading
      if (stateCall === 5) {
        return [false, jest.fn()];
      }
      // 6. txsError
      if (stateCall === 6) {
        return [null, jest.fn()];
      }
      // 7. syncLoading
      if (stateCall === 7) {
        return [false, jest.fn()];
      }
      // 8. syncResult
      if (stateCall === 8) {
        return [
          {
            ok: false,
            syncedCount: 2,
            skippedCount: 1,
            failedCount: 0,
            deferredCount: 7,
            rateLimited: true,
            rateLimitMessage:
              'Deferred — WiGLE request budget exhausted. Try again after the request window resets.',
            results: [
              {
                transid: '20260529-00225',
                fileName: 'test-upload-1.kml',
                status: 'imported',
                pointsImported: 1500,
              },
              {
                transid: '20260529-00226',
                fileName: 'test-upload-2.kml',
                status: 'imported',
                pointsImported: 2000,
              },
              {
                transid: '20260529-00227',
                fileName: 'test-upload-3.kml',
                status: 'deferred',
                error: 'WiGLE request budget exhausted; remaining transactions deferred.',
              },
            ],
          },
          jest.fn(),
        ];
      }
      // 9. force
      if (stateCall === 9) {
        return [false, jest.fn()];
      }

      return [init, jest.fn()];
    });

    const html = renderCard();
    expect(html).toContain('Sync Execution Results');
    expect(html).toContain('Rate Limited');
    expect(html).toContain('Deferred — WiGLE request budget exhausted');
    expect(html).toContain('Deferred');
    expect(html).toContain('test-upload-3.kml');
    expect(html).toContain('deferred');
    expect(html).not.toContain('Warnings/Errors');
  });
});
