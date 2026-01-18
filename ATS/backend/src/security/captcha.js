export async function verifyCaptcha({ token }) {
  const provider = process.env.CAPTCHA_PROVIDER || 'recaptcha';

  if (!token) return { ok: false, reason: 'missing_captcha_token' };

  if (provider !== 'recaptcha') {
    return { ok: false, reason: 'unsupported_captcha_provider' };
  }

  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) return { ok: false, reason: 'captcha_not_configured' };

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token })
  });

  if (!res.ok) return { ok: false, reason: `captcha_http_${res.status}` };

  const json = await res.json();
  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);

  if (!json.success) return { ok: false, reason: 'captcha_failed' };
  if (typeof json.score === 'number' && json.score < minScore) {
    return { ok: false, reason: 'captcha_low_score' };
  }

  return { ok: true };
}
