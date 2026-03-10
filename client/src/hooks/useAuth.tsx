import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { apiClient } from '../api/client';
import type { LoginResponse } from '../api/authApi';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (result: LoginResponse) => void;
  logout: () => void;
  isAdmin: boolean;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  pendingUsername: string;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const IDLE_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [pendingUsername, setPendingUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loggingOutRef = useRef(false);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  // Check if user is already logged in on app start
  const checkAuthStatus = useCallback(async () => {
    try {
      const data = await apiClient.get<any>('/auth/me');
      if (data.authenticated) {
        if (data.forcePasswordChange) {
          setUser(null);
          setMustChangePassword(true);
          setPendingUsername(data.user?.username || '');
        } else {
          setUser(data.user);
          setMustChangePassword(false);
          setPendingUsername('');
        }
      }
    } catch {
      // Not authenticated or server error — user stays null
      setUser(null);
      setMustChangePassword(false);
      setPendingUsername('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = useCallback((result: LoginResponse) => {
    if (result.forcePasswordChange) {
      setUser(null);
      setMustChangePassword(true);
      setPendingUsername(result.user?.username || '');
      return;
    }

    setUser(result.user as User);
    setMustChangePassword(false);
    setPendingUsername('');
  }, []);

  const logout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Logout errors are non-critical — user is cleared regardless
    } finally {
      clearIdleTimer();
      setUser(null);
      setMustChangePassword(false);
      setPendingUsername('');
      loggingOutRef.current = false;
    }
  }, [clearIdleTimer]);

  const resetIdleTimer = useCallback(() => {
    if (!user || loading) return;

    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      void logout();
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimer, loading, logout, user]);

  useEffect(() => {
    if (!user || loading) {
      clearIdleTimer();
      return;
    }

    resetIdleTimer();
    IDLE_EVENTS.forEach((eventName) =>
      window.addEventListener(eventName, resetIdleTimer, { passive: true })
    );

    return () => {
      IDLE_EVENTS.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
      clearIdleTimer();
    };
  }, [clearIdleTimer, loading, resetIdleTimer, user]);

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAdmin: user?.role === 'admin',
    isAuthenticated: !!user,
    mustChangePassword,
    pendingUsername,
    refreshAuth: checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
