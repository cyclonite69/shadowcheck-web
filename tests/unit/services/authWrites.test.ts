import {
  createUserSession,
  updateLastLogin,
  deleteUserSession,
  deleteExpiredSessions,
  updateUserPassword,
} from '../../../server/src/services/authWrites';
import { query } from '../../../server/src/config/database';

jest.mock('../../../server/src/config/database');

describe('authWrites', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUserSession', () => {
    it('should insert session correctly', async () => {
      (query as jest.Mock).mockResolvedValue({ rowCount: 1 });
      await createUserSession(1, 'hash', new Date(), 'agent', '127.0.0.1');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app.user_sessions'),
        expect.any(Array)
      );
    });
  });

  describe('updateUserPassword', () => {
    it('should update password successfully', async () => {
      (query as jest.Mock).mockResolvedValue({ rowCount: 1 });
      await expect(updateUserPassword(1, 'newhash')).resolves.not.toThrow();
    });
  });
});
