/**
 * Characterization lock test for client/src/api/networkApi.ts
 *
 * Purpose: lock the module's export surface and function inventory so that
 * Stage 2 extraction refactors cannot silently drop methods or rename the
 * public interface without a test failure.
 *
 * Scope of this lock (Stage 1 — names only):
 *   - Checks that named exports exist and method names are present in source.
 *   - Does NOT verify method signatures, parameter types, or behavior.
 *   - Behavioral regression for the three auth-propagation methods is covered
 *     separately by tests/unit/geospatial/networkApiAuth401.test.ts.
 *
 * The audit tool (scripts/audit/architecture/inventory.ts) counts functions via
 * TypeScript AST (isFunctionDeclaration | isMethodDeclaration | isArrowFunction |
 * isFunctionExpression) at any nesting depth. The 30-function count includes:
 *   - 28 async methods on the networkApi object
 *   - isHandledAuthError — module-level arrow function (not exported)
 *   - parseNotes — inner arrow function inside getNetworkNotes (not exported)
 * All 30 are locked below.
 *
 * Stage 1 Batch C — role lock only. Extraction deferred to Stage 2.
 */

// Force module scope
export {};

import fs from 'fs';
import path from 'path';

describe('networkApi module structure — Stage 1 role lock', () => {
  const filePath = path.resolve(process.cwd(), 'client/src/api/networkApi.ts');
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(filePath, 'utf8');
  });

  test('exports the networkApi object as the primary export', () => {
    expect(source).toContain('export const networkApi = {');
  });

  test('exports the expected named types', () => {
    expect(source).toContain('export interface NetworkNote {');
    expect(source).toContain('export interface NoteMediaItem {');
    expect(source).toContain('export interface NetworkMediaItem {');
  });

  test('contains all 28 expected async methods on the networkApi object', () => {
    const expectedMethods = [
      // Network tags
      'getNetworkTags',
      'ignoreNetwork',
      'tagNetworkAsThreat',
      'deleteNetworkTag',
      'removeNetworkTag',
      'investigateNetwork',
      'suspectNetwork',
      'falsePositiveNetwork',
      // WiGLE observations
      'getWigleObservationsBatch',
      'getWigleObservations',
      // Sibling links
      'setNetworkSiblingOverride',
      'getNetworkSiblingLinks',
      'getNetworkSiblingLinksBatch',
      'getSiblingComponentBssids',
      // Notes
      'addNetworkNote',
      'getNetworkNotes',
      'updateNetworkNote',
      'deleteNetworkNote',
      // Note media
      'addNoteMedia',
      'getNoteMedia',
      'deleteNoteMedia',
      // Observations & reports
      'getNetworkObservations',
      'downloadThreatReportPdf',
      // Explorer
      'getNetworkByBssid',
      'getNetworksByBssids',
      'getNetworkMedia',
      'getUnmatchedMediaGeoJson',
      'getMatchedMediaGeoJson',
    ];

    // Verify count matches the audit tool's 28 object-method count
    expect(expectedMethods).toHaveLength(28);

    expectedMethods.forEach((method) => {
      expect(source).toContain(`async ${method}(`);
    });
  });

  test('contains the two non-exported functions counted by the audit tool (total = 30)', () => {
    // isHandledAuthError: module-level arrow function guarding auth error propagation
    expect(source).toContain('const isHandledAuthError =');
    // parseNotes: inner arrow function inside getNetworkNotes
    expect(source).toContain('const parseNotes =');
  });

  test('depends on apiClient from the local client module', () => {
    expect(source).toContain("import { apiClient } from './client'");
  });
});
