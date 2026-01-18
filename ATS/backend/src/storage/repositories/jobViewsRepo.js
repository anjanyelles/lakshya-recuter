import crypto from 'crypto';

import { getPool } from '../postgres.js';

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

export function computeViewerHash({ req, auth }) {
  const ip = req.headers['x-forwarded-for'] || req.ip || '';
  const ua = req.headers['user-agent'] || '';
  const base = auth?.userId ? `user:${auth.userId}` : `ip:${ip}|ua:${ua}`;
  return sha256(base);
}

export async function recordUniqueJobView({ jobId, viewerHash }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exists = await client.query(
      `SELECT 1
       FROM job_views
       WHERE job_id = $1
         AND viewer_hash = $2
         AND viewed_at >= (now() - interval '24 hours')
       LIMIT 1`,
      [jobId, viewerHash]
    );

    if (exists.rows.length) {
      await client.query('COMMIT');
      return { counted: false };
    }

    await client.query('INSERT INTO job_views (job_id, viewer_hash) VALUES ($1, $2)', [jobId, viewerHash]);
    await client.query('UPDATE jobs SET views_count = views_count + 1, updated_at = now() WHERE id = $1', [jobId]);

    await client.query('COMMIT');
    return { counted: true };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw e;
  } finally {
    client.release();
  }
}
