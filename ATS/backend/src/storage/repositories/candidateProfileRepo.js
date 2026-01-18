import { getPool } from '../postgres.js';

export async function getCandidateProfileByUserId(userId) {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM candidate_profiles WHERE user_id = $1 LIMIT 1', [userId]);
  return res.rows[0] || null;
}

export async function upsertCandidateProfessional({
  userId,
  currentJobTitle,
  yearsOfExperience,
  linkedinUrl,
  portfolioUrl
}) {
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO candidate_profiles (user_id, current_job_title, years_of_experience, linkedin_url, portfolio_url, updated_at)
     VALUES ($1,$2,$3,$4,$5, now())
     ON CONFLICT (user_id)
     DO UPDATE SET
       current_job_title = EXCLUDED.current_job_title,
       years_of_experience = EXCLUDED.years_of_experience,
       linkedin_url = EXCLUDED.linkedin_url,
       portfolio_url = EXCLUDED.portfolio_url,
       updated_at = now()
     RETURNING *`,
    [userId, currentJobTitle, yearsOfExperience, linkedinUrl, portfolioUrl]
  );
  return res.rows[0];
}
