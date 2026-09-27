import { useState, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';

export interface UseLogoutResult {
  loggingOut: boolean;
  handleLogout: (onComplete?: () => void) => Promise<void>;
}

export const useLogout = (): UseLogoutResult => {
  const [loggingOut, setLoggingOut] = useState(false);
  const loggingOutRef = useRef(false);
  const { logout } = useAuth();

  const handleLogout = useCallback(
    async (onComplete?: () => void) => {
      if (loggingOutRef.current) {
        return;
      }
      loggingOutRef.current = true;
      setLoggingOut(true);
      try {
        await logout();
      } finally {
        setLoggingOut(false);
        loggingOutRef.current = false;
        onComplete?.();
      }
    },
    [logout]
  );

  return { loggingOut, handleLogout };
};
