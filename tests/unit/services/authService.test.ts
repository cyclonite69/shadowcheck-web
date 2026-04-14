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
} from '../../../server/src/services/authWrites';
import { createAppUser } from '../../../server/src/services/adminUsersService';
import logger from '../../../server/src/logging/logger';
import bcrypt from 'bcrypt';

jest.mock('../../../server/src/services/authQueries');
jest.mock('../../../server/src/services/authWrites');
jest.mock('../../../server/src/services/adminUsersService');
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
    });

    it('should return error for invalid user', async () => {
      (getUserForLogin as jest.Mock).mockResolvedValue({ rows: [] });
      const result = await authService.login('unknown', 'password');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
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
  });
});
