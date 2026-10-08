import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const readBaseline = (filename: string) =>
  fs.readFileSync(path.join(root, 'sql/baseline_phase3', filename), 'utf8');
const migration = fs.readFileSync(
  path.join(root, 'sql/migrations/20261008_108_note_media_db_only_hard_delete.sql'),
  'utf8'
);
const readSource = (filename: string) => fs.readFileSync(path.join(root, filename), 'utf8');

describe('note media database-only schema contract', () => {
  it('network_summary_with_notes selects the latest remaining note', () => {
    const baseline = readBaseline('baseline_005_analysis_views_materialized_views.sql');
    const viewStart = baseline.indexOf('CREATE OR REPLACE VIEW app.network_summary_with_notes AS');
    const viewEnd = baseline.indexOf('-- network_tags_expanded view', viewStart);
    const viewDefinition = baseline.slice(viewStart, viewEnd);

    expect(viewStart).toBeGreaterThanOrEqual(0);
    expect(viewDefinition).toContain('FROM app.network_notes');
    expect(viewDefinition).toContain('ORDER BY network_notes.created_at DESC LIMIT 1');
    expect(viewDefinition).not.toContain('is_deleted');
  });

  it('network_note_count counts the remaining note rows', () => {
    const baseline = readBaseline('baseline_004_functions_and_triggers.sql');
    const functionStart = baseline.indexOf('CREATE OR REPLACE FUNCTION app.network_note_count');
    const functionEnd = baseline.indexOf('-- Media functions', functionStart);
    const functionDefinition = baseline.slice(functionStart, functionEnd);

    expect(functionDefinition).toContain('COUNT(*)::INTEGER FROM app.network_notes');
    expect(functionDefinition).not.toContain('is_deleted');
  });

  it('hard-deletes legacy soft-deleted notes before removing their state column', () => {
    const deletePosition = migration.indexOf('DELETE FROM app.network_notes');
    const dropPosition = migration.indexOf('DROP COLUMN IF EXISTS is_deleted');

    expect(deletePosition).toBeGreaterThanOrEqual(0);
    expect(dropPosition).toBeGreaterThan(deletePosition);
    expect(migration).toContain('WHERE is_deleted IS TRUE');
    expect(migration).toContain('DROP INDEX IF EXISTS app.idx_network_notes_bssid_active');

    const coreTables = readBaseline('baseline_002_core_tables.sql');
    expect(coreTables).toContain(
      'FOREIGN KEY (note_id) REFERENCES app.network_notes(id) ON DELETE CASCADE'
    );
  });

  it('requires bytea and removes filesystem metadata and filesystem-oriented functions', () => {
    expect(migration).toContain('ALTER COLUMN media_data SET NOT NULL');
    expect(migration).toContain('DROP COLUMN IF EXISTS file_path');
    expect(migration).toContain('DROP COLUMN IF EXISTS storage_backend');
    expect(migration).toContain('DROP FUNCTION IF EXISTS app.delete_note_media(integer)');
    expect(migration).toContain('DROP FUNCTION IF EXISTS app.get_note_media(integer)');
    expect(migration).not.toMatch(/nm\.file_path/);
    expect(migration.match(/storage_backend/g)).toHaveLength(1);
  });

  it('recreates the sibling notes view without soft-delete state', () => {
    expect(migration).toContain('CREATE VIEW app.v_sibling_group_media');
    expect(migration).toContain('JOIN app.network_notes nn ON nn.bssid = gm.sibling_bssid');
    expect(migration).not.toMatch(/nn\.is_deleted/);
    expect(migration).toContain("IF to_regclass('app.mv_sibling_groups') IS NOT NULL");
  });

  it('does not retain soft-delete predicates in note queries or note counts', () => {
    const queryFiles = [
      'server/src/repositories/adminNetworkMediaRepository.ts',
      'server/src/repositories/v2Repository.ts',
      'server/src/services/filterQueryBuilder/engagementPredicates.ts',
      'server/src/services/filterQueryBuilder/modules/networkFastPathListBuilder.ts',
      'server/src/services/filterQueryBuilder/modules/networkNoFilterBuilder.ts',
      'server/src/services/filterQueryBuilder/modules/networkSlowPathBuilder.ts',
    ];

    for (const filename of queryFiles) {
      expect(readSource(filename)).not.toContain('is_deleted');
    }
  });
});
