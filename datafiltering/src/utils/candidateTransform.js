function toStr(v) {
  if (v == null) return '';
  return String(v);
}

export function normalizeEmail(email) {
  const s = toStr(email).trim().toLowerCase();
  if (!s) return null;
  // very lightweight validation: keep as null if it doesn't look like an email
  if (!s.includes('@') || s.startsWith('@') || s.endsWith('@')) return null;
  return s;
}

export function normalizeName(name) {
  const s = toStr(name)
    .replace(/\s+/g, ' ')
    .trim();
  return s || null;
}

export function normalizePhone(phone, { defaultCountryCode } = {}) {
  const raw = toStr(phone).trim();
  if (!raw) return null;

  // Keep a leading + if present; otherwise strip everything but digits
  const hasPlus = raw.startsWith('+');
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // If the original had a +, keep it. Otherwise, optionally prepend country code
  if (hasPlus) return `+${digits}`;

  // Handle common case: 10-digit local numbers; you can customize per your needs.
  if (defaultCountryCode && digits.length === 10) {
    const cc = String(defaultCountryCode).replace(/\D/g, '');
    if (cc) return `+${cc}${digits}`;
  }

  // Fallback: return digits only (your downstream can decide)
  return digits;
}

export function normalizeSkills(skills) {
  if (skills == null) return [];

  if (Array.isArray(skills)) {
    return skills
      .flatMap((s) => toStr(s).split(/[,/;|\n]/g))
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const s = toStr(skills);
  if (!s.trim()) return [];

  return s
    .split(/[,/;|\n]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function getRawValue(row, header) {
  if (!row || typeof row !== 'object' || !header) return undefined;

  // Try exact key first
  if (Object.prototype.hasOwnProperty.call(row, header)) return row[header];

  // Fallback: case-insensitive match
  const target = String(header).trim().toLowerCase();
  for (const k of Object.keys(row)) {
    if (String(k).trim().toLowerCase() === target) return row[k];
  }

  return undefined;
}

export function transformCandidateRow({ row, mapping, options = {} }) {
  if (!row || typeof row !== 'object') {
    throw new Error('row must be an object');
  }
  if (!mapping || typeof mapping !== 'object') {
    throw new Error('mapping must be an object: { canonicalField: sourceHeader }');
  }

  const out = {};

  const fullNameHeader = mapping.fullName;
  const emailHeader = mapping.email;
  const phoneHeader = mapping.phone;
  const designationHeader = mapping.designation;
  const currentCompanyHeader = mapping.currentCompany;
  const experienceYearsHeader = mapping.experienceYears;
  const skillsHeader = mapping.skills;
  const locationHeader = mapping.location;

  if (fullNameHeader) out.fullName = normalizeName(getRawValue(row, fullNameHeader));
  if (emailHeader) out.email = normalizeEmail(getRawValue(row, emailHeader));
  if (phoneHeader) out.phone = normalizePhone(getRawValue(row, phoneHeader), options.phone);

  if (designationHeader) out.designation = normalizeName(getRawValue(row, designationHeader));
  if (currentCompanyHeader) out.currentCompany = normalizeName(getRawValue(row, currentCompanyHeader));

  if (experienceYearsHeader) {
    const v = toStr(getRawValue(row, experienceYearsHeader)).trim();
    const n = v ? Number(String(v).replace(/[^0-9.]/g, '')) : NaN;
    out.experienceYears = Number.isFinite(n) ? n : null;
  }

  if (skillsHeader) out.skills = normalizeSkills(getRawValue(row, skillsHeader));
  if (locationHeader) out.location = normalizeName(getRawValue(row, locationHeader));

  // Drop null/empty values
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (v == null) delete out[k];
    if (Array.isArray(v) && v.length === 0) delete out[k];
  }

  return out;
}
