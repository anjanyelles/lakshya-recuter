import { getPool } from '../postgres.js';

export async function isBlacklisted({ jti }) {
  const pool = getPool();
  const res = await pool.query(
    'SELECT 1 FROM token_blacklist WHERE jti = $1 AND expires_at > now() LIMIT 1',
    [jti]
  );
  return res.rowCount > 0;
}

export async function blacklistToken({ jti, userId, expiresAt, reason }) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO token_blacklist (jti, user_id, expires_at, reason)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (jti) DO NOTHING`,
    [jti, userId, expiresAt, reason]
  );
}

export async function cleanupExpiredBlacklisted() {
  const pool = getPool();
  await pool.query('DELETE FROM token_blacklist WHERE expires_at <= now()');
}
