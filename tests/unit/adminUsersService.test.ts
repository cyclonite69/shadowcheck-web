/**
 * AdminUsersService Unit Tests
 */

const bcrypt = require('bcrypt');
import { adminQuery } from '../../server/src/services/adminDbService';
import { query } from '../../server/src/config/database';
import logger from '../../server/src/logging/logger';

// Note: adminUsersService uses CommonJS require for some dependencies,
// so we need to be careful with mocking.
const adminUsersService = require('../../server/src/services/adminUsersService');

jest.mock('bcrypt');
jest.mock('../../server/src/services/adminDbService');
jest.mock('../../server/src/config/database');
jest.mock('../../server/src/logging/logger');

describe('AdminUsersService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listUsers', () => {
    it('should list all users', async () => {
      const mockUsers = [
        { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin', is_active: true },
        { id: 2, username: 'user1', email: 'user1@example.com', role: 'user', is_active: true },
      ];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockUsers });

      const users = await adminUsersService.listUsers();

      expect(users).toEqual(mockUsers);
      expect(query).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT id, username, email, role/i)
      );
    });

    it('should use fallback if force_password_change column is missing (42703)', async () => {
      const dbError = new Error('column does not exist');
      (dbError as any).code = '42703';
      (query as jest.Mock).mockRejectedValueOnce(dbError);

      const mockUsers = [{ id: 1, username: 'admin', force_password_change: false }];
      (query as jest.Mock).mockResolvedValueOnce({ rows: mockUsers });

      const users = await adminUsersService.listUsers();

      expect(users).toEqual(mockUsers);
      expect(query).toHaveBeenCalledTimes(2);
      expect(query).toHaveBeenLastCalledWith(
        expect.stringMatching(/false AS force_password_change/i)
      );
    });

    it('should throw other database errors', async () => {
      (query as jest.Mock).mockRejectedValueOnce(new Error('connection timeout'));

      await expect(adminUsersService.listUsers()).rejects.toThrow('connection timeout');
    });
  });

  describe('createAppUser', () => {
    const pwd = 'plainPassword';
    const h_pwd = 'hashedPassword';

    it('should create a new user', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce(h_pwd);
      const mockUser = { id: 1, username: 'newuser', role: 'user' };
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      const user = await adminUsersService.createAppUser(
        'newuser',
        'new@example.com',
        pwd,
        'user',
        true
      );

      expect(user).toEqual(mockUser);
      expect(bcrypt.hash).toHaveBeenCalledWith(pwd, 12);
      expect(adminQuery).toHaveBeenCalledWith(expect.stringMatching(/INSERT INTO app.users/i), [
        'newuser',
        'new@example.com',
        h_pwd,
        'user',
        true,
      ]);
    });

    it('should create a new user with default role', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce(h_pwd);
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await adminUsersService.createAppUser('newuser', 'new@example.com', pwd);

      expect(adminQuery).toHaveBeenCalledWith(expect.any(String), [
        'newuser',
        'new@example.com',
        h_pwd,
        'user',
        false,
      ]);
    });

    it('should create a new user with undefined role and forcePasswordChange', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce(h_pwd);
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await adminUsersService.createAppUser(
        'newuser',
        'new@example.com',
        pwd,
        undefined,
        undefined
      );

      expect(adminQuery).toHaveBeenCalledWith(expect.any(String), [
        'newuser',
        'new@example.com',
        h_pwd,
        'user',
        false,
      ]);
    });

    it('should create an admin user', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce(h_pwd);
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await adminUsersService.createAppUser('adminuser', 'admin@example.com', pwd, 'admin', false);

      expect(adminQuery).toHaveBeenCalledWith(expect.any(String), [
        'adminuser',
        'admin@example.com',
        h_pwd,
        'admin',
        false,
      ]);
    });

    it('should use fallback if force_password_change column is missing', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce(h_pwd);
      const dbError = new Error('column does not exist');
      (dbError as any).code = '42703';
      (adminQuery as jest.Mock).mockRejectedValueOnce(dbError);

      const mockUser = { id: 1, username: 'newuser', force_password_change: false };
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      const user = await adminUsersService.createAppUser('newuser', 'new@example.com', pwd, 'user');

      expect(user).toEqual(mockUser);
      expect(adminQuery).toHaveBeenCalledTimes(2);

      const lastCall = (adminQuery as jest.Mock).mock.calls[1];
      expect(lastCall[0]).toContain('false AS force_password_change');
      expect(lastCall[0]).not.toMatch(/INSERT INTO.*force_password_change/i);
      expect(lastCall[1]).toEqual(['newuser', 'new@example.com', h_pwd, 'user']);
    });

    it('should throw other database errors', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce(h_pwd);
      (adminQuery as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

      await expect(adminUsersService.createAppUser('u', 'e', 'p')).rejects.toThrow('DB error');
    });
  });

  describe('setAppUserActive', () => {
    it('should update user active status', async () => {
      const mockUser = { id: 1, username: 'user1', is_active: true };
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      const user = await adminUsersService.setAppUserActive(1, true);

      expect(user).toEqual(mockUser);
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE app.users\s+SET is_active = \$1/i),
        [true, 1]
      );
    });

    it('should invalidate sessions when disabling a user', async () => {
      const mockUser = { id: 1, username: 'user1', is_active: false };
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rowCount: 5 });

      const user = await adminUsersService.setAppUserActive(1, false);

      expect(user).toEqual(mockUser);
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE FROM app.user_sessions WHERE user_id = \$1/i),
        [1]
      );
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Invalidated 5 sessions'));
    });

    it('should handle 0 invalidated sessions', async () => {
      const mockUser = { id: 1, username: 'user1', is_active: false };
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rowCount: 0 });

      await adminUsersService.setAppUserActive(1, false);

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Invalidated 0 sessions'));
    });

    it('should log but not throw if session invalidation fails', async () => {
      const mockUser = { id: 1, username: 'user1', is_active: false };
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });
      (adminQuery as jest.Mock).mockRejectedValueOnce(new Error('session table missing'));

      const user = await adminUsersService.setAppUserActive(1, false);

      expect(user).toEqual(mockUser);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('SECURITY CRITICAL: Failed to invalidate sessions'),
        expect.any(Object)
      );
    });

    it('should return null if user not found', async () => {
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const user = await adminUsersService.setAppUserActive(999, true);

      expect(user).toBeNull();
    });

    it('should handle column missing error', async () => {
      const dbError = new Error('column does not exist');
      (dbError as any).code = '42703';
      (adminQuery as jest.Mock).mockRejectedValueOnce(dbError);

      const mockUser = { id: 1, is_active: true };
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      const user = await adminUsersService.setAppUserActive(1, true);

      expect(user).toEqual(mockUser);
      expect(adminQuery).toHaveBeenCalledTimes(2);
    });

    it('should throw other database errors', async () => {
      (adminQuery as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

      await expect(adminUsersService.setAppUserActive(1, true)).rejects.toThrow('DB error');
    });
  });

  describe('resetAppUserPassword', () => {
    const pwd = 'newPassword';
    const h_pwd = 'newHashedPassword';

    it('should reset user password', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce(h_pwd);
      const mockUser = { id: 1, username: 'user1' };
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      const user = await adminUsersService.resetAppUserPassword(1, pwd, true);

      expect(user).toEqual(mockUser);
      expect(bcrypt.hash).toHaveBeenCalledWith(pwd, 12);
      expect(adminQuery).toHaveBeenCalledWith(
        expect.stringMatching(/SET password_hash = \$1, force_password_change = \$2/i),
        [h_pwd, true, 1]
      );
    });

    it('should reset user password with default forcePasswordChange', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce(h_pwd);
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await adminUsersService.resetAppUserPassword(1, pwd);

      expect(adminQuery).toHaveBeenCalledWith(expect.any(String), [h_pwd, true, 1]);
    });

    it('should reset user password with undefined forcePasswordChange', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce(h_pwd);
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await adminUsersService.resetAppUserPassword(1, pwd, undefined);

      expect(adminQuery).toHaveBeenCalledWith(expect.any(String), [h_pwd, true, 1]);
    });

    it('should reset user password with explicit forcePasswordChange=false', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce(h_pwd);
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await adminUsersService.resetAppUserPassword(1, pwd, false);

      expect(adminQuery).toHaveBeenCalledWith(expect.any(String), [h_pwd, false, 1]);
    });

    it('should handle column missing error', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce(h_pwd);
      const dbError = new Error('column does not exist');
      (dbError as any).code = '42703';
      (adminQuery as jest.Mock).mockRejectedValueOnce(dbError);

      const mockUser = { id: 1 };
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [mockUser] });

      const user = await adminUsersService.resetAppUserPassword(1, pwd);

      expect(user).toEqual(mockUser);
      expect(adminQuery).toHaveBeenCalledTimes(2);

      const lastCall = (adminQuery as jest.Mock).mock.calls[1];
      expect(lastCall[0]).toContain('false AS force_password_change');
      expect(lastCall[0]).not.toMatch(/SET.*force_password_change/i);
      expect(lastCall[1]).toEqual([h_pwd, 1]);
    });

    it('should return null if user not found', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce(h_pwd);
      (adminQuery as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const user = await adminUsersService.resetAppUserPassword(999, pwd);

      expect(user).toBeNull();
    });

    it('should throw other database errors', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce(h_pwd);
      (adminQuery as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

      await expect(adminUsersService.resetAppUserPassword(1, pwd)).rejects.toThrow('DB error');
    });
  });
});
