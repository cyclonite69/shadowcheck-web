import { query } from '../config/database';
// @ts-ignore
import bcrypt from 'bcrypt';

const AUTH_SALT_ROUNDS = 12;

const createUserSession = async (
  userId: number,
  tokenHash: string,
  expiresAt: Date,
  userAgent: string,
  ipAddress: string
) =>
  query(
    `INSERT INTO app.user_sessions (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, userAgent, ipAddress]
  );

const updateLastLogin = async (userId: number) =>
  query('UPDATE app.users SET last_login = NOW() WHERE id = $1', [userId]);

const deleteUserSession = async (tokenHash: string) =>
  query('DELETE FROM app.user_sessions WHERE token_hash = $1', [tokenHash]);

const deleteExpiredSessions = async () =>
  query('DELETE FROM app.user_sessions WHERE expires_at < NOW()');

const updateUserPassword = async (
  userId: number,
  passwordHash: string,
  plainTextPassword?: string
): Promise<void> => {
  const runUpdate = async (sql: string) => {
    try {
      const result = await query(sql, [passwordHash, userId]);
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === '42501' && plainTextPassword) {
        const adminPasswordHash = await bcrypt.hash(plainTextPassword, AUTH_SALT_ROUNDS);
        await query(
          'UPDATE app.users SET password_hash = $1, force_password_change = false WHERE id = $2',
          [adminPasswordHash, userId]
        );
        return true;
      }

      if (err.code === '42703') {
        return false;
      }

      throw error;
    }
  };

  const updatedWithForceFlag = await runUpdate(
    'UPDATE app.users SET password_hash = $1, force_password_change = false WHERE id = $2'
  );

  if (updatedWithForceFlag) {
    return;
  }

  const updatedWithoutForceFlag = await runUpdate(
    'UPDATE app.users SET password_hash = $1 WHERE id = $2'
  );

  if (updatedWithoutForceFlag) {
    return;
  }

  throw new Error('Password update failed');
};

export {
  createUserSession,
  deleteExpiredSessions,
  deleteUserSession,
  updateLastLogin,
  updateUserPassword,
};
