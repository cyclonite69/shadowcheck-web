-- Authentication Tables for ShadowCheck
-- Run this migration to add user authentication support

-- Users table
CREATE TABLE IF NOT EXISTS app.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- User sessions table
CREATE TABLE IF NOT EXISTS app.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES app.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON app.user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON app.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON app.user_sessions(expires_at);

-- Create default admin user (password: admin123 - CHANGE THIS!)
INSERT INTO app.users (username, email, password_hash, role) 
VALUES (
    'admin', 
    'admin@shadowcheck.local', 
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXwtGtrmu.Iq', -- admin123
    'admin'
) ON CONFLICT (username) DO NOTHING;

-- Clean up expired sessions (run periodically)
-- DELETE FROM app.user_sessions WHERE expires_at < NOW();
