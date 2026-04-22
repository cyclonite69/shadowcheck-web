import { getImportHistoryStatusMeta } from '../../client/src/components/admin/tabs/data-import/importHistoryStatusMeta';

describe('getImportHistoryStatusMeta', () => {
  it('returns an explicit pending badge', () => {
    expect(getImportHistoryStatusMeta('pending')).toEqual({
      className: 'text-sky-400',
      label: '● pending',
    });
  });

  it('returns an explicit quarantined badge', () => {
    expect(getImportHistoryStatusMeta('quarantined')).toEqual({
      className: 'text-amber-400',
      label: '⚠ Quarantined',
    });
  });

  it('preserves the existing running badge', () => {
    expect(getImportHistoryStatusMeta('running')).toEqual({
      className: 'text-yellow-400',
      label: '⏳ running',
    });
  });
});
