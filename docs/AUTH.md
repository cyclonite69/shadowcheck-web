# Authentication & Authorization Documentation

This document describes the authentication and authorization system for ShadowCheckStatic.

## Overview

ShadowCheckStatic uses a session-based authentication system with the following characteristics:

- **Session-based**: Uses secure HTTP-only cookies for session tokens
- **Role-based**: Supports user and admin roles
- **Password hashing**: Uses bcrypt with 12 salt rounds
- **Session duration**: 24 hours (configurable)
- **Secure token storage**: Tokens are hashed with SHA-256 before storage

## Architecture

### Server-Side Components

| Component                                                   | Path                                      | Description                 |
| ----------------------------------------------------------- | ----------------------------------------- | --------------------------- |
| [`authService`](server/src/services/authService.ts)         | `server/src/services/authService.ts`      | Core authentication logic   |
| [`authMiddleware`](server/src/middleware/authMiddleware.ts) | `server/src/middleware/authMiddleware.ts` | Express middleware for auth |

### Client-Side Components

| Component                                               | Path                                       | Description               |
| ------------------------------------------------------- | ------------------------------------------ | ------------------------- |
| [`useAuth`](client/src/hooks/useAuth.tsx)               | `client/src/hooks/useAuth.tsx`             | React hook for auth state |
| [`LoginForm`](client/src/components/auth/LoginForm.tsx) | `client/src/components/auth/LoginForm.tsx` | Login form component      |

## User Roles

| Role    | Description   | Permissions                               |
| ------- | ------------- | ----------------------------------------- |
| `user`  | Standard user | View dashboards, networks, analytics      |
| `admin` | Administrator | All user permissions + admin panel access |

## Authentication Flow

### Login Process

```
1. User submits credentials (username/password)
2. Server validates credentials against database
3. Server creates session token (32-byte random hex)
4. Token is hashed with SHA-256 and stored in database
5. Session cookie set with unencrypted token
6. User object returned to client
```

### Session Validation

```
1. Request received with session cookie
2. Middleware extracts token from cookie
3. Token hashed and looked up in database
4. Check session expiration (24 hours)
5. User returned if valid session exists
```

### Logout Process

```
1. Client requests logout endpoint
2. Server deletes session from database
3. Client clears session cookie
```

## API Endpoints

### Authentication Endpoints

| Method | Endpoint           | Description       | Auth Required |
| ------ | ------------------ | ----------------- | ------------- |
| POST   | `/api/auth/login`  | User login        | No            |
| POST   | `/api/auth/logout` | User logout       | Yes           |
| GET    | `/api/auth/me`     | Get current user  | No (optional) |
| GET    | `/api/auth/status` | Auth status check | No            |

### Login Request

```json
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "securepassword"
}
```

### Login Response

```json
{
  "success": true,
  "token": "abc123...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### Error Responses

```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

## Middleware Functions

### `requireAuth`

Ensures the request has a valid session token.

```typescript
import { requireAuth } from '../middleware/authMiddleware';

router.get('/protected', requireAuth, (req, res) => {
  // req.user is available
});
```

### `requireAdmin`

Ensures the user has admin role.

```typescript
import { requireAdmin } from '../middleware/authMiddleware';

router.get('/admin-only', requireAdmin, (req, res) => {
  // Only admins can access
});
```

### `optionalAuth`

Adds user to request if valid token exists, but doesn't require auth.

```typescript
import { optionalAuth } from '../middleware/authMiddleware';

router.get('/optional', optionalAuth, (req, res) => {
  // req.user may or may not be present
});
```

## Client Integration

### AuthProvider

Wrap your application with the AuthProvider:

```tsx
import { AuthProvider } from './hooks/useAuth';

function App() {
  return (
    <AuthProvider>
      <YourApp />
    </AuthProvider>
  );
}
```

### Using the Auth Hook

```tsx
import { useAuth } from './hooks/useAuth';

function Dashboard() {
  const { user, isAuthenticated, isAdmin, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div>
      <h1>Welcome, {user.username}</h1>
      {isAdmin && <AdminPanel />}
    </div>
  );
}
```

### User Type

```typescript
interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
}
```

### AuthContext Type

```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
  isAdmin: boolean;
  isAuthenticated: boolean;
}
```

## Security Measures

### Password Security

- **Hashing**: bcrypt with 12 salt rounds
- **Minimum length**: Configurable (check `.env`)
- **Storage**: Never stored in plain text

### Session Security

- **Token length**: 32 bytes (256 bits)
- **Hashing**: SHA-256 for storage
- **Duration**: 24 hours
- **IP tracking**: Logs IP address on login
- **User agent tracking**: Logs user agent

### Cookie Security

- **HTTPOnly**: Prevents JavaScript access
- **Secure**: Only sent over HTTPS
- **SameSite**: Configurable (typically 'strict' or 'lax')

## Environment Variables

```bash
# Session configuration
SESSION_SECRET=your-secret-key
SESSION_DURATION=86400000  # 24 hours in milliseconds

# Cookie settings
COOKIE_SECURE=true
COOKIE_HTTPONLY=true
COOKIE_SAME_SITE=strict
```

## Database Schema

### Users Table

```sql
CREATE TABLE app.users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);
```

### User Sessions Table

```sql
CREATE TABLE app.user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES app.users(id),
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast session lookup
CREATE INDEX idx_user_sessions_token ON app.user_sessions(token_hash);
```

## Testing Authentication

### API Testing

Use session cookies for authenticated requests:

```typescript
import request from 'supertest';
import { createApp } from '../server/src/utils/appInit';

describe('Protected Routes', () => {
  let app: Express.Application;
  let sessionCookie: string;

  beforeAll(async () => {
    app = await createApp();

    // Login to get session cookie
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password' });

    sessionCookie = loginResponse.headers['set-cookie'];
  });

  it('should allow access with valid session', async () => {
    await request(app).get('/api/auth/me').set('Cookie', sessionCookie).expect(200);
  });
});
```

### Testing Middleware

```typescript
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';

describe('Auth Middleware', () => {
  it('should reject requests without token', () => {
    const req = { headers: {} } as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check if session cookie is being sent
   - Verify token hasn't expired
   - Check if user account is active

2. **Session not persisting**
   - Ensure cookies are enabled
   - Check cookie domain configuration
   - Verify SameSite settings

3. **Login fails with correct password**
   - Check database connection
   - Verify bcrypt version compatibility
   - Check password hash in database

### Debug Logging

Authentication events are logged to the application logger:

```typescript
import logger from '../logging/logger';

// Successful login
logger.info(`User ${username} logged in successfully`, { userId, ipAddress });

// Failed login
logger.warn(`Failed login attempt`, { username, ipAddress });

// Session cleanup
logger.info(`Cleaned up ${count} expired sessions`);
```

## Related Documentation

- [API Reference](API_REFERENCE.md)
- [Security Guidelines](SECURITY.md)
- [Environment Configuration](CONFIG.md)
- [Client Documentation](CLIENT.md)
- [Testing Strategy](TESTING.md)
