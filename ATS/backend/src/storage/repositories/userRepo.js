import { getPool } from '../postgres.js';

export async function findUserByEmail(email) {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
  return res.rows[0] || null;
}

export async function findUserById(id) {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0] || null;
}

export async function updateUserLoginSuccess({ userId }) {
  const pool = getPool();
  await pool.query(
    'UPDATE users SET failed_login_attempts = 0, lock_until = NULL, last_login = now(), updated_at = now() WHERE id = $1',
    [userId]
  );
}

export async function updateUserLoginFailure({ userId, lockUntil }) {
  const pool = getPool();
  await pool.query(
    'UPDATE users SET failed_login_attempts = failed_login_attempts + 1, lock_until = $2, updated_at = now() WHERE id = $1',
    [userId, lockUntil]
  );
}

export async function updateUserPasswordHash({ userId, passwordHash }) {
  const pool = getPool();
  await pool.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [userId, passwordHash]);
}

export async function updateUserBasicProfile({ userId, firstName, lastName, phoneNumber, location }) {
  const pool = getPool();
  const res = await pool.query(
    `UPDATE users
     SET first_name = $2,
         last_name = $3,
         phone_number = $4,
         location = $5,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [userId, firstName, lastName, phoneNumber, location]
  );
  return res.rows[0] || null;
}

export async function updateUserProfilePictureUrl({ userId, url }) {
  const pool = getPool();
  await pool.query('UPDATE users SET profile_picture_url = $2, updated_at = now() WHERE id = $1', [userId, url]);
}
