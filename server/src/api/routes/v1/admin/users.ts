export {};
const express = require('express');
const router = express.Router();
const { adminDbService } = require('../../../../config/container');
const logger = require('../../../../logging/logger');

function parseUserId(param: string): number | null {
  const id = Number.parseInt(param, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get('/', async (_req, res) => {
  try {
    const users = await adminDbService.listUsers();
    res.json({ success: true, users });
  } catch (error: any) {
    logger.error('Failed to list users', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to list users' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { username, email, password, role = 'user', forcePasswordChange = false } = req.body;

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ success: false, error: 'username, email, and password are required' });
    }
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, error: 'role must be user or admin' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, error: 'password must be at least 8 chars' });
    }

    const user = await adminDbService.createAppUser(
      String(username).trim(),
      String(email).trim(),
      String(password),
      role,
      Boolean(forcePasswordChange)
    );
    res.status(201).json({ success: true, user });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'username or email already exists' });
    }
    logger.error('Failed to create user', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

router.put('/:id/active', async (req, res) => {
  try {
    const userId = parseUserId(req.params.id);
    const { isActive } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'invalid user id' });
    }
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isActive must be boolean' });
    }

    const user = await adminDbService.setAppUserActive(userId, isActive);
    if (!user) {
      return res.status(404).json({ success: false, error: 'user not found' });
    }

    res.json({ success: true, user });
  } catch (error: any) {
    logger.error('Failed to update user active status', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to update user active status' });
  }
});

router.put('/:id/password', async (req, res) => {
  try {
    const userId = parseUserId(req.params.id);
    const { password, forcePasswordChange = true } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'invalid user id' });
    }
    if (!password || String(password).length < 8) {
      return res.status(400).json({ success: false, error: 'password must be at least 8 chars' });
    }

    const user = await adminDbService.resetAppUserPassword(
      userId,
      String(password),
      Boolean(forcePasswordChange)
    );
    if (!user) {
      return res.status(404).json({ success: false, error: 'user not found' });
    }

    res.json({ success: true, user });
  } catch (error: any) {
    logger.error('Failed to reset user password', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to reset user password' });
  }
});

module.exports = router;
