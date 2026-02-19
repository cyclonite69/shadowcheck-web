import { useState } from 'react';
import { authApi } from '../api/authApi';

export const useLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async (onSuccess: (user: any) => void, onError: (error: string) => void) => {
    if (!username || !password) {
      onError('Please enter both username and password');
      return;
    }

    setLoading(true);

    try {
      const data = await authApi.login({ username, password });
      onSuccess(data.user);
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
