const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { query } = require('../config/database');
const logger = require('../logging/logger');

class AuthService {
  constructor() {
    this.saltRounds = 12;
    this.sessionDuration = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Authenticate user with username/password
   */
  async login(username, password, userAgent = '', ipAddress = '') {
    try {
      // Find user
      const userResult = await query(
        'SELECT id, username, email, password_hash, role, is_active FROM app.users WHERE username = $1',
        [username]
      );

      if (userResult.rows.length === 0) {
        return { success: false, error: 'Invalid credentials' };
      }

      const user = userResult.rows[0];

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

      await query(
        `INSERT INTO app.user_sessions (user_id, token_hash, expires_at, user_agent, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, tokenHash, expiresAt, userAgent, ipAddress]
      );

      // Update last login
      await query('UPDATE app.users SET last_login = NOW() WHERE id = $1', [user.id]);

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
      };
    } catch (error) {
      logger.error('Login error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Validate session token
   */
  async validateSession(token) {
    try {
      if (!token) {
        return { valid: false, error: 'No token provided' };
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const result = await query(
        `SELECT u.id, u.username, u.email, u.role, u.is_active, s.expires_at
         FROM app.user_sessions s
         JOIN app.users u ON s.user_id = u.id
         WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
        [tokenHash]
      );

      if (result.rows.length === 0) {
        return { valid: false, error: 'Invalid or expired session' };
      }

      const user = result.rows[0];

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
      };
    } catch (error) {
      logger.error('Session validation error:', error);
      return { valid: false, error: 'Session validation failed' };
    }
  }

  /**
   * Logout user (invalidate session)
   */
  async logout(token) {
    try {
      if (!token) {
        return { success: true };
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      await query('DELETE FROM app.user_sessions WHERE token_hash = $1', [tokenHash]);

      return { success: true };
    } catch (error) {
      logger.error('Logout error:', error);
      return { success: false, error: 'Logout failed' };
    }
  }

  /**
   * Create new user (admin only)
   */
  async createUser(username, email, password, role = 'user') {
    try {
      const passwordHash = await bcrypt.hash(password, this.saltRounds);

      const result = await query(
        `INSERT INTO app.users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4) RETURNING id, username, email, role`,
        [username, email, passwordHash, role]
      );

      return { success: true, user: result.rows[0] };
    } catch (error) {
      if (error.code === '23505') {
        // Unique violation
        return { success: false, error: 'Username or email already exists' };
      }
      logger.error('Create user error:', error);
      return { success: false, error: 'Failed to create user' };
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const result = await query('DELETE FROM app.user_sessions WHERE expires_at < NOW()');

      if (result.rowCount > 0) {
        logger.info(`Cleaned up ${result.rowCount} expired sessions`);
      }
    } catch (error) {
      logger.error('Session cleanup error:', error);
    }
  }
}

module.exports = new AuthService();
