/**
 * AuthService Unit Tests
 */

import authService from '../../server/src/services/authService';
// @ts-ignore
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { createAppUser } from '../../server/src/services/adminUsersService';
import {
  getSessionUser,
  getUserForLogin,
  getUserForPasswordChange,
} from '../../server/src/services/authQueries';
import {
  createUserSession,
  deleteExpiredSessions,
  deleteUserSession,
  updateLastLogin,
  updateUserPassword,
} from '../../server/src/services/authWrites';
import logger from '../../server/src/logging/logger';
import { createMockUser } from '../fixtures/factories';

// Mocks
jest.mock('bcrypt');
jest.mock('../../server/src/services/adminUsersService');
jest.mock('../../server/src/services/authQueries');
jest.mock('../../server/src/services/authWrites');
jest.mock('../../server/src/logging/logger');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login()', () => {
    it('should login successfully with correct credentials', async () => {
      const mockUser = createMockUser({ password_hash: 'hashed_pass' });
      (getUserForLogin as jest.Mock).mockResolvedValue({ rows: [mockUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (createUserSession as jest.Mock).mockResolvedValue({ rowCount: 1 });
      (updateLastLogin as jest.Mock).mockResolvedValue({ rowCount: 1 });

      const result = await authService.login('test_user', 'password123');

      expect(result.success).toBe(true);
      expect(result.token).toHaveLength(64);
      expect(result.user).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(getUserForLogin).toHaveBeenCalledWith('test_user');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_pass');
      expect(createUserSession).toHaveBeenCalled();
    });

    it('should return error for non-existent user', async () => {
      (getUserForLogin as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await authService.login('unknown_user', 'pass');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should return error for disabled account', async () => {
      const mockUser = createMockUser({ is_active: false });
      (getUserForLogin as jest.Mock).mockResolvedValue({ rows: [mockUser] });

      const result = await authService.login('test_user', 'pass');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is disabled');
    });

    it('should return error for incorrect password', async () => {
      const mockUser = createMockUser();
      (getUserForLogin as jest.Mock).mockResolvedValue({ rows: [mockUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await authService.login('test_user', 'wrong_pass');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should handle last_login update failure gracefully', async () => {
      const mockUser = createMockUser();
      (getUserForLogin as jest.Mock).mockResolvedValue({ rows: [mockUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (updateLastLogin as jest.Mock).mockRejectedValue(new Error('Update failed'));

      const result = await authService.login('test_user', 'password123');

      expect(result.success).toBe(true); // Should still succeed
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return 500 on unexpected error', async () => {
      (getUserForLogin as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await authService.login('test_user', 'pass');

      expect(result.success).toBe(false);
      expect(result.status).toBe(500);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should return forcePasswordChange true if user has it set', async () => {
      const mockUser = createMockUser({ password_hash: 'hashed', force_password_change: true });
      (getUserForLogin as jest.Mock).mockResolvedValue({ rows: [mockUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (createUserSession as jest.Mock).mockResolvedValue({ rowCount: 1 });

      const result = await authService.login('test_user', 'pass');

      expect(result.success).toBe(true);
      expect(result.forcePasswordChange).toBe(true);
    });

    it('should handle missing username or password', async () => {
      // @ts-ignore
      const result1 = await authService.login('', 'pass');
      expect(result1.success).toBe(false);

      // @ts-ignore
      const result2 = await authService.login('user', '');
      expect(result2.success).toBe(false);
    });
  });

  describe('validateSession()', () => {
    it('should validate active session', async () => {
      const mockUser = createMockUser({ force_password_change: true });
      (getSessionUser as jest.Mock).mockResolvedValue({ rows: [mockUser] });

      const result = await authService.validateSession('valid-token');

      expect(result.valid).toBe(true);
      expect(result.user?.id).toBe(mockUser.id);
      expect(result.forcePasswordChange).toBe(true);
      expect(getSessionUser).toHaveBeenCalled();
    });

    it('should return error for missing token', async () => {
      const result = await authService.validateSession('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No token provided');
    });

    it('should return error for invalid/expired token', async () => {
      (getSessionUser as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await authService.validateSession('invalid-token');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid or expired session');
    });

    it('should return error if user is disabled', async () => {
      const mockUser = createMockUser({ is_active: false });
      (getSessionUser as jest.Mock).mockResolvedValue({ rows: [mockUser] });

      const result = await authService.validateSession('valid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Account is disabled');
    });

    it('should handle database errors during session validation', async () => {
      (getSessionUser as jest.Mock).mockRejectedValue(new Error('DB Error'));
      const result = await authService.validateSession('token');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session validation failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('logout()', () => {
    it('should invalidate session', async () => {
      (deleteUserSession as jest.Mock).mockResolvedValue({ rowCount: 1 });
      const result = await authService.logout('token');
      expect(result.success).toBe(true);
      expect(deleteUserSession).toHaveBeenCalled();
    });

    it('should succeed even if token is missing', async () => {
      const result = await authService.logout('');
      expect(result.success).toBe(true);
      expect(deleteUserSession).not.toHaveBeenCalled();
    });

    it('should handle database errors during logout', async () => {
      (deleteUserSession as jest.Mock).mockRejectedValue(new Error('DB Error'));
      const result = await authService.logout('token');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Logout failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('createUser()', () => {
    it('should create a user successfully', async () => {
      const mockUser = { id: 1, username: 'newuser' };
      (createAppUser as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.createUser('newuser', 'new@example.com', 'password', 'user');

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(createAppUser).toHaveBeenCalledWith(
        'newuser',
        'new@example.com',
        'password',
        'user',
        false
      );
    });

    it('should return error for duplicate username/email', async () => {
      const error = new Error('Duplicate');
      (error as any).code = '23505';
      (createAppUser as jest.Mock).mockRejectedValue(error);

      const result = await authService.createUser('dup', 'dup@example.com', 'password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Username or email already exists');
    });

    it('should handle other errors during user creation', async () => {
      (createAppUser as jest.Mock).mockRejectedValue(new Error('Generic Error'));

      const result = await authService.createUser('user', 'email', 'pass');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create user');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('changePassword()', () => {
    it('should change password successfully', async () => {
      const mockUser = createMockUser({ password_hash: 'old_hash' });
      (getUserForPasswordChange as jest.Mock).mockResolvedValue({ rows: [mockUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hash');

      const result = await authService.changePassword('test_user', 'old_pass', 'new_pass');

      expect(result.success).toBe(true);
      expect(updateUserPassword).toHaveBeenCalledWith(mockUser.id, 'new_hash', 'new_pass');
    });

    it('should return error for non-existent user', async () => {
      (getUserForPasswordChange as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await authService.changePassword('unknown_user', 'old', 'new');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should return error for disabled account', async () => {
      const mockUser = createMockUser({ is_active: false });
      (getUserForPasswordChange as jest.Mock).mockResolvedValue({ rows: [mockUser] });

      const result = await authService.changePassword('test_user', 'old', 'new');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is disabled');
    });

    it('should return error for incorrect current password', async () => {
      const mockUser = createMockUser();
      (getUserForPasswordChange as jest.Mock).mockResolvedValue({ rows: [mockUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await authService.changePassword('test_user', 'wrong_pass', 'new_pass');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Current password is incorrect');
    });

    it('should handle database errors during password change', async () => {
      (getUserForPasswordChange as jest.Mock).mockRejectedValue(new Error('DB Error'));
      const result = await authService.changePassword('user', 'old', 'new');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to change password');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredSessions()', () => {
    it('should cleanup sessions', async () => {
      (deleteExpiredSessions as jest.Mock).mockResolvedValue({ rowCount: 5 });
      await authService.cleanupExpiredSessions();
      expect(deleteExpiredSessions).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('5'));
    });

    it('should do nothing if no sessions to cleanup', async () => {
      (deleteExpiredSessions as jest.Mock).mockResolvedValue({ rowCount: 0 });
      await authService.cleanupExpiredSessions();
      expect(deleteExpiredSessions).toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should handle database errors during session cleanup', async () => {
      (deleteExpiredSessions as jest.Mock).mockRejectedValue(new Error('DB Error'));
      await authService.cleanupExpiredSessions();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
