import { getPool } from '../postgres.js';

export async function addPasswordHistory({ userId, passwordHash }) {
  const pool = getPool();
  await pool.query('INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)', [userId, passwordHash]);
}

export async function getRecentPasswordHashes({ userId, limit = 5 }) {
  const pool = getPool();
  const res = await pool.query(
    'SELECT password_hash FROM password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  return res.rows.map((r) => r.password_hash);
}

export async function trimPasswordHistory({ userId, keep = 5 }) {
  const pool = getPool();
  await pool.query(
    `DELETE FROM password_history
     WHERE user_id = $1
       AND id NOT IN (
         SELECT id FROM password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2
       )`,
    [userId, keep]
  );
}
