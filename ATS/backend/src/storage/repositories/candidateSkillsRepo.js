import { getPool } from '../postgres.js';

export async function listCandidateSkills({ userId }) {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM candidate_skills WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return res.rows;
}

export async function upsertCandidateSkill({ userId, name, proficiency }) {
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO candidate_skills (user_id, name, proficiency, created_at, updated_at)
     VALUES ($1,$2,$3, now(), now())
     ON CONFLICT (user_id, name)
     DO UPDATE SET proficiency = EXCLUDED.proficiency, updated_at = now()
     RETURNING *`,
    [userId, name, proficiency]
  );
  return res.rows[0];
}

export async function deleteCandidateSkill({ userId, id }) {
  const pool = getPool();
  await pool.query('DELETE FROM candidate_skills WHERE id = $1 AND user_id = $2', [id, userId]);
}
