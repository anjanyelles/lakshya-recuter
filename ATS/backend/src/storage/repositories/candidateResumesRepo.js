import { getPool } from '../postgres.js';

export async function listResumes({ userId }) {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM candidate_resumes WHERE user_id = $1 ORDER BY is_primary DESC, created_at DESC', [
    userId
  ]);
  return res.rows;
}

export async function addResume({
  userId,
  filename,
  contentType,
  sizeBytes,
  blobName,
  blobUrl,
  extractedText,
  isPrimary
}) {
  const pool = getPool();

  if (isPrimary) {
    await pool.query('UPDATE candidate_resumes SET is_primary = false WHERE user_id = $1', [userId]);
  }

  const res = await pool.query(
    `INSERT INTO candidate_resumes (user_id, filename, content_type, size_bytes, blob_name, blob_url, extracted_text, is_primary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [userId, filename, contentType, sizeBytes, blobName, blobUrl, extractedText, Boolean(isPrimary)]
  );
  return res.rows[0];
}

export async function setPrimaryResume({ userId, id }) {
  const pool = getPool();
  await pool.query('UPDATE candidate_resumes SET is_primary = false WHERE user_id = $1', [userId]);
  const res = await pool.query(
    'UPDATE candidate_resumes SET is_primary = true, updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );
  return res.rows[0] || null;
}

export async function findResumeById({ userId, id }) {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM candidate_resumes WHERE id = $1 AND user_id = $2 LIMIT 1', [id, userId]);
  return res.rows[0] || null;
}

export async function deleteResume({ userId, id }) {
  const pool = getPool();
  await pool.query('DELETE FROM candidate_resumes WHERE id = $1 AND user_id = $2', [id, userId]);
}
