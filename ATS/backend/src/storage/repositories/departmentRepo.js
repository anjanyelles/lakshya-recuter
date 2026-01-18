import { getPool } from '../postgres.js';

export async function listDepartmentsByCompany({ companyId }) {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM departments WHERE company_id IS NOT DISTINCT FROM $1 ORDER BY name ASC', [
    companyId
  ]);
  return res.rows;
}
