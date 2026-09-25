import lock from '../../../server/src/services/mlTrainingLock';

describe('mlTrainingLock', () => {
  beforeEach(() => {
    lock.release();
  });

  it('should acquire and release the lock', () => {
    expect(lock.status().locked).toBe(false);

    const acquired = lock.acquire();
    expect(acquired).toBe(true);
    expect(lock.status().locked).toBe(true);
    expect(lock.status().lockedAt).toBeDefined();

    lock.release();
    expect(lock.status().locked).toBe(false);
    expect(lock.status().lockedAt).toBeNull();
  });

  it('should not acquire if already locked', () => {
    lock.acquire();
    const secondAcquire = lock.acquire();
    expect(secondAcquire).toBe(false);
  });
});
