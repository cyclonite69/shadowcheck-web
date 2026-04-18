import request from 'supertest';
import express from 'express';

// Mock the container
jest.mock('../../../../server/src/config/container', () => ({
  authService: {
    login: jest.fn(),
    validateSession: jest.fn(),
    logout: jest.fn(),
    changePassword: jest.fn(),
  },
}));

// Mock auth middleware
jest.mock('../../../../server/src/middleware/authMiddleware', () => ({
  requireAdmin: (req: any, res: any, next: any) => next(),
  extractToken: (req: any) => req.token || 'fake-token',
}));

const { authService } = require('../../../../server/src/config/container');
const authRouter = require('../../../../server/src/api/routes/v1/auth');

const app = express();
app.use(express.json());
app.use('/api/v1', authRouter);

describe('Auth API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    authService.login.mockResolvedValue({
      success: true,
      token: 'fake-jwt-token',
      user: { username: 'testuser', role: 'user' },
    });

    authService.validateSession.mockResolvedValue({
      valid: true,
      user: { username: 'testuser', role: 'user' },
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login a user and set a cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'testuser', password: 'password123' });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['set-cookie']).toBeDefined();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user info', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.username).toBe('testuser');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should clear cookie and return success', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['set-cookie'][0]).toContain('session_token=;');
    });
  });

  describe('GET /api/v1/admin/users', () => {
    it('should not be served by the auth router', async () => {
      const res = await request(app).get('/api/v1/admin/users');

      expect(res.status).toBe(404);
    });
  });
});
