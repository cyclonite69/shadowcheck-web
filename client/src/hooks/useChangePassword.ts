import { useState } from 'react';
import { authApi } from '../api/authApi';

interface UseChangePasswordOptions {
  initialUsername?: string;
  initialCurrentPassword?: string;
  onSuccess?: () => void | Promise<void>;
}

export const useChangePassword = (options: UseChangePasswordOptions = {}) => {
  const [username, setUsername] = useState(options.initialUsername || '');
  const [currentPassword, setCurrentPassword] = useState(options.initialCurrentPassword || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const changePassword = async () => {
    setError('');

    if (!username || !currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await authApi.changePassword({ username, currentPassword, newPassword });
      if (options.onSuccess) {
        await options.onSuccess();
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return {
    username,
    setUsername,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    loading,
    error,
    success,
    changePassword,
  };
};
