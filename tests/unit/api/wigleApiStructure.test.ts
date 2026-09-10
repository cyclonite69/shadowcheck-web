/**
 * Characterization lock test for client/src/api/wigleApi.ts
 *
 * Purpose: lock the module's export surface and function inventory so that
 * Stage 2 extraction refactors cannot silently drop methods or rename the
 * public interface without a test failure.
 *
 * Scope of this lock (Stage 1 — names only):
 *   - Checks that named exports exist and method names are present in source.
 *   - Does NOT verify method signatures, parameter types, or behavior.
 *   - Note: tests/unit/services/wigleApi.test.ts tests server/src/services/wigle/api.ts
 *     (the server-side WiGLE gateway), NOT this client module. No behavioral
 *     regression test exists for client/src/api/wigleApi.ts yet.
 *
 * The audit tool (scripts/audit/architecture/inventory.ts) counts functions via
 * TypeScript AST (isFunctionDeclaration | isMethodDeclaration | isArrowFunction |
 * isFunctionExpression) at any nesting depth. The 36-function count includes:
 *   - 33 async methods on the wigleApi object literal
 *       Note: importWigleV3 has a digit in the name — a digit-blind grep
 *       pattern ([a-zA-Z]+) miscounts the object at 32.
 *       Note: getWiglePageNetwork appears in BOTH places — as an object method
 *       (which delegates to the standalone) and as a standalone exported arrow.
 *       The AST counts both separately.
 *   - getWiglePageNetwork — standalone exported async arrow (separate AST node
 *     from the same-named object method above; the object method delegates to it)
 *   - normalizeApiEndpoint — module-level non-async arrow (not exported)
 *   - getErrorPayload — module-level non-async arrow (not exported)
 * All 36 are locked below.
 *
 * Stage 1 Batch C — role lock only. Extraction deferred to Stage 2.
 */

// Force module scope
export {};

import fs from 'fs';
import path from 'path';

describe('wigleApi module structure — Stage 1 role lock', () => {
  const filePath = path.resolve(process.cwd(), 'client/src/api/wigleApi.ts');
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(filePath, 'utf8');
  });

  test('exports the wigleApi object as the primary export', () => {
    expect(source).toContain('export const wigleApi = {');
  });

  test('exports getWiglePageNetwork as a standalone named export separate from the object method', () => {
    // The standalone arrow is also delegated to by the same-named object method.
    // Both must exist; this checks the standalone export declaration.
    expect(source).toContain('export const getWiglePageNetwork =');
  });

  test('exports the expected named types', () => {
    expect(source).toContain('export interface LedgerRow {');
    expect(source).toContain('export interface WiglePageNetwork {');
    expect(source).toContain('export interface WiglePageNetworkResponse {');
  });

  test('contains all 33 expected async methods on the wigleApi object', () => {
    const expectedMethods = [
      // API status
      'getApiStatus',
      // Search & import
      'searchWigle',
      'importAllWigle',
      'importAllBluetooth',
      // Import runs
      'listImportRuns',
      'getImportRun',
      'getImportCompletenessReport',
      'resumeImportRun',
      'resumeLatestImportRun',
      'pauseImportRun',
      'cancelImportRun',
      'deleteImportRun',
      // V3 enrichment
      'getEnrichmentStats',
      'getEnrichmentCatalog',
      'startEnrichment',
      'resumeEnrichment',
      'forceClearEnrichmentRun',
      // WiGLE detail
      'getWigleObservations',
      'getWiglePageNetwork', // object method — delegates to the standalone export above
      'getWigleDetail',
      'batchImportWigleDetail',
      'importWigleV3', // digit in name — digit-blind grep miscounts without this
      // Network observations
      'getNetworkWigleObservations',
      'getLocalObservationsByBSSID',
      'getLocalObservations',
      'getKmlPoints',
      // Cluster cleanup
      'cleanupCancelledCluster',
      // Saved SSID terms
      'getSavedSsidTerms',
      'saveSsidTerm',
      'deleteSavedSsidTerm',
      // Map
      'getMapboxToken',
      'searchLocalWigle',
      // Ledger
      'getLedger',
    ];

    // Verify count matches the audit tool's 33 object-method count
    expect(expectedMethods).toHaveLength(33);

    expectedMethods.forEach((method) => {
      expect(source).toContain(`async ${method}(`);
    });
  });

  test('contains the two non-exported module-level functions counted by the audit tool', () => {
    // These plus the 33 object methods + the standalone getWiglePageNetwork = 36 total.
    // normalizeApiEndpoint: normalizes /api/ prefix from endpoint strings
    expect(source).toContain('const normalizeApiEndpoint =');
    // getErrorPayload: extracts structured error payload from thrown ApiClientError
    expect(source).toContain('const getErrorPayload =');
  });

  test('depends on apiClient from the local client module', () => {
    expect(source).toContain("import { apiClient } from './client'");
  });
});
