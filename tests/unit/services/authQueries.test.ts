import {
  getUserForLogin,
  getUserForPasswordChange,
  getSessionUser,
} from '../../../server/src/services/authQueries';
import { query } from '../../../server/src/config/database';

jest.mock('../../../server/src/config/database');

describe('authQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserForLogin', () => {
    it('should query user correctly', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }] });
      const result = await getUserForLogin('test');
      expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), ['test']);
      expect(result.rows[0].id).toBe(1);
    });
  });

  describe('getSessionUser', () => {
    it('should query session user correctly', async () => {
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }] });
      const result = await getSessionUser('hash');
      expect(query).toHaveBeenCalledWith(expect.stringContaining('app.user_sessions'), ['hash']);
      expect(result.rows[0].id).toBe(1);
    });
  });
});
