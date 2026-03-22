export {};

const bcrypt = require('bcrypt');
const { adminQuery } = require('./adminDbService');
const { query } = require('../config/database');

// Duplicated from adminDbService.ts
const AUTH_SALT_ROUNDS = 12;

export async function listUsers(): Promise<any[]> {
  try {
    // Read path uses app pool to avoid hard dependency on admin credentials.
    const result = await query(
      `SELECT id, username, email, role, is_active, force_password_change, created_at, last_login
       FROM app.users
       ORDER BY username ASC`
    );
    return result.rows;
  } catch (error: any) {
    // Backward compatibility for older schemas that do not yet have force_password_change.
    if (error?.code === '42703') {
      const fallback = await query(
        `SELECT id, username, email, role, is_active, false AS force_password_change, created_at, last_login
         FROM app.users
         ORDER BY username ASC`
      );
      return fallback.rows;
    }
    throw error;
  }
}

export async function createAppUser(
  username: string,
  email: string,
  password: string,
  role: 'user' | 'admin' = 'user',
  forcePasswordChange = false
): Promise<any> {
  const passwordHash = await bcrypt.hash(password, AUTH_SALT_ROUNDS);
  try {
    const result = await adminQuery(
      `INSERT INTO app.users (username, email, password_hash, role, force_password_change)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, role, is_active, force_password_change, created_at, last_login`,
      [username, email, passwordHash, role, forcePasswordChange]
    );
    return result.rows[0];
  } catch (error: any) {
    if (error?.code === '42703') {
      const fallback = await adminQuery(
        `INSERT INTO app.users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, role, is_active, false AS force_password_change, created_at, last_login`,
        [username, email, passwordHash, role]
      );
      return fallback.rows[0];
    }
    throw error;
  }
}

export async function setAppUserActive(userId: number, isActive: boolean): Promise<any | null> {
  let result;
  try {
    result = await adminQuery(
      `UPDATE app.users
       SET is_active = $1
       WHERE id = $2
       RETURNING id, username, email, role, is_active, force_password_change, created_at, last_login`,
      [isActive, userId]
    );
  } catch (error: any) {
    if (error?.code !== '42703') {
      throw error;
    }
    result = await adminQuery(
      `UPDATE app.users
       SET is_active = $1
       WHERE id = $2
       RETURNING id, username, email, role, is_active, false AS force_password_change, created_at, last_login`,
      [isActive, userId]
    );
  }

  if (result.rows.length === 0) {
    return null;
  }

  if (!isActive) {
    // Invalidate active sessions for disabled accounts.
    await adminQuery(`DELETE FROM app.user_sessions WHERE user_id = $1`, [userId]);
  }

  return result.rows[0];
}

export async function resetAppUserPassword(
  userId: number,
  password: string,
  forcePasswordChange = true
): Promise<any | null> {
  const passwordHash = await bcrypt.hash(password, AUTH_SALT_ROUNDS);
  try {
    const result = await adminQuery(
      `UPDATE app.users
       SET password_hash = $1, force_password_change = $2
       WHERE id = $3
       RETURNING id, username, email, role, is_active, force_password_change, created_at, last_login`,
      [passwordHash, forcePasswordChange, userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error: any) {
    if (error?.code !== '42703') {
      throw error;
    }
    const fallback = await adminQuery(
      `UPDATE app.users
       SET password_hash = $1
       WHERE id = $2
       RETURNING id, username, email, role, is_active, false AS force_password_change, created_at, last_login`,
      [passwordHash, userId]
    );
    return fallback.rows.length > 0 ? fallback.rows[0] : null;
  }
}

module.exports = {
  listUsers,
  createAppUser,
  setAppUserActive,
  resetAppUserPassword,
};
