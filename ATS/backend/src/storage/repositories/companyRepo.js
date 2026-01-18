import { getPool } from '../postgres.js';

export async function findCompanyById(id) {
  if (!id) return null;
  const pool = getPool();
  const res = await pool.query('SELECT * FROM companies WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0] || null;
}
