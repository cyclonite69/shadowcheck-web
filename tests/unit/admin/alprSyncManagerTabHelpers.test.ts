import { shouldClearActiveJobId } from '../../../client/src/components/admin/tabs/alpr/ALPRSyncManagerTab';

describe('shouldClearActiveJobId', () => {
  it('keeps the tracked job while dispatched or running (fast-fail race)', () => {
    expect(shouldClearActiveJobId('dispatched')).toBe(false);
    expect(shouldClearActiveJobId('running')).toBe(false);
  });

  it('clears only on terminal completed/failed', () => {
    expect(shouldClearActiveJobId('completed')).toBe(true);
    expect(shouldClearActiveJobId('failed')).toBe(true);
  });
});
