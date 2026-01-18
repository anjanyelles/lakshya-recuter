import { getPool } from '../postgres.js';

export async function listEducation({ userId }) {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM candidate_education WHERE user_id = $1 ORDER BY start_date DESC NULLS LAST, created_at DESC', [
    userId
  ]);
  return res.rows;
}

export async function addEducation({ userId, school, degree, fieldOfStudy, startDate, endDate, grade, description }) {
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO candidate_education (user_id, school, degree, field_of_study, start_date, end_date, grade, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [userId, school, degree, fieldOfStudy, startDate, endDate, grade, description]
  );
  return res.rows[0];
}

export async function updateEducation({ userId, id, school, degree, fieldOfStudy, startDate, endDate, grade, description }) {
  const pool = getPool();
  const res = await pool.query(
    `UPDATE candidate_education
     SET school = $3,
         degree = $4,
         field_of_study = $5,
         start_date = $6,
         end_date = $7,
         grade = $8,
         description = $9,
         updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, school, degree, fieldOfStudy, startDate, endDate, grade, description]
  );
  return res.rows[0] || null;
}

export async function deleteEducation({ userId, id }) {
  const pool = getPool();
  await pool.query('DELETE FROM candidate_education WHERE id = $1 AND user_id = $2', [id, userId]);
}
