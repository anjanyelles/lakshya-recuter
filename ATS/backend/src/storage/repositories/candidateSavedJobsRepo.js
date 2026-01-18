import { getPool } from '../postgres.js';

export async function saveJobForCandidate({ userId, jobId }) {
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO candidate_saved_jobs (user_id, job_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, job_id) DO NOTHING
     RETURNING *`,
    [userId, jobId]
  );
  return res.rows[0] || null;
}

export async function unsaveJobForCandidate({ userId, jobId }) {
  const pool = getPool();
  await pool.query('DELETE FROM candidate_saved_jobs WHERE user_id = $1 AND job_id = $2', [userId, jobId]);
  return true;
}

export async function listSavedJobIdsForCandidate({ userId }) {
  const pool = getPool();
  const res = await pool.query('SELECT job_id FROM candidate_saved_jobs WHERE user_id = $1', [userId]);
  return res.rows.map((r) => r.job_id);
}

export async function listSavedJobsForCandidate({ userId, limit = 100, offset = 0 }) {
  const pool = getPool();
  const res = await pool.query(
    `SELECT
       j.id,
       j.job_title,
       j.job_locations,
       j.employment_type,
       j.experience_level,
       j.work_mode,
       j.salary_min,
       j.salary_max,
       j.salary_currency,
       j.salary_visible,
       j.published_at,
       j.application_deadline,
       j.views_count,
       c.name AS company_name,
       c.logo_url AS company_logo_url
     FROM candidate_saved_jobs s
     JOIN jobs j ON j.id = s.job_id
     LEFT JOIN companies c ON c.id = j.company_id
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return res.rows;
}
