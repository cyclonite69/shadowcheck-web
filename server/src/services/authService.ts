// @ts-ignore
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getSessionUser, getUserForLogin, getUserForPasswordChange } from './authQueries';
import {
  createUserSession,
  deleteExpiredSessions,
  deleteUserSession,
  updateLastLogin,
  updateUserPassword,
} from './authWrites';
import logger from '../logging/logger';

interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: string;
  password_hash: string;
  is_active: boolean;
  force_password_change?: boolean;
}

class AuthService {
  saltRounds: number;
  sessionDuration: number;

  constructor() {
    this.saltRounds = 12;
    this.sessionDuration = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Authenticate user with username/password
   */
  async login(username: string, password: string, userAgent = '', ipAddress = '') {
    try {
      if (!username || !password) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Find user
      const userResult = await getUserForLogin(username);

      if (userResult.rows.length === 0) {
        return { success: false, error: 'Invalid credentials' };
      }

      const user: AuthUser = userResult.rows[0];

      if (!user.is_active) {
        return { success: false, error: 'Account is disabled' };
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Create session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
      const expiresAt = new Date(Date.now() + this.sessionDuration);

      await createUserSession(user.id, tokenHash, expiresAt, userAgent, ipAddress);

      // Keep login usable on older deployments that missed the narrow last_login grant.
      try {
        await updateLastLogin(user.id);
      } catch (lastLoginError) {
        logger.warn(`Failed to update last_login for user ${username}`, {
          userId: user.id,
          error: lastLoginError,
        });
      }

      logger.info(`User ${username} logged in successfully`, { userId: user.id, ipAddress });

      return {
        success: true,
        token: sessionToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        forcePasswordChange: Boolean(user.force_password_change),
      };
    } catch (error) {
      logger.error('Login error:', error);
      console.error('[AUTH SERVICE ERROR]', error);
      return { success: false, error: 'Authentication backend failure', status: 500 };
    }
  }

  /**
   * Validate session token
   */
  async validateSession(token: string) {
    try {
      if (!token) {
        return { valid: false, error: 'No token provided' };
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const result = await getSessionUser(tokenHash);

      if (result.rows.length === 0) {
        return { valid: false, error: 'Invalid or expired session' };
      }

      const user: AuthUser = result.rows[0];

      if (!user.is_active) {
        return { valid: false, error: 'Account is disabled' };
      }

      return {
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        forcePasswordChange: Boolean(user.force_password_change),
      };
    } catch (error) {
      logger.error('Session validation error:', error);
      return { valid: false, error: 'Session validation failed' };
    }
  }

  /**
   * Logout user (invalidate session)
   */
  async logout(token: string) {
    try {
      if (!token) {
        return { success: true };
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      await deleteUserSession(tokenHash);

      return { success: true };
    } catch (error) {
      logger.error('Logout error:', error);
      return { success: false, error: 'Logout failed' };
    }
  }

  /**
   * Change user password (requires current password verification)
   */
  async changePassword(username: string, currentPassword: string, newPassword: string) {
    try {
      if (!username || !currentPassword || !newPassword) {
        return { success: false, error: 'Invalid credentials' };
      }

      const userResult = await getUserForPasswordChange(username);

      if (userResult.rows.length === 0) {
        return { success: false, error: 'Invalid credentials' };
      }

      const user: AuthUser = userResult.rows[0];

      if (!user.is_active) {
        return { success: false, error: 'Account is disabled' };
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValid) {
        return { success: false, error: 'Current password is incorrect' };
      }

      // Hash and update new password
      const newHash = await bcrypt.hash(newPassword, this.saltRounds);
      await updateUserPassword(user.id, newHash, newPassword);

      logger.info(`Password changed for user ${username}`, { userId: user.id });

      return { success: true };
    } catch (error) {
      logger.error('Change password error:', error);
      return { success: false, error: 'Failed to change password' };
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const result = await deleteExpiredSessions();

      if (result.rowCount && result.rowCount > 0) {
        logger.info(`Cleaned up ${result.rowCount} expired sessions`);
      }
    } catch (error) {
      logger.error('Session cleanup error:', error);
    }
  }
}

const authService = new AuthService();
export default authService;
// @ts-ignore
module.exports = authService;
