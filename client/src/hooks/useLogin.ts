import { useState } from 'react';
import { authApi } from '../api/authApi';

type LoginSuccessPayload = {
  user: any;
  forcePasswordChange?: boolean;
  currentPassword: string;
};

export const useLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async (
    onSuccess: (payload: LoginSuccessPayload) => void,
    onError: (error: string) => void
  ) => {
    if (!username || !password) {
      onError('Please enter both username and password');
      return;
    }

    setLoading(true);

    try {
      const data = await authApi.login({ username, password });
      onSuccess({
        user: data.user,
        forcePasswordChange: data.forcePasswordChange,
        currentPassword: password,
      });
    } catch (error: any) {
      onError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return {
    username,
    setUsername,
    password,
    setPassword,
    loading,
    login,
  };
};
