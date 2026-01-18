import { getPool } from '../postgres.js';

export async function createPasswordResetToken({ token, userId, expiresAt }) {
  const pool = getPool();
  await pool.query(
    'INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
    [token, userId, expiresAt]
  );
}

export async function findValidPasswordResetToken({ token }) {
  const pool = getPool();
  const res = await pool.query(
    'SELECT * FROM password_reset_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > now() LIMIT 1',
    [token]
  );
  return res.rows[0] || null;
}

export async function markPasswordResetTokenUsed({ token }) {
  const pool = getPool();
  await pool.query('UPDATE password_reset_tokens SET used_at = now() WHERE token = $1 AND used_at IS NULL', [token]);
}

export async function invalidateAllResetTokensForUser({ userId }) {
  const pool = getPool();
  await pool.query('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId]);
}
