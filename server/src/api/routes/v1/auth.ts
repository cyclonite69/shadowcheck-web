export {};
const express = require('express');
const router = express.Router();
const authService = require('../../../services/authService');
const { requireAdmin, extractToken } = require('../../../middleware/authMiddleware');
const logger = require('../../../logging/logger');

/**
 * POST /api/auth/login
 * User login
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required',
      });
    }

    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection.remoteAddress || '';

    const result = await authService.login(username, password, userAgent, ipAddress);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    // Set HTTP-only cookie (most secure)
    res.cookie('session_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({
      success: true,
      user: result.user,
      message: 'Login successful',
    });
  } catch (error) {
    logger.error('Login route error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/logout
 * User logout
 */
router.post('/auth/logout', async (req, res) => {
  try {
    const token = extractToken(req);

    if (token) {
      await authService.logout(token);
    }

    // Clear cookie
    res.clearCookie('session_token');

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error('Logout route error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/auth/me', async (req, res) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: 'Not authenticated',
        authenticated: false,
      });
    }

    const result = await authService.validateSession(token);

    if (!result.valid) {
      return res.status(401).json({
        error: result.error,
        authenticated: false,
      });
    }

    res.json({
      authenticated: true,
      user: result.user,
    });
  } catch (error) {
    logger.error('Auth me route error:', error);
    res.status(500).json({
      error: 'Authentication check failed',
      authenticated: false,
    });
  }
});

/**
 * POST /api/auth/create-user
 * Create new user (admin only)
 */
router.post('/auth/create-user', requireAdmin, async (req, res) => {
  try {
    const { username, email, password, role = 'user' } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Username, email, and password are required',
      });
    }

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({
        error: 'Role must be either "user" or "admin"',
      });
    }

    const result = await authService.createUser(username, email, password, role);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    logger.info(`User ${username} created by admin ${req.user.username}`);

    res.json({
      success: true,
      user: result.user,
      message: 'User created successfully',
    });
  } catch (error) {
    logger.error('Create user route error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

module.exports = router;
