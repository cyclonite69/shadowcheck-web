import authService from '../../../server/src/services/authService';
import {
  getUserForLogin,
  getUserForPasswordChange,
  getSessionUser,
} from '../../../server/src/services/authQueries';
import {
  createUserSession,
  updateLastLogin,
  deleteUserSession,
  updateUserPassword,
  deleteExpiredSessions,
} from '../../../server/src/services/authWrites';
import logger from '../../../server/src/logging/logger';
import bcrypt from 'bcrypt';

jest.mock('../../../server/src/services/authQueries');
jest.mock('../../../server/src/services/authWrites');
jest.mock('../../../server/src/logging/logger');
jest.mock('bcrypt');

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 1,
        username: 'test',
        email: 'test@test.com',
        role: 'user',
        password_hash: 'hash',
        is_active: true,
      };
      (getUserForLogin as jest.Mock).mockResolvedValue({ rows: [mockUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login('test', 'password');
      expect(result.success).toBe(true);
      expect(createUserSession).toHaveBeenCalled();
      expect(updateLastLogin).toHaveBeenCalledWith(1);
    });

    it('should login successfully even if updateLastLogin fails', async () => {
      const mockUser = {
        id: 1,
        username: 'test',
        email: 'test@test.com',
        role: 'user',
        password_hash: 'hash',
        is_active: true,
      };
      (getUserForLogin as jest.Mock).mockResolvedValue({ rows: [mockUser] });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (updateLastLogin as jest.Mock).mockRejectedValue(new Error('Last login error'));

      const result = await authService.login('test', 'password');
      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return error for invalid user', async () => {
      (getUserForLogin as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await authService.login('unknown', 'password');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should return error for disabled user', async () => {
      (getUserForLogin as jest.Mock).mockResolvedValue({
        rows: [{ is_active: false }],
      });
      const result = await authService.login('disabled', 'password');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is disabled');
    });

    it('should return error for invalid password', async () => {
      (getUserForLogin as jest.Mock).mockResolvedValue({
        rows: [{ is_active: true, password_hash: 'hash' }],
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await authService.login('test', 'wrong');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should return error on generic failure', async () => {
      (getUserForLogin as jest.Mock).mockRejectedValue(new Error('DB error'));
      const result = await authService.login('test', 'password');
      expect(result.success).toBe(false);
      expect(result.status).toBe(500);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('validateSession', () => {
    it('should validate active session', async () => {
      const mockUser = {
        id: 1,
        username: 'test',
        email: 'test@test.com',
        role: 'user',
        is_active: true,
      };
      (getSessionUser as jest.Mock).mockResolvedValue({ rows: [mockUser] });

      const result = await authService.validateSession('token');
      expect(result.valid).toBe(true);
      expect(result.user).toEqual({
        id: 1,
        username: 'test',
        email: 'test@test.com',
        role: 'user',
      });
    });

    it('should return invalid for no token', async () => {
      const result = await authService.validateSession('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No token provided');
    });

    it('should return invalid for expired or missing session', async () => {
      (getSessionUser as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await authService.validateSession('invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid or expired session');
    });

    it('should return invalid for disabled user', async () => {
      (getSessionUser as jest.Mock).mockResolvedValue({
        rows: [{ is_active: false }],
      });
      const result = await authService.validateSession('token');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Account is disabled');
    });

    it('should return error on generic failure', async () => {
      (getSessionUser as jest.Mock).mockRejectedValue(new Error('DB error'));
      const result = await authService.validateSession('token');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Session validation failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should successfully logout', async () => {
      const result = await authService.logout('token');
      expect(result.success).toBe(true);
      expect(deleteUserSession).toHaveBeenCalled();
    });

    it('should return success if no token provided', async () => {
      const result = await authService.logout('');
      expect(result.success).toBe(true);
      expect(deleteUserSession).not.toHaveBeenCalled();
    });

    it('should return error on failure', async () => {
      (deleteUserSession as jest.Mock).mockRejectedValue(new Error('DB error'));
      const result = await authService.logout('token');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Logout failed');
    });
  });

  describe('changePassword', () => {
    it('should successfully change password', async () => {
      const mockUser = { id: 1, is_active: true, password_hash: 'old' };
      (getUserForPasswordChange as jest.Mock).mockResolvedValue({
        rows: [mockUser],
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newhash');

      const result = await authService.changePassword('user', 'oldpass', 'newpass');
      expect(result.success).toBe(true);
      expect(updateUserPassword).toHaveBeenCalledWith(1, 'newhash', 'newpass');
    });

    it('should return error if user not found', async () => {
      (getUserForPasswordChange as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await authService.changePassword('none', 'pass', 'new');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should return error for disabled user', async () => {
      (getUserForPasswordChange as jest.Mock).mockResolvedValue({
        rows: [{ is_active: false }],
      });
      const result = await authService.changePassword('disabled', 'pass', 'new');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is disabled');
    });

    it('should return error for incorrect current password', async () => {
      (getUserForPasswordChange as jest.Mock).mockResolvedValue({
        rows: [{ is_active: true, password_hash: 'hash' }],
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await authService.changePassword('user', 'wrong', 'new');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Current password is incorrect');
    });

    it('should handle generic error', async () => {
      (getUserForPasswordChange as jest.Mock).mockRejectedValue(new Error('fail'));
      const result = await authService.changePassword('user', 'pass', 'new');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to change password');
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should successfully cleanup sessions', async () => {
      (deleteExpiredSessions as jest.Mock).mockResolvedValue({ rowCount: 5 });
      await authService.cleanupExpiredSessions();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Cleaned up 5'));
    });

    it('should not log if no sessions cleaned up', async () => {
      (deleteExpiredSessions as jest.Mock).mockResolvedValue({ rowCount: 0 });
      await authService.cleanupExpiredSessions();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors', async () => {
      (deleteExpiredSessions as jest.Mock).mockRejectedValue(new Error('fail'));
      await authService.cleanupExpiredSessions();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
