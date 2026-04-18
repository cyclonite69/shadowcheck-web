/**
 * AuthWrites Unit Tests
 */

import {
  createUserSession,
  deleteExpiredSessions,
  deleteUserSession,
  updateLastLogin,
  updateUserPassword,
} from '../../server/src/services/authWrites';
import { query } from '../../server/src/config/database';
import bcrypt from 'bcrypt';

jest.mock('../../server/src/config/database');
jest.mock('bcrypt');

describe('AuthWrites', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUserSession()', () => {
    it('should insert session into database', async () => {
      const expiresAt = new Date();
      await createUserSession(1, 'hash', expiresAt, 'agent', 'ip');

      expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO app.user_sessions'), [
        1,
        'hash',
        expiresAt,
        'agent',
        'ip',
      ]);
    });
  });

  describe('updateLastLogin()', () => {
    it('should update last_login for user', async () => {
      await updateLastLogin(1);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE app.users SET last_login'),
        [1]
      );
    });
  });

  describe('deleteUserSession()', () => {
    it('should delete session by token hash', async () => {
      await deleteUserSession('hash');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM app.user_sessions WHERE token_hash'),
        ['hash']
      );
    });
  });

  describe('deleteExpiredSessions()', () => {
    it('should delete expired sessions', async () => {
      await deleteExpiredSessions();

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM app.user_sessions WHERE expires_at < NOW()')
      );
    });
  });

  describe('updateUserPassword()', () => {
    it('should update password with force_password_change = false', async () => {
      (query as jest.Mock).mockResolvedValue({ rowCount: 1 });

      await updateUserPassword(1, 'hash');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining(
          'UPDATE app.users SET password_hash = $1, force_password_change = false'
        ),
        ['hash', 1]
      );
    });

    it('should fallback if force_password_change column missing', async () => {
      const error = new Error('column missing');
      (error as any).code = '42703';
      (query as jest.Mock).mockRejectedValueOnce(error).mockResolvedValueOnce({ rowCount: 1 });

      await updateUserPassword(1, 'hash');

      expect(query).toHaveBeenCalledTimes(2);
      expect(query).toHaveBeenLastCalledWith(
        expect.stringContaining('UPDATE app.users SET password_hash = $1 WHERE id = $2'),
        ['hash', 1]
      );
    });

    it('should retry locally on permission error using a hashed plaintext password', async () => {
      const error = new Error('permission denied');
      (error as any).code = '42501';
      (query as jest.Mock)
        .mockRejectedValueOnce(error) // Initial try fails with permission error
        .mockResolvedValueOnce({ rowCount: 1 }); // Retry succeeds
      (bcrypt.hash as jest.Mock).mockResolvedValue('admin-hash');

      await updateUserPassword(1, 'hash', 'plain');

      expect(bcrypt.hash).toHaveBeenCalledWith('plain', 12);
      expect(query).toHaveBeenNthCalledWith(
        2,
        'UPDATE app.users SET password_hash = $1, force_password_change = false WHERE id = $2',
        ['admin-hash', 1]
      );
    });

    it('should throw error if update failed', async () => {
      (query as jest.Mock).mockResolvedValue({ rowCount: 0 }); // simulate unexpected fail or 0 rows updated

      // In the implementation, if runUpdate returns false (e.g. 42703), it tries the next one.
      // If it returns true (e.g. success), it returns.
      // If both fail with 42703, it throws.

      const error = new Error('column missing');
      (error as any).code = '42703';
      (query as jest.Mock).mockRejectedValue(error);

      await expect(updateUserPassword(1, 'hash')).rejects.toThrow('Password update failed');
    });

    it('should rethrow other database errors', async () => {
      const error = new Error('DB Error');
      (query as jest.Mock).mockRejectedValue(error);

      await expect(updateUserPassword(1, 'hash')).rejects.toThrow('DB Error');
    });
  });
});
