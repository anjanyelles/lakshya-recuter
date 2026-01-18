import { getPool } from '../postgres.js';

export async function createSession({
  userId,
  refreshTokenHash,
  deviceId,
  ipAddress,
  userAgent,
  deviceType,
  location,
  expiresAt
}) {
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO sessions (user_id, refresh_token_hash, device_id, ip_address, user_agent, device_type, location, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [userId, refreshTokenHash, deviceId, ipAddress, userAgent, deviceType, location, expiresAt]
  );
  return res.rows[0];
}

export async function findSessionById(id) {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM sessions WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0] || null;
}

export async function findSessionByRefresh({ userId, refreshTokenHash }) {
  const pool = getPool();
  const res = await pool.query(
    'SELECT * FROM sessions WHERE user_id = $1 AND refresh_token_hash = $2 LIMIT 1',
    [userId, refreshTokenHash]
  );
  return res.rows[0] || null;
}

export async function updateSessionActivity({ sessionId }) {
  const pool = getPool();
  await pool.query('UPDATE sessions SET last_activity_at = now() WHERE id = $1', [sessionId]);
}

export async function revokeSession({ sessionId, reason }) {
  const pool = getPool();
  await pool.query(
    'UPDATE sessions SET revoked_at = now(), revoke_reason = $2 WHERE id = $1 AND revoked_at IS NULL',
    [sessionId, reason]
  );
}
