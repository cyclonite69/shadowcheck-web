import React, { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../../api/adminApi';
import { useAuth } from '../../../hooks/useAuth';
import type { AdminUser } from '../types/admin.types';
import { AdminCard } from '../components/AdminCard';

const UsersIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <path d="M20 8v6" />
    <path d="M23 11h-6" />
  </svg>
);

export const UsersTab: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [forcePasswordChange, setForcePasswordChange] = useState(true);

  const [resetPasswordByUserId, setResetPasswordByUserId] = useState<Record<number, string>>({});

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.listUsers();
      setUsers(result.users || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await adminApi.createUser({
        username: username.trim(),
        email: email.trim(),
        password,
        role,
        forcePasswordChange,
      });
      setUsername('');
      setEmail('');
      setPassword('');
      setRole('user');
      setForcePasswordChange(true);
      setNotice('User created');
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    if (currentUser && currentUser.id === user.id && user.is_active) {
      setError('You cannot disable your own admin account');
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await adminApi.setUserActive(user.id, !user.is_active);
      setNotice(`${user.username} ${user.is_active ? 'disabled' : 'enabled'}`);
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (user: AdminUser) => {
    const nextPassword = (resetPasswordByUserId[user.id] || '').trim();
    if (nextPassword.length < 8) {
      setError('Reset password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await adminApi.resetUserPassword(user.id, nextPassword, true);
      setResetPasswordByUserId((prev) => ({ ...prev, [user.id]: '' }));
      setNotice(`Password reset for ${user.username}`);
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <AdminCard icon={UsersIcon} title="Create User" color="from-indigo-500 to-indigo-600">
        <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            className="px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            className="px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm md:col-span-2"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm"
            placeholder="Password (min 8)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <select
            className="px-3 py-2.5 bg-slate-800/50 border border-slate-600/60 rounded-lg text-white text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Create'}
          </button>
          <label className="md:col-span-6 text-xs text-slate-300 inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={forcePasswordChange}
              onChange={(e) => setForcePasswordChange(e.target.checked)}
            />
            Force password change on first login
          </label>
        </form>
      </AdminCard>

      <AdminCard icon={UsersIcon} title="Existing Users" color="from-slate-500 to-slate-600">
        {error && <div className="text-sm text-red-400 mb-3">{error}</div>}
        {notice && <div className="text-sm text-emerald-400 mb-3">{notice}</div>}
        {loading ? (
          <div className="text-sm text-slate-400">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-300">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700/60">
                  <th className="py-2 pr-4">Username</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Last Login</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-800/60 align-top">
                    <td className="py-2 pr-4 text-white">{user.username}</td>
                    <td className="py-2 pr-4">{user.email}</td>
                    <td className="py-2 pr-4">{user.role}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          user.is_active
                            ? 'bg-green-900/40 text-green-300'
                            : 'bg-red-900/40 text-red-300'
                        }`}
                      >
                        {user.is_active ? 'active' : 'disabled'}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {currentUser && currentUser.id === user.id && (
                          <span className="px-2 py-1 rounded text-xs bg-blue-900/40 text-blue-300">
                            Current session
                          </span>
                        )}
                        <button
                          disabled={submitting || (currentUser?.id === user.id && user.is_active)}
                          onClick={() => handleToggleActive(user)}
                          className="px-2 py-1 rounded text-xs bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50"
                          title={
                            currentUser?.id === user.id && user.is_active
                              ? 'You cannot disable your own admin account'
                              : undefined
                          }
                        >
                          {user.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <input
                          className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                          placeholder="New password"
                          type="password"
                          minLength={8}
                          value={resetPasswordByUserId[user.id] || ''}
                          onChange={(e) =>
                            setResetPasswordByUserId((prev) => ({
                              ...prev,
                              [user.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          disabled={submitting}
                          onClick={() => handleResetPassword(user)}
                          className="px-2 py-1 rounded text-xs bg-indigo-700 text-white hover:bg-indigo-600 disabled:opacity-50"
                        >
                          Reset Password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
};
