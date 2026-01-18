const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '123456',
  '12345678',
  '123456789',
  'qwerty',
  'qwerty123',
  '111111',
  '000000',
  'abc123',
  'admin',
  'letmein',
  'welcome',
  'iloveyou',
  'monkey',
  'dragon',
  'football',
  'shadow',
  'master',
  'sunshine',
  'princess',
  'login',
  'passw0rd',
  'trustno1'
]);

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

  const score = Object.values(checks).filter(Boolean).length;

  let label = 'Weak';
  if (score >= 6) label = 'Very Strong';
  else if (score === 5) label = 'Strong';
  else if (score === 4) label = 'Medium';

  return { ok: score === 6, score, label, checks };
}
