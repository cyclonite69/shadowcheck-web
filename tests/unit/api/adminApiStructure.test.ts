/**
 * Characterization lock test for client/src/api/adminApi.ts
 *
 * Purpose: lock the module's export surface and function inventory so that
 * Stage 2 extraction refactors cannot silently drop methods or rename the
 * public interface without a test failure.
 *
 * Scope of this lock (Stage 1 — names only):
 *   - Checks that the adminApi export exists and all method names are present.
 *   - Does NOT verify method signatures, parameter types, or behavior.
 *   - No existing behavioral test covers this module.
 *
 * The audit tool (scripts/audit/architecture/inventory.ts) counts functions via
 * TypeScript AST (isFunctionDeclaration | isMethodDeclaration | isArrowFunction |
 * isFunctionExpression) at any nesting depth. The 69-function count includes:
 *   - 67 async methods on the adminApi object literal
 *   - 2 anonymous inline arrow callbacks inside parseImportResponse:
 *       response.json().catch(() => null)
 *       response.text().catch(() => '')
 *     These are unlockable by name; their containing method (parseImportResponse)
 *     is locked as part of the 67.
 *
 * Responsibility groupings (candidates for Stage 2 extraction):
 *   Users (4), Geocoding (5), ML (3), Settings/Keys (23), Import history/KML (7),
 *   Orphan networks (3), Import/FormData (4), PgAdmin (4), Backups (4),
 *   Geocoding cache (2), AWS (2), Network notes (4), API testing (2)
 *
 * Stage 1 Batch C — role lock only. Extraction deferred to Stage 2.
 */

// Force module scope
export {};

import fs from 'fs';
import path from 'path';

describe('adminApi module structure — Stage 1 role lock', () => {
  const filePath = path.resolve(process.cwd(), 'client/src/api/adminApi.ts');
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(filePath, 'utf8');
  });

  test('exports the adminApi object as the sole export', () => {
    expect(source).toContain('export const adminApi = {');
  });

  test('imports apiClient and the expected type dependencies', () => {
    expect(source).toContain("import { apiClient } from './client'");
    expect(source).toContain('import type { AdminRuntimeConfig, AdminUser }');
    expect(source).toContain('import type {');
    expect(source).toContain('KmlImportResult');
    expect(source).toContain('KmlImportStatusResponse');
    expect(source).toContain('WigleKmlSyncStatusResponse');
  });

  test('contains all 67 expected async methods on the adminApi object', () => {
    const expectedMethods = [
      // User management (4)
      'listUsers',
      'createUser',
      'setUserActive',
      'resetUserPassword',
      // Geocoding (5)
      'runGeocoding',
      'testGeocodingProvider',
      'getGeocodingDaemon',
      'startGeocodingDaemon',
      'stopGeocodingDaemon',
      // ML Training (3)
      'getMLStatus',
      'trainML',
      'scoreAll',
      // Settings / API keys (23)
      'saveMapboxToken',
      'saveMapboxUnlimited',
      'saveWigleToken',
      'saveGoogleMapsKey',
      'saveAwsRegion',
      'saveOpenCageKey',
      'saveGeocodioKey',
      'saveLocationIQKey',
      'saveSmartyKey',
      'saveHomeLocation',
      'getHomeLocation',
      'getMapboxToken',
      'getMapboxUnlimited',
      'getGoogleMapsKey',
      'getWigleToken',
      'getAwsSettings',
      'getOpenCageKey',
      'getGeocodioKey',
      'getLocationIQKey',
      'getSmartyKey',
      'getRuntimeConfig',
      'runLocalStackAction',
      'updateAdminSetting',
      // Import history & KML (7)
      'getImportHistory',
      'getKmlImports',
      'getWigleKmlSyncStatus',
      'getWigleKmlTransactions',
      'syncWigleKmls',
      'startMobileImport',
      'getDeviceSources',
      // Orphan networks (3)
      'getOrphanNetworks',
      'checkOrphanNetworkWigle',
      'promoteOrphanNetwork',
      // FormData imports — raw fetch (4)
      'parseImportResponse',
      'importSQLite',
      'importSQL',
      'importKml',
      // PgAdmin (4)
      'getPgAdminStatus',
      'startPgAdmin',
      'stopPgAdmin',
      'destroyPgAdmin',
      // Backups (4)
      'createBackup',
      'listS3Backups',
      'downloadS3Backup',
      'deleteS3Backup',
      // Geocoding cache (2)
      'getGeocodingStats',
      'requeueGeocodingFailed',
      // AWS (2)
      'getAwsOverview',
      'controlAwsInstance',
      // Network notes (4)
      'addNetworkNote',
      'addNetworkNoteMedia',
      'getNetworkNotes',
      'deleteNetworkNote',
      // API testing (2)
      'testHealth',
      'testEndpoint',
    ];

    // Verify count matches the audit tool's 67 object-method count
    expect(expectedMethods).toHaveLength(67);

    expectedMethods.forEach((method) => {
      expect(source).toContain(`async ${method}(`);
    });
  });

  test('parseImportResponse contains the two anonymous catch callbacks counted by the audit tool', () => {
    // These bring the total from 67 to 69. They are anonymous and unlockable by name,
    // so we verify their containing method and their distinctive patterns instead.
    expect(source).toContain('async parseImportResponse(');
    expect(source).toContain('.catch(() => null)');
    expect(source).toContain(".catch(() => '')");
  });
});
