import { COMMON_PASSWORDS } from './commonPasswords.js';

function hasUppercase(s) {
  return /[A-Z]/.test(s);
}

function hasLowercase(s) {
  return /[a-z]/.test(s);
}

function hasNumber(s) {
  return /[0-9]/.test(s);
}

function hasSpecial(s) {
  return /[!@#$%^&*]/.test(s);
}

export function evaluatePasswordStrength(password) {
  const pw = String(password || '');

  const checks = {
    minLength: pw.length >= 8,
    uppercase: hasUppercase(pw),
    lowercase: hasLowercase(pw),
    number: hasNumber(pw),
    special: hasSpecial(pw),
    notCommon: pw.length >= 1 && !COMMON_PASSWORDS.has(pw.toLowerCase())
  };

  const errors = [];
  if (!checks.minLength) errors.push('Password must be at least 8 characters.');
  if (!checks.uppercase) errors.push('Password must include at least one uppercase letter.');
  if (!checks.lowercase) errors.push('Password must include at least one lowercase letter.');
  if (!checks.number) errors.push('Password must include at least one number.');
  if (!checks.special) errors.push('Password must include at least one special character (!@#$%^&*).');
  if (!checks.notCommon) errors.push('Password is too common. Choose a stronger password.');

  const passedCount = Object.values(checks).filter(Boolean).length;

  let label = 'Weak';
  if (passedCount >= 6) label = 'Very Strong';
  else if (passedCount === 5) label = 'Strong';
  else if (passedCount === 4) label = 'Medium';

  return {
    ok: errors.length === 0,
    errors,
    checks,
    score: passedCount,
    label
  };
}

export function assertPasswordValid(password) {
  const res = evaluatePasswordStrength(password);
  if (!res.ok) {
    const err = new Error('Password does not meet requirements');
    err.details = res;
    throw err;
  }
  return res;
}
