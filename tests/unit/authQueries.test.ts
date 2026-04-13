/**
 * AuthQueries Unit Tests
 */

import {
  getSessionUser,
  getUserForLogin,
  getUserForPasswordChange,
} from '../../server/src/services/authQueries';
import { query } from '../../server/src/config/database';

jest.mock('../../server/src/config/database');

describe('AuthQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserForLogin()', () => {
    it('should query user by username', async () => {
      const mockResult = { rows: [{ id: 1, username: 'test' }] };
      (query as jest.Mock).mockResolvedValue(mockResult);

      const result = await getUserForLogin('test');

      expect(result).toBe(mockResult);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), ['test']);
    });

    it('should fallback to schema without force_password_change if column missing', async () => {
      const error = new Error('column "force_password_change" does not exist');
      (error as any).code = '42703';
      (query as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          rows: [{ id: 1, username: 'test', force_password_change: false }],
        });

      const result = await getUserForLogin('test');

      expect(result.rows[0].force_password_change).toBe(false);
      expect(query).toHaveBeenCalledTimes(2);
    });

    it('should rethrow other database errors', async () => {
      const error = new Error('DB Error');
      (query as jest.Mock).mockRejectedValue(error);

      await expect(getUserForLogin('test')).rejects.toThrow('DB Error');
    });
  });

  describe('getUserForPasswordChange()', () => {
    it('should query user by username', async () => {
      const mockResult = { rows: [{ id: 1, username: 'test' }] };
      (query as jest.Mock).mockResolvedValue(mockResult);

      const result = await getUserForPasswordChange('test');

      expect(result).toBe(mockResult);
    });

    it('should fallback if column missing', async () => {
      const error = new Error('column missing');
      (error as any).code = '42703';
      (query as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ rows: [{ id: 1, force_password_change: false }] });

      const result = await getUserForPasswordChange('test');
      expect(result.rows[0].id).toBe(1);
      expect(query).toHaveBeenCalledTimes(2);
      expect(query).toHaveBeenLastCalledWith(
        expect.stringContaining('false AS force_password_change'),
        ['test']
      );
    });
  });

  describe('getSessionUser()', () => {
    it('should query session user by token hash', async () => {
      const mockResult = { rows: [{ id: 1 }] };
      (query as jest.Mock).mockResolvedValue(mockResult);

      const result = await getSessionUser('hash');

      expect(result).toBe(mockResult);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('JOIN app.users'), ['hash']);
    });

    it('should fallback if column missing', async () => {
      const error = new Error('column missing');
      (error as any).code = '42703';
      (query as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ rows: [{ id: 1, force_password_change: false }] });

      const result = await getSessionUser('hash');
      expect(result.rows[0].id).toBe(1);
      expect(query).toHaveBeenCalledTimes(2);
      expect(query).toHaveBeenLastCalledWith(
        expect.stringContaining('false AS force_password_change'),
        ['hash']
      );
    });
  });
});
