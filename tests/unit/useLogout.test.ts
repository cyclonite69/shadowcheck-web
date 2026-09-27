const stateMap: Record<number, any> = {};
let stateCallIndex = 0;

jest.mock('react', () => ({
  useState: (initial: any) => {
    const key = stateCallIndex++;
    if (!(key in stateMap)) {
      stateMap[key] = initial;
    }
    const setter = (val: any) => {
      stateMap[key] = typeof val === 'function' ? val(stateMap[key]) : val;
    };
    return [stateMap[key], setter];
  },
  useRef: (initial: any) => ({ current: initial }),
  useCallback: (fn: any) => fn,
}));

import { useLogout } from '../../client/src/hooks/useLogout';

const mockLogout = jest.fn().mockResolvedValue(undefined);

jest.mock('../../client/src/hooks/useAuth', () => ({
  useAuth: () => ({
    logout: mockLogout,
    isAdmin: false,
    isAuthenticated: true,
  }),
}));

describe('useLogout hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stateCallIndex = 0;
    for (const key of Object.keys(stateMap)) {
      delete stateMap[Number(key)];
    }
  });

  it('provides loggingOut state and handleLogout function', async () => {
    const hook = useLogout();

    expect(hook.loggingOut).toBe(false);

    const onComplete = jest.fn();
    await hook.handleLogout(onComplete);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('prevents concurrent logout executions when already in progress', async () => {
    let resolveLogout: () => void = () => {};
    mockLogout.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLogout = resolve;
        })
    );

    const hook = useLogout();

    // Start first logout
    const firstCall = hook.handleLogout();

    // Attempt second logout immediately
    const secondCall = hook.handleLogout();

    // Resolve first call
    resolveLogout();
    await Promise.all([firstCall, secondCall]);

    // Should only have called mockLogout once
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
