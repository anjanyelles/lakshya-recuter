export function normalizeEmail(value) {
  if (!value) return null;
  const s = String(value).trim().toLowerCase();
  if (!s) return null;
  return s;
}

export function normalizePhone(value) {
  if (!value) return null;
  const digits = String(value).replace(/[^0-9+]/g, '');
  if (!digits) return null;
  return digits;
}

export function normalizeName(value) {
  if (!value) return null;
  const s = String(value).trim().replace(/\s+/g, ' ');
  if (!s) return null;
  return s;
}

export function normalizeSkills(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v).trim())
      .filter(Boolean)
      .map((v) => v.toLowerCase());
  }

  const s = String(value);
  return s
    .split(/[,;\n\t\|]+/g)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => v.toLowerCase());
}
