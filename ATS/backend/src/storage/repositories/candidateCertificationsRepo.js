import { getPool } from '../postgres.js';

export async function listCertifications({ userId }) {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM candidate_certifications WHERE user_id = $1 ORDER BY issue_date DESC NULLS LAST, created_at DESC', [
    userId
  ]);
  return res.rows;
}

export async function addCertification({
  userId,
  name,
  issuer,
  issueDate,
  expiryDate,
  credentialId,
  credentialUrl
}) {
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO candidate_certifications (user_id, name, issuer, issue_date, expiry_date, credential_id, credential_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [userId, name, issuer, issueDate, expiryDate, credentialId, credentialUrl]
  );
  return res.rows[0];
}

export async function updateCertification({
  userId,
  id,
  name,
  issuer,
  issueDate,
  expiryDate,
  credentialId,
  credentialUrl
}) {
  const pool = getPool();
  const res = await pool.query(
    `UPDATE candidate_certifications
     SET name = $3,
         issuer = $4,
         issue_date = $5,
         expiry_date = $6,
         credential_id = $7,
         credential_url = $8,
         updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, name, issuer, issueDate, expiryDate, credentialId, credentialUrl]
  );
  return res.rows[0] || null;
}

export async function deleteCertification({ userId, id }) {
  const pool = getPool();
  await pool.query('DELETE FROM candidate_certifications WHERE id = $1 AND user_id = $2', [id, userId]);
}
