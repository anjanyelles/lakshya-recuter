export function sanitizeUserRow(u) {
  if (!u) return null;
  const {
    password_hash,
    failed_login_attempts,
    lock_until,
    ...rest
  } = u;
  return rest;
}
