import { normalizeEmail, normalizePhone, normalizeName } from './normalize.js';

export function computeCandidateDedupeKey({ email, phone, fullName }) {
  const e = normalizeEmail(email);
  if (e) return `email:${e}`;

  const p = normalizePhone(phone);
  if (p) return `phone:${p}`;

  const n = normalizeName(fullName);
  if (n) return `name:${n.toLowerCase()}`;

  return null;
}
