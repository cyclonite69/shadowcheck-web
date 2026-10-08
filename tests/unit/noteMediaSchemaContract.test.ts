import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const readBaseline = (filename: string) =>
  fs.readFileSync(path.join(root, 'sql/baseline_phase3', filename), 'utf8');

describe('note media schema behavior before database-only cleanup', () => {
  it('network_summary_with_notes can select a soft-deleted row as its latest note', () => {
    const baseline = readBaseline('baseline_005_analysis_views_materialized_views.sql');
    const viewStart = baseline.indexOf('CREATE OR REPLACE VIEW app.network_summary_with_notes AS');
    const viewEnd = baseline.indexOf('-- network_tags_expanded view', viewStart);
    const viewDefinition = baseline.slice(viewStart, viewEnd);

    expect(viewStart).toBeGreaterThanOrEqual(0);
    expect(viewDefinition).toContain('FROM app.network_notes');
    expect(viewDefinition).toContain('ORDER BY network_notes.created_at DESC LIMIT 1');
    expect(viewDefinition).not.toContain('is_deleted');
  });

  it('network_note_count currently counts rows without excluding soft-deleted notes', () => {
    const baseline = readBaseline('baseline_004_functions_and_triggers.sql');
    const functionStart = baseline.indexOf('CREATE OR REPLACE FUNCTION app.network_note_count');
    const functionEnd = baseline.indexOf('-- Media functions', functionStart);
    const functionDefinition = baseline.slice(functionStart, functionEnd);

    expect(functionDefinition).toContain('COUNT(*)::INTEGER FROM app.network_notes');
    expect(functionDefinition).not.toContain('is_deleted');
  });
});
