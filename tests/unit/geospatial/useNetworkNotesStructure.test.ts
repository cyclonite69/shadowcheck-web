/**
 * Stage 1 structural role lock for
 * client/src/components/geospatial/hooks/useNetworkNotes.ts.
 *
 * This stateful API/UI hook has no direct focused behavioral suite. The
 * existing useGeospatialOverlayOrchestration test preserves composition via
 * notesState, but not this hook's complete public return surface.
 *
 * Scope: public export and returned values only. Inputs, imports, private
 * helpers, and implementation choices deliberately remain unconstrained for
 * Stage 2 extraction.
 */

export {};

import fs from 'fs';
import path from 'path';

describe('useNetworkNotes hook structure — Stage 1 role lock', () => {
  const filePath = path.resolve(
    process.cwd(),
    'client/src/components/geospatial/hooks/useNetworkNotes.ts'
  );
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(filePath, 'utf8');
  });

  test('exports useNetworkNotes as the sole named export', () => {
    expect(source).toContain('export const useNetworkNotes = ({');
    const exportLines = source.split('\n').filter((line) => line.startsWith('export '));
    expect(exportLines).toHaveLength(1);
  });

  test('returns the complete public note-control surface', () => {
    const returnStart = source.indexOf('  return {\n    showNoteModal,');
    const returnEnd = source.indexOf('\n  };', returnStart);
    expect(returnStart).toBeGreaterThanOrEqual(0);
    expect(returnEnd).toBeGreaterThan(returnStart);
    const returnBlock = source.slice(returnStart, returnEnd);
    const expectedReturnKeys = [
      'showNoteModal',
      'setShowNoteModal',
      'selectedBssid',
      'setSelectedBssid',
      'existingNoteId',
      'hasExistingNote',
      'noteSaving',
      'noteDeleting',
      'noteError',
      'clearNoteError',
      'noteContent',
      'setNoteContent',
      'noteType',
      'setNoteType',
      'noteAttachments',
      'setNoteAttachments',
      'existingNoteMedia',
      'fileInputRef',
      'openNoteModalForBssid',
      'resetNoteState',
      'handleSaveNote',
      'handleDeleteNote',
      'handleDeleteExistingMedia',
      'openExistingMedia',
      'handleAddAttachment',
      'removeAttachment',
    ];

    expectedReturnKeys.forEach((key) => {
      expect(returnBlock).toMatch(new RegExp(`\\n    ${key}\\s*[:,}]`));
    });
  });
});
