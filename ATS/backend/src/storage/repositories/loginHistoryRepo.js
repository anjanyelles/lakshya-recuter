import { getPool } from '../postgres.js';

export async function recordLoginHistory({
  userId,
  ipAddress,
  userAgent,
  deviceType,
  location,
  success,
  failureReason
}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO login_history (user_id, ip_address, user_agent, device_type, location, success, failure_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, ipAddress, userAgent, deviceType, location, success, failureReason]
  );
}
