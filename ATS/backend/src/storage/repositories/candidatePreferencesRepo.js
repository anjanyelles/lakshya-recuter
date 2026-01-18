import { getPool } from '../postgres.js';

export async function getPreferences({ userId }) {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM candidate_preferences WHERE user_id = $1 LIMIT 1', [userId]);
  return res.rows[0] || null;
}

export async function upsertPreferences({
  userId,
  jobAlertsEnabled,
  emailNotifications,
  preferredLocations,
  salaryMin,
  salaryMax,
  employmentTypes
}) {
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO candidate_preferences
      (user_id, job_alerts_enabled, email_notifications, preferred_locations, salary_min, salary_max, employment_types, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now())
     ON CONFLICT (user_id)
     DO UPDATE SET
       job_alerts_enabled = EXCLUDED.job_alerts_enabled,
       email_notifications = EXCLUDED.email_notifications,
       preferred_locations = EXCLUDED.preferred_locations,
       salary_min = EXCLUDED.salary_min,
       salary_max = EXCLUDED.salary_max,
       employment_types = EXCLUDED.employment_types,
       updated_at = now()
     RETURNING *`,
    [
      userId,
      Boolean(jobAlertsEnabled),
      emailNotifications || {},
      preferredLocations || [],
      salaryMin,
      salaryMax,
      employmentTypes || []
    ]
  );
  return res.rows[0];
}
